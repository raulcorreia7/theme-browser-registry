package pipeline

// merge.go ports src/merge/index.ts (run) and src/merge/apply.ts
// (loadOverrides/applyOverrides/mergeEntry/mergeStrategy) verbatim.

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

type MergeResult struct {
	Themes     int
	Builtin    int
	OutputPath string
}

type mergeHint struct {
	Repo     string `json:"repo"`
	Strategy string `json:"strategy"`
	Reason   string `json:"reason"`
}

type mergeHintsFile struct {
	Description string      `json:"description"`
	Hints       []mergeHint `json:"hints"`
}

// Merge folds config/sources/*.json into the overrides artifact, applying
// strategy hints from hints.json. Signature fixed by the stage contract:
//
//	func Merge(sourcesDir, outputPath string) (MergeResult, error)
func Merge(sourcesDir, outputPath string) (MergeResult, error) {
	var allThemes, builtin []theme.Entry

	entries, err := os.ReadDir(sourcesDir)
	if err != nil {
		return MergeResult{}, fmt.Errorf("read sources dir: %w", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") && e.Name() != "hints.json" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, file := range files {
		raw, err := os.ReadFile(filepath.Join(sourcesDir, file))
		if err != nil {
			return MergeResult{}, err
		}
		var data struct {
			Strategy any           `json:"strategy"`
			Themes   []theme.Entry `json:"themes"`
		}
		if err := json.Unmarshal(raw, &data); err != nil {
			return MergeResult{}, fmt.Errorf("parse %s: %w", file, err)
		}
		if data.Strategy == nil {
			continue // no "strategy" key -> skipped like the TS `"strategy" in data` guard
		}
		if s, ok := data.Strategy.(string); ok && s == "builtin" {
			builtin = append(builtin, data.Themes...)
		} else {
			allThemes = append(allThemes, data.Themes...)
		}
	}

	hintsRaw, err := os.ReadFile(filepath.Join(sourcesDir, "hints.json"))
	if err == nil {
		var hints mergeHintsFile
		if err := json.Unmarshal(hintsRaw, &hints); err != nil {
			return MergeResult{}, fmt.Errorf("parse hints.json: %w", err)
		}
		hintMap := map[string]string{}
		for _, h := range hints.Hints {
			hintMap[h.Repo] = h.Strategy
		}
		for i := range allThemes {
			t := &allThemes[i]
			if t.Repo == "" {
				continue
			}
			strat, ok := hintMap[t.Repo]
			if !ok {
				continue
			}
			if t.Meta == nil {
				t.Meta = &theme.Meta{}
			}
			if t.Meta.Strategy == nil {
				t.Meta.Strategy = &theme.StrategyRef{Type: strat}
			} else {
				t.Meta.Strategy.Type = strat
			}
		}
	} else if !os.IsNotExist(err) {
		return MergeResult{}, err
	}

	stableSortByName(allThemes)
	stableSortByName(builtin)

	merged := struct {
		Overrides []theme.Entry `json:"overrides"`
		Builtin   []theme.Entry `json:"builtin,omitempty"`
	}{Overrides: allThemes, Builtin: builtin}

	if err := writeJSON(outputPath, merged); err != nil {
		return MergeResult{}, err
	}
	return MergeResult{
		Themes:     len(allThemes),
		Builtin:    len(builtin),
		OutputPath: outputPath,
	}, nil
}

func stableSortByName(entries []theme.Entry) {
	sort.SliceStable(entries, func(i, j int) bool {
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
}

// ---- apply.ts ----

type overridesFileRaw struct {
	Overrides []json.RawMessage `json:"overrides"`
	Excluded  []string          `json:"excluded"`
}

// LoadOverrides ports loadOverrides: {overrides, excluded} keys; entries must
// be objects carrying a repo key; excluded items must be non-empty strings.
func LoadOverrides(path string) ([]json.RawMessage, []string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, nil
		}
		return nil, nil, err
	}
	var data overridesFileRaw
	if err := json.Unmarshal(raw, &data); err != nil {
		// TS: typeof raw !== "object" -> empty result. A malformed file is an
		// object parse failure only when not JSON at all; mirror leniently.
		return nil, nil, nil
	}
	var overrides []json.RawMessage
	for _, item := range data.Overrides {
		var probe map[string]any
		if json.Unmarshal(item, &probe) == nil && probe != nil {
			if _, ok := probe["repo"]; ok {
				overrides = append(overrides, item)
			}
		}
	}
	var excluded []string
	for _, item := range data.Excluded {
		if item != "" {
			excluded = append(excluded, item)
		}
	}
	return overrides, excluded, nil
}

// ApplyOverrides ports applyOverrides: shallow spread with deep meta.strategy
// merge and whole-replace variants, keyed by repo, preserving first-seen order
// (JS Map iteration semantics).
func ApplyOverrides(entries []theme.Entry, overrides []json.RawMessage, excluded []string) ([]theme.Entry, error) {
	type slot struct {
		m map[string]any
	}
	byRepo := map[string]*slot{}
	var order []string

	entryMap := func(e theme.Entry) (map[string]any, error) {
		b, err := json.Marshal(e)
		if err != nil {
			return nil, err
		}
		var m map[string]any
		if err := json.Unmarshal(b, &m); err != nil {
			return nil, err
		}
		return m, nil
	}

	for _, e := range entries {
		if e.Repo == "" {
			continue
		}
		m, err := entryMap(e)
		if err != nil {
			return nil, err
		}
		if _, seen := byRepo[e.Repo]; !seen {
			order = append(order, e.Repo)
		}
		byRepo[e.Repo] = &slot{m: m}
	}

	for _, repo := range excluded {
		if s, ok := byRepo[repo]; ok {
			delete(byRepo, repo)
			_ = s
		}
	}
	// rebuild order without excluded repos
	var kept []string
	inSet := func(v string) bool { _, ok := byRepo[v]; return ok }
	for _, v := range order {
		if inSet(v) {
			kept = append(kept, v)
		}
	}
	order = kept

	for _, raw := range overrides {
		var ov map[string]any
		if err := json.Unmarshal(raw, &ov); err != nil {
			return nil, err
		}
		repoStr, _ := ov["repo"].(string)
		if repoStr == "" {
			continue
		}
		existing, ok := byRepo[repoStr]
		var base map[string]any
		if ok {
			base = existing.m
		} else {
			name := ""
			if v, present := ov["name"]; present && v != nil {
				name, _ = v.(string)
			}
			cs := ""
			if v, present := ov["colorscheme"]; present && v != nil {
				cs, _ = v.(string)
			}
			base = map[string]any{"name": name, "repo": repoStr, "colorscheme": cs}
		}
		merged := mergeEntry(base, ov)
		if !ok {
			order = append(order, repoStr)
		}
		byRepo[repoStr] = &slot{m: merged}
	}

	out := make([]theme.Entry, 0, len(order))
	for _, repo := range order {
		b, err := json.Marshal(byRepo[repo].m)
		if err != nil {
			return nil, err
		}
		var e theme.Entry
		if err := json.Unmarshal(b, &e); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

func copyMap(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// mergeEntry mirrors apply.ts mergeEntry: {...base, ...override, meta: ...}.
func mergeEntry(base, override map[string]any) map[string]any {
	out := copyMap(base)
	for k, v := range override {
		out[k] = v
	}
	baseMeta, _ := base["meta"].(map[string]any)
	if ovMeta, ok := override["meta"].(map[string]any); ok {
		nm := copyMap(baseMeta)
		nm["strategy"] = mergeStrategy(baseMeta["strategy"], ovMeta["strategy"])
		out["meta"] = nm
	} else if baseMeta != nil {
		out["meta"] = baseMeta
	} else {
		delete(out, "meta")
	}
	return out
}

// mergeStrategy mirrors apply.ts mergeStrategy: shallow spread plus deep vim merge.
func mergeStrategy(base, override any) any {
	if override == nil {
		return base
	}
	if base == nil {
		return override
	}
	bs, ok1 := base.(map[string]any)
	os_, ok2 := override.(map[string]any)
	if !ok1 || !ok2 {
		return override
	}
	m := copyMap(bs)
	for k, v := range os_ {
		m[k] = v
	}
	bv, _ := bs["vim"].(map[string]any)
	ov, _ := os_["vim"].(map[string]any)
	if bv != nil || ov != nil {
		vm := map[string]any{}
		for k, v := range bv {
			vm[k] = v
		}
		for k, v := range ov {
			vm[k] = v
		}
		m["vim"] = vm
	}
	return m
}
