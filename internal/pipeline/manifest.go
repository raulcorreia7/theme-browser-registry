package pipeline

// manifest.go and validate.go ports: src/db/files.ts writeManifest via
// tasks/pipeline.ts, and src/validate/registry.ts.

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// WriteManifest checksums the themes artifact and writes the published
// manifest beside it. generated_at comes from the overridable clock.
func WriteManifest(inputPath, outputPath string) (theme.Manifest, error) {
	_, raw, err := sha256File(inputPath)
	if err != nil {
		return theme.Manifest{}, fmt.Errorf("read %s: %w", inputPath, err)
	}
	var themes []json.RawMessage
	if err := json.Unmarshal(raw, &themes); err != nil {
		return theme.Manifest{}, fmt.Errorf("parse %s: %w", inputPath, err)
	}
	return buildManifest(outputPath, inputPath, len(themes))
}

// ---- validate ----

type strategyCounts struct {
	Colorscheme int `json:"colorscheme"`
	Setup       int `json:"setup"`
	Load        int `json:"load"`
}

type ValidationMetrics struct {
	TotalThemes       int            `json:"totalThemes"`
	DarkModeVariants  int            `json:"darkModeVariants"`
	LightModeVariants int            `json:"lightModeVariants"`
	IncompleteThemes  int            `json:"incompleteThemes"`
	StrategyCounts    strategyCounts `json:"strategyCounts"`
}

type ValidateResult struct {
	Passed   bool              `json:"passed"`
	Errors   []string          `json:"errors"`
	Warnings []string          `json:"warnings"`
	Metrics  ValidationMetrics `json:"metrics"`
}

// validateRow mirrors the OutputTheme shape validate/registry.ts decodes,
// including the optional meta block absent from the flattened wire format.
type validateRow struct {
	Name        string `json:"name"`
	Colorscheme string `json:"colorscheme"`
	Repo        string `json:"repo"`
	Mode        string `json:"mode"`
	Builtin     bool   `json:"builtin"`
	Strategy    string `json:"strategy"`
	Variants    []struct {
		Name        string `json:"name"`
		Colorscheme string `json:"colorscheme"`
		Mode        string `json:"mode"`
		ModeExempt  bool   `json:"modeExempt"`
	} `json:"variants"`
	Meta *struct {
		Strategy *struct {
			Type string `json:"type"`
		} `json:"strategy"`
		Mode string `json:"mode"`
	} `json:"meta"`
}

func (r validateRow) getStrategy() string {
	if r.Meta != nil && r.Meta.Strategy != nil && r.Meta.Strategy.Type != "" {
		return r.Meta.Strategy.Type
	}
	if r.Strategy != "" {
		return r.Strategy
	}
	return "colorscheme"
}

// Validate applies the publication gates: >=40 themes, >=5 per required
// strategy, at least one dark theme; warnings for missing variant modes
// (excluding modeExempt) and zero light themes.
func Validate(inputPath string) (ValidateResult, error) {
	raw, err := readFileIfExists(inputPath)
	if err != nil {
		return ValidateResult{}, err
	}
	if raw == nil {
		return ValidateResult{
			Passed:   false,
			Errors:   []string{fmt.Sprintf("themes.json not found at %s", inputPath)},
			Warnings: []string{},
			Metrics:  ValidationMetrics{StrategyCounts: strategyCounts{}},
		}, nil
	}

	var themes []validateRow
	if err := json.Unmarshal(raw, &themes); err != nil {
		return ValidateResult{}, fmt.Errorf("parse %s: %w", inputPath, err)
	}

	var errors, warnings []string
	total := len(themes)
	if total < 40 {
		errors = append(errors, fmt.Sprintf("Total themes (%d) is less than 40", total))
	}

	counts := strategyCounts{}
	var darkCount, lightCount, missingModeVariants, incomplete int

	for _, t := range themes {
		switch s := t.getStrategy(); s {
		case "colorscheme":
			counts.Colorscheme++
		case "setup":
			counts.Setup++
		case "load":
			counts.Load++
		}

		if t.Name == "" || t.Colorscheme == "" || (!t.Builtin && t.Repo == "") {
			incomplete++
		}

		if len(t.Variants) > 0 {
			for _, v := range t.Variants {
				switch {
				case v.Mode == "dark":
					darkCount++
				case v.Mode == "light":
					lightCount++
				case !v.ModeExempt:
					missingModeVariants++
				}
			}
		} else if topMode(t) == "dark" {
			darkCount++
		} else if topMode(t) == "light" {
			lightCount++
		}
	}

	forcedChecks := []struct {
		name  string
		count int
	}{{"colorscheme", counts.Colorscheme}, {"setup", counts.Setup}, {"load", counts.Load}}
	for _, fc := range forcedChecks {
		if fc.count < 5 {
			errors = append(errors, fmt.Sprintf("Strategy %q has only %d themes (need at least 5)", fc.name, fc.count))
		}
	}

	if darkCount == 0 {
		errors = append(errors, "No dark mode themes found")
	}
	if lightCount == 0 {
		warnings = append(warnings, "No light mode themes found")
	}
	if missingModeVariants > 0 {
		warnings = append(warnings, fmt.Sprintf("%d variants missing mode field", missingModeVariants))
	}

	if errors == nil {
		errors = []string{}
	}
	if warnings == nil {
		warnings = []string{}
	}

	return ValidateResult{
		Passed:   len(errors) == 0,
		Errors:   errors,
		Warnings: warnings,
		Metrics: ValidationMetrics{
			TotalThemes:       total,
			DarkModeVariants:  darkCount,
			LightModeVariants: lightCount,
			IncompleteThemes:  incomplete,
			StrategyCounts:    counts,
		},
	}, nil
}

func topMode(t validateRow) string {
	if t.Mode != "" {
		return t.Mode
	}
	if t.Meta != nil {
		return t.Meta.Mode
	}
	return ""
}

func readFileIfExists(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	return raw, nil
}
