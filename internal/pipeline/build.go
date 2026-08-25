package pipeline

// build.go ports src/build/index.ts verbatim.

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

type BuildOptions struct {
	Index          string
	Overrides      string
	Output         string
	Minify         bool
	PreferredRepos []string
}

type BuildResult struct {
	Themes     int    `json:"themes"`
	Variants   int    `json:"variants"`
	Size       int    `json:"size"`
	OutputPath string `json:"outputPath"`
}

type hintsFileRaw struct {
	Hints []struct {
		Repo               string                `json:"repo"`
		VariantModes       map[string]theme.Mode `json:"variantModes"`
		ModeExemptVariants []string              `json:"modeExemptVariants"`
	} `json:"hints"`
}

type hintData struct {
	VariantHints    map[string]map[string]theme.Mode
	ModeExemptHints map[string][]string
}

func hasModeExemptHint(variantName string, hints []string) bool {
	normalizedName := theme.NormalizeModeHintKey(variantName)
	for _, hintName := range hints {
		if theme.NormalizeModeHintKey(hintName) == normalizedName {
			return true
		}
	}
	return false
}

// loadHintData requires the internal/theme helpers MergeModeHintRecords and
// NormalizeModeHintKey per the frozen stage contract.
func loadHintData(hintsPath string) (hintData, error) {
	data := hintData{
		VariantHints:    map[string]map[string]theme.Mode{},
		ModeExemptHints: map[string][]string{},
	}
	raw, err := os.ReadFile(hintsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return data, nil
		}
		return data, err
	}
	var hints hintsFileRaw
	if err := json.Unmarshal(raw, &hints); err != nil || len(hints.Hints) == 0 {
		return data, nil
	}
	for _, h := range hints.Hints {
		if h.Repo == "" {
			continue
		}
		if len(h.VariantModes) > 0 {
			existing := data.VariantHints[h.Repo]
			if existing == nil {
				existing = map[string]theme.Mode{}
			}
			merged, err := theme.MergeModeHintRecords(h.Repo, existing, h.VariantModes)
			if err != nil {
				return data, err
			}
			data.VariantHints[h.Repo] = merged
		}
		if len(h.ModeExemptVariants) > 0 {
			set := map[string]bool{}
			merged := make([]string, 0, len(data.ModeExemptHints[h.Repo])+len(h.ModeExemptVariants))
			for _, v := range data.ModeExemptHints[h.Repo] {
				if !set[v] {
					set[v] = true
					merged = append(merged, v)
				}
			}
			for _, v := range h.ModeExemptVariants {
				if !set[v] {
					set[v] = true
					merged = append(merged, v)
				}
			}
			data.ModeExemptHints[h.Repo] = merged
		}
	}
	return data, nil
}

type overridesMaps struct {
	byRepo map[string]theme.Entry
	byName map[string]theme.Entry
}

func loadBuildOverrides(overridesPath string) (overridesMaps, error) {
	m := overridesMaps{
		byRepo: map[string]theme.Entry{},
		byName: map[string]theme.Entry{},
	}
	raw, err := os.ReadFile(overridesPath)
	if err != nil {
		if os.IsNotExist(err) {
			return m, nil
		}
		return m, err
	}
	var data struct {
		Overrides []theme.Entry `json:"overrides"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return m, err
	}
	for _, o := range data.Overrides {
		if o.Repo != "" {
			m.byRepo[o.Repo] = o
		}
		if o.Name != "" {
			m.byName[o.Name] = o
		}
	}
	return m, nil
}

type builtinLoad struct {
	builtin []theme.Entry
	hint    hintData
}

// loadBuiltinThemes loads the builtin bucket plus variant/modeExempt hints
// resolved relative to the overrides path (src/lib/sources.ts ladder).
func loadBuiltinThemes(overridesPath string) (builtinLoad, error) {
	out := builtinLoad{
		hint: hintData{
			VariantHints:    map[string]map[string]theme.Mode{},
			ModeExemptHints: map[string][]string{},
		},
	}
	raw, err := os.ReadFile(overridesPath)
	if err != nil {
		if os.IsNotExist(err) {
			return out, nil
		}
		return out, err
	}
	var data struct {
		Builtin []theme.Entry `json:"builtin"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		return out, err
	}

	hintsPath := ResolveHintsPathFromOverridesPath(overridesPath)
	if fileExists(hintsPath) {
		hd, err := loadHintData(hintsPath)
		if err != nil {
			return out, fmt.Errorf("failed to load variant hints: %w", err)
		}
		out.hint = hd
	}

	for _, t := range data.Builtin {
		if t.Name != "" && t.Builtin {
			out.builtin = append(out.builtin, t)
		}
	}
	return out, nil
}

