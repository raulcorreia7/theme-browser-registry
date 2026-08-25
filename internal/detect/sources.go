package detect

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// Sources is the overrides/builtin pair (SourcesFile).
type Sources struct {
	Overrides []theme.Entry `json:"overrides"`
	Builtin   []theme.Entry `json:"builtin,omitempty"`
}

// strategyFile is one per-strategy sources file on disk.
type strategyFile struct {
	Themes   []theme.Entry `json:"themes"`
	Strategy string        `json:"strategy,omitempty"`
}

type hint struct {
	Repo         string                `json:"repo"`
	Strategy     StrategyType          `json:"strategy,omitempty"`
	VariantModes map[string]theme.Mode `json:"variantModes,omitempty"`
	Reason       string                `json:"reason,omitempty"`
}

type hintsFile struct {
	Hints []hint `json:"hints"`
}

func readJSONFile(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

func writeJSONFile(path string, v any) error {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// LoadSources ports loadSources: fast path through overrides.json when it
// exists, otherwise fold the per-strategy files with builtin kept separate.
func LoadSources(sourcesDir string) (Sources, error) {
	overridesPath := filepath.Join(sourcesDir, "overrides.json")
	if _, err := os.Stat(overridesPath); err == nil {
		var s Sources
		if err := readJSONFile(overridesPath, &s); err != nil {
			return Sources{}, err
		}
		return s, nil
	}

	var all, builtin []theme.Entry
	for _, name := range []string{"setup.json", "load.json", "colorscheme.json", "builtin.json"} {
		path := filepath.Join(sourcesDir, name)
		if _, err := os.Stat(path); err != nil {
			continue
		}
		var data strategyFile
		if err := readJSONFile(path, &data); err != nil {
			return Sources{}, err
		}
		if data.Themes == nil {
			continue
		}
		if name == "builtin.json" {
			builtin = append(builtin, data.Themes...)
		} else {
			all = append(all, data.Themes...)
		}
	}
	return Sources{Overrides: all, Builtin: builtin}, nil
}

// LoadHintsData ports loadHintsData: parse hints.json into per-repo strategy
// hints and merged variant-mode hints. Conflicting strategies for one repo
// are an error.
func LoadHintsData(sourcesDir string) (map[string]StrategyType, map[string]map[string]theme.Mode, error) {
	strategyHints := map[string]StrategyType{}
	variantHints := map[string]map[string]theme.Mode{}

	path := filepath.Join(sourcesDir, "hints.json")
	if _, err := os.Stat(path); err != nil {
		return strategyHints, variantHints, nil
	}

	var data hintsFile
	if err := readJSONFile(path, &data); err != nil {
		return nil, nil, fmt.Errorf("Failed to load hints: %s", err.Error())
	}

	for _, h := range data.Hints {
		if h.Repo == "" {
			continue
		}
		if h.Strategy != "" {
			if existing, ok := strategyHints[h.Repo]; ok && existing != h.Strategy {
				return nil, nil, fmt.Errorf("Failed to load hints: Conflicting strategy hints for %s: %s vs %s",
					h.Repo, existing, h.Strategy)
			}
			strategyHints[h.Repo] = h.Strategy
		}
		if len(h.VariantModes) > 0 {
			existing := variantHints[h.Repo]
			if existing == nil {
				existing = map[string]theme.Mode{}
			}
			merged, err := theme.MergeModeHintRecords(h.Repo, existing, h.VariantModes)
			if err != nil {
				return nil, nil, fmt.Errorf("Failed to load hints: %s", err.Error())
			}
			variantHints[h.Repo] = merged
		}
	}
	return strategyHints, variantHints, nil
}

// BuildPatch ports buildPatch: actionable rows only.
func BuildPatch(rows []Row) []PatchEntry {
	patch := []PatchEntry{}
	for _, r := range rows {
		if (r.Status == StatusMismatch || r.Status == StatusMissingMeta) &&
			r.DetectedStrategy != StrategyUnknown &&
			r.Confidence >= HighConfidenceThreshold {
			patch = append(patch, PatchEntry{
				Repo:       r.Repo,
				Strategy:   r.DetectedStrategy,
				Confidence: r.Confidence,
			})
		}
	}
	sort.SliceStable(patch, func(i, j int) bool {
		return lessCaseInsensitive(patch[i].Repo, patch[j].Repo)
	})
	return patch
}

// ApplyDetectionPatch ports applyDetectionPatch. Pure: mutates and returns a
// new Sources value, never touches disk. Existing override entries get their
// meta.strategy.type replaced; repos not yet present gain minimal entries
// looked up in the themes index. Result is sorted by entry name.
func ApplyDetectionPatch(sources Sources, patch []PatchEntry, themesIndex []theme.Entry) Sources {
	patchMap := map[string]StrategyType{}
	for _, p := range patch {
		patchMap[p.Repo] = p.Strategy
	}

	existingRepos := map[string]bool{}
	for _, o := range sources.Overrides {
		if o.Repo != "" {
			existingRepos[o.Repo] = true
		}
	}

	updated := make([]theme.Entry, len(sources.Overrides))
	copy(updated, sources.Overrides)
	for i := range updated {
		e := &updated[i]
		if e.Repo == "" {
			continue
		}
		detected, ok := patchMap[e.Repo]
		if !ok {
			continue
		}
		meta := e.Meta
		if meta == nil {
			meta = &theme.Meta{}
		} else {
			cp := *meta
			meta = &cp
		}
		strategy := meta.Strategy
		if strategy == nil {
			strategy = &theme.StrategyRef{}
		} else {
			cp := *strategy
			strategy = &cp
		}
		strategy.Type = string(detected)
		meta.Strategy = strategy
		e.Meta = meta
	}

	newEntries := []theme.Entry{}
	for _, p := range patch {
		if existingRepos[p.Repo] {
			continue
		}
		var matched *theme.Entry
		for i := range themesIndex {
			if themesIndex[i].Repo == p.Repo {
				matched = &themesIndex[i]
				break
			}
		}
		if matched == nil {
			continue
		}
		newEntries = append(newEntries, theme.Entry{
			Name:        matched.Name,
			Repo:        p.Repo,
			Colorscheme: matched.Colorscheme,
			Meta:        &theme.Meta{Strategy: &theme.StrategyRef{Type: string(p.Strategy)}},
		})
	}

	all := append(updated, newEntries...)
	sort.SliceStable(all, func(i, j int) bool {
		return lessCaseInsensitive(all[i].Name, all[j].Name)
	})

	return Sources{Overrides: all, Builtin: sources.Builtin}
}

// SaveSources ports saveSources: bucket overrides by meta.strategy.type
// ("colorscheme" default; invalid values fall back to colorscheme; "builtin"
// merges with sources.Builtin) into setup/load/colorscheme/builtin.json as
// {strategy,count,themes} sorted by name. Empty buckets are not written.
func SaveSources(sourcesDir string, sources Sources) error {
	buckets := map[string][]theme.Entry{
		string(StrategySetup):       {},
		string(StrategyLoad):        {},
		string(StrategyColorscheme): {},
		"builtin":                   append([]theme.Entry{}, sources.Builtin...),
	}
	valid := map[string]bool{
		string(StrategySetup):       true,
		string(StrategyLoad):        true,
		string(StrategyColorscheme): true,
		"builtin":                   true,
	}

	for _, t := range sources.Overrides {
		raw := "colorscheme"
		if t.Meta != nil && t.Meta.Strategy != nil && t.Meta.Strategy.Type != "" {
			raw = t.Meta.Strategy.Type
		}
		if !valid[raw] {
			raw = string(StrategyColorscheme)
		}
		buckets[raw] = append(buckets[raw], t)
	}

	for _, strategy := range []string{"setup", "load", "colorscheme", "builtin"} {
		themes := buckets[strategy]
		if len(themes) == 0 {
			continue
		}
		sort.SliceStable(themes, func(i, j int) bool {
			return lessCaseInsensitive(themes[i].Name, themes[j].Name)
		})
		payload := strategyFile{Strategy: strategy, Themes: themes}.asSaved()
		if err := writeJSONFile(filepath.Join(sourcesDir, strategy+".json"), payload); err != nil {
			return err
		}
	}
	return nil
}

// savedSources matches the on-disk {strategy,count,themes} shape (the JSON
// field order strategy,count,themes follows the TS literal key order).
type savedSources struct {
	Strategy string        `json:"strategy"`
	Count    int           `json:"count"`
	Themes   []theme.Entry `json:"themes"`
}

func (f strategyFile) asSaved() savedSources {
	return savedSources{Strategy: f.Strategy, Count: len(f.Themes), Themes: f.Themes}
}

func lessCaseInsensitive(a, b string) bool {
	return lower(a) < lower(b)
}

func lower(s string) string {
	b := []byte(s)
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 'a' - 'A'
		}
	}
	return string(b)
}
