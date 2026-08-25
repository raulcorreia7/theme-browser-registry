package pipeline

// bundle.go ports src/build/bundle.ts (selectThemesWithHeuristics verbatim,
// operating on flattened Output rows so top-level Mode participates).

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

type BundleOptions struct {
	Input  string
	Output string
	Count  int
}

type BundleResult struct {
	Selected   int    `json:"selected"`
	DarkCount  int    `json:"darkCount"`
	LightCount int    `json:"lightCount"`
	OutputPath string `json:"outputPath"`
}

// selectThemesWithHeuristics ports bundle.ts verbatim: dedupe by exact name
// keeping the higher-starred row, stable score sort, quota fill with
// minDark = floor(count*0.4) and minLight = floor(count*0.2), then a
// catch-up pass and a final name sort.
func selectThemesWithHeuristics(themes []theme.Output, targetCount int) (selected []theme.Output, darkCount, lightCount, duplicates int) {
	byName := map[string]theme.Output{}
	var names []string
	for _, t := range themes {
		if existing, ok := byName[t.Name]; ok {
			duplicates++
			if t.Stars > existing.Stars {
				byName[t.Name] = t
			}
		} else {
			names = append(names, t.Name)
			byName[t.Name] = t
		}
	}

	type scoredTheme struct {
		t     theme.Output
		score float64
		modes map[theme.Mode]bool
	}
	scored := make([]scoredTheme, 0, len(names))
	for _, name := range names {
		t := byName[name]
		scored = append(scored, scoredTheme{t, scoreOutput(t), themeModes(t)})
	}
	sort.SliceStable(scored, func(i, j int) bool { return scored[i].score > scored[j].score })

	selectedNames := map[string]bool{}
	minDark := targetCount * 4 / 10
	minLight := targetCount * 2 / 10

	for _, s := range scored {
		if len(selected) >= targetCount {
			break
		}
		if selectedNames[s.t.Name] {
			continue
		}
		hasDark := s.modes[theme.ModeDark]
		hasLight := s.modes[theme.ModeLight]
		needsDark := darkCount < minDark && hasDark
		needsLight := lightCount < minLight && hasLight

		reserve := len(selected) <
			targetCount-maxInt(0, minDark-darkCount)-maxInt(0, minLight-lightCount)
		if needsDark || needsLight || reserve {
			selected = append(selected, s.t)
			selectedNames[s.t.Name] = true
			if hasDark {
				darkCount++
			}
			if hasLight {
				lightCount++
			}
		}
	}

	for _, s := range scored {
		if len(selected) >= targetCount {
			break
		}
		if selectedNames[s.t.Name] {
			continue
		}
		selected = append(selected, s.t)
		selectedNames[s.t.Name] = true
		modes := themeModes(s.t)
		if modes[theme.ModeDark] {
			darkCount++
		}
		if modes[theme.ModeLight] {
			lightCount++
		}
	}

	sort.SliceStable(selected, func(i, j int) bool { return selected[i].Name < selected[j].Name })
	return selected, darkCount, lightCount, duplicates
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Bundle reads the themes artifact, keeps rows with name+repo+colorscheme and
// writes the heuristic-selected bundle for the Lua plugin.
func Bundle(o BundleOptions) (BundleResult, error) {
	raw, err := os.ReadFile(o.Input)
	if err != nil {
		return BundleResult{}, fmt.Errorf("input file not found: %s", o.Input)
	}
	var allThemes []theme.Output
	if err := json.Unmarshal(raw, &allThemes); err != nil {
		return BundleResult{}, fmt.Errorf("parse %s: %w", o.Input, err)
	}

	valid := make([]theme.Output, 0, len(allThemes))
	for _, t := range allThemes {
		if t.Name != "" && t.Repo != "" && t.Colorscheme != "" {
			valid = append(valid, t)
		}
	}

	selected, darkCount, lightCount, _ := selectThemesWithHeuristics(valid, o.Count)

	if dir := filepath.Dir(o.Output); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return BundleResult{}, err
		}
	}
	if err := writeJSON(o.Output, selected); err != nil {
		return BundleResult{}, err
	}
	return BundleResult{
		Selected:   len(selected),
		DarkCount:  darkCount,
		LightCount: lightCount,
		OutputPath: o.Output,
	}, nil
}