// buildOptimizedEntry mirrors buildOptimizedEntry: precedence override >
// theme for scalars; variant mode precedence hint > variant.mode > inferred.
func buildOptimizedEntry(t theme.Entry, ov *theme.Entry, hints hintData) theme.Output {
	entry := theme.Output{
		Name:        t.Name,
		Colorscheme: t.Colorscheme,
	}
	if ov != nil && ov.Name != "" {
		entry.Name = ov.Name
	}
	if ov != nil && ov.Colorscheme != "" {
		entry.Colorscheme = ov.Colorscheme
	}

	if ov != nil && ov.Repo != "" {
		entry.Repo = ov.Repo
	} else if t.Repo != "" {
		entry.Repo = t.Repo
	}
	if ov != nil && ov.Stars != 0 {
		entry.Stars = ov.Stars
	} else if t.Stars != 0 {
		entry.Stars = t.Stars
	}
	if ov != nil && ov.Meta != nil && ov.Meta.Mode != "" {
		entry.Mode = ov.Meta.Mode
	} else if t.Meta != nil && t.Meta.Mode != "" {
		entry.Mode = t.Meta.Mode
	}
	if t.Builtin {
		entry.Builtin = true
	}

	strategy := (*theme.StrategyRef)(nil)
	if ov != nil && ov.Meta != nil {
		strategy = ov.Meta.Strategy
	}
	if strategy == nil && t.Meta != nil {
		strategy = t.Meta.Strategy
	}
	if strategy != nil && strategy.Type != "" {
		entry.Strategy = strategy.Type
		if strategy.Module != "" {
			entry.Module = strategy.Module
		}
	}

	variants := t.Variants
	if ov != nil && ov.Variants != nil {
		variants = ov.Variants
	}
	if len(variants) > 0 {
		hintsRepo := t.Repo
		if ov != nil && ov.Repo != "" {
			hintsRepo = ov.Repo
		}
		repoVariantHints := hints.VariantHints[hintsRepo]
		repoModeExempt := hints.ModeExemptHints[hintsRepo]

		entry.Variants = make([]theme.OutputVariant, 0, len(variants))
		for _, v := range variants {
			variant := theme.OutputVariant{
				Name:        v.Name,
				Colorscheme: v.Colorscheme,
			}

			variantMode := v.Mode
			var hint *theme.ResolvedHint
			if repoVariantHints != nil {
				if h := theme.ResolveModeHint(v.Name, repoVariantHints); h != nil {
					hint = h
				} else if v.Colorscheme != "" {
					hint = theme.ResolveModeHint(v.Colorscheme, repoVariantHints)
				}
			}

			switch {
			case hint != nil:
				variant.Mode = hint.Mode
			case variantMode != "":
				variant.Mode = variantMode
			default:
				cs := v.Colorscheme
				if cs == "" {
					cs = v.Name
				}
				if inferred := theme.InferModeFromColorscheme(cs); inferred != nil {
					variant.Mode = *inferred
				}
			}

			if variant.Mode == "" && len(repoModeExempt) > 0 {
				if hasModeExemptHint(v.Name, repoModeExempt) ||
					hasModeExemptHint(v.Colorscheme, repoModeExempt) {
					variant.ModeExempt = true
				}
			}

			if v.Meta != nil && v.Meta.Type != "" {
				variant.Strategy = v.Meta.Type
				if v.Meta.Module != "" {
					variant.Module = v.Meta.Module
				}
			}
			entry.Variants = append(entry.Variants, variant)
		}
	}

	return entry
}

// Build ports src/build/index.ts run(). Requires the internal/theme helpers
// IsValidThemeName per the frozen stage contract.
func Build(o BuildOptions) (BuildResult, error) {
	rawIdx, err := os.ReadFile(o.Index)
	if err != nil {
		return BuildResult{}, fmt.Errorf("read index: %w", err)
	}
	var themes []theme.Entry
	if err := json.Unmarshal(rawIdx, &themes); err != nil {
		return BuildResult{}, fmt.Errorf("parse index: %w", err)
	}

	ovMaps, err := loadBuildOverrides(o.Overrides)
	if err != nil {
		return BuildResult{}, err
	}
	bl, err := loadBuiltinThemes(o.Overrides)
	if err != nil {
		return BuildResult{}, err
	}

	preferred := map[string]bool{}
	for _, r := range o.PreferredRepos {
		r = strings.TrimSpace(strings.ToLower(r))
		if r != "" {
			preferred[r] = true
		}
	}

	// JS Map preserves insertion order even when a key is replaced; keep an
	// ordered key slice to reproduce curated row order deterministically.
	themesByName := map[string]theme.Entry{}
	var order []string

	for _, t := range themes {
		if t.Name == "" {
			continue
		}
		nameLower := strings.ToLower(t.Name)
		if !theme.IsValidThemeName(t.Name) {
			continue
		}
		existing, exists := themesByName[nameLower]
		if exists {
			existingIsPreferred := preferred[strings.ToLower(existing.Repo)]
			newIsPreferred := preferred[strings.ToLower(t.Repo)]
			existingIsNeovim := strings.Contains(existing.Repo, ".nvim") || strings.Contains(existing.Repo, "neovim")
			newIsNeovim := strings.Contains(t.Repo, ".nvim") || strings.Contains(t.Repo, "neovim")
			existingVariants := len(existing.Variants)
			newVariants := len(t.Variants)

			newIsBetter := false
			switch {
			case newIsPreferred && !existingIsPreferred:
				newIsBetter = true
			case !newIsPreferred && existingIsPreferred:
				newIsBetter = false
			case newIsNeovim && !existingIsNeovim:
				newIsBetter = true
			case !newIsNeovim && existingIsNeovim:
				newIsBetter = false
			case t.Stars > existing.Stars:
				newIsBetter = true
			case t.Stars < existing.Stars:
				newIsBetter = false
			case newVariants > existingVariants:
				newIsBetter = true
			}
			if newIsBetter {
				themesByName[nameLower] = t
			}
		} else {
			order = append(order, nameLower)
			themesByName[nameLower] = t
		}
	}

	curated := make([]theme.Output, 0, len(order)+len(bl.builtin))
	for _, nameLower := range order {
		t := themesByName[nameLower]
		var ov *theme.Entry
		if t.Repo != "" {
			if e, ok := ovMaps.byRepo[t.Repo]; ok {
				e := e
				ov = &e
			}
		} else if e, ok := ovMaps.byName[t.Name]; ok {
			e := e
			ov = &e
		}
		curated = append(curated, buildOptimizedEntry(t, ov, bl.hint))
	}

	for _, b := range bl.builtin {
		if _, dup := themesByName[strings.ToLower(b.Name)]; dup {
			continue
		}
		entry := theme.Output{
			Name:        b.Name,
			Colorscheme: b.Colorscheme,
			Builtin:     true,
		}
		if b.Stars != 0 {
			entry.Stars = b.Stars
		}
		if b.Meta != nil && b.Meta.Mode != "" {
			entry.Mode = b.Meta.Mode
		}
		if b.Meta != nil && b.Meta.Strategy != nil && b.Meta.Strategy.Type != "" {
			entry.Strategy = b.Meta.Strategy.Type
			if b.Meta.Strategy.Module != "" {
				entry.Module = b.Meta.Strategy.Module
			}
		}
		curated = append(curated, entry)
	}

	if dir := filepath.Dir(o.Output); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return BuildResult{}, err
		}
	}

	var payload []byte
	if o.Minify {
		payload, err = json.Marshal(curated)
	} else {
		payload, err = json.MarshalIndent(curated, "", "  ")
		payload = append(payload, '\n')
	}
	if err != nil {
		return BuildResult{}, err
	}
	if err := os.WriteFile(o.Output, payload, 0o644); err != nil {
		return BuildResult{}, err
	}

	variants := 0
	for _, c := range curated {
		variants += len(c.Variants)
	}
	return BuildResult{
		Themes:     len(curated),
		Variants:   variants,
		Size:       len(payload),
		OutputPath: o.Output,
	}, nil
}
