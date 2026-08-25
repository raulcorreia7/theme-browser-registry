package theme

import (
	"encoding/json"
	"math"
	"os"
	"reflect"
	"testing"

	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
)

// Golden fixtures captured from the TypeScript implementation
// (testdata/golden/expected/functions). They are the acceptance oracle:
// never edit them to make a test pass.

const goldenDir = "../../testdata/golden/expected/functions"

func loadGolden(t *testing.T, name string, dest any) {
	t.Helper()
	raw, err := os.ReadFile(goldenDir + "/" + name + ".json")
	if err != nil {
		t.Fatalf("read golden %s: %v", name, err)
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		t.Fatalf("decode golden %s: %v", name, err)
	}
}

func floatEq(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func TestGoldenInferThemeMode(t *testing.T) {
	var golden map[string]*struct {
		Mode            Mode    `json:"mode"`
		Confidence      float64 `json:"confidence"`
		ConfidenceLevel string  `json:"confidenceLevel"`
		Reason          string  `json:"reason"`
	}
	loadGolden(t, "inferThemeMode", &golden)
	if len(golden) == 0 {
		t.Fatal("empty golden fixture")
	}
	for name, want := range golden {
		got := InferThemeMode(name)
		if got == nil {
			t.Errorf("%s: got nil inference", name)
			continue
		}
		if got.Mode != want.Mode || !floatEq(got.Confidence, want.Confidence) ||
			got.Level != want.ConfidenceLevel || got.Reason != want.Reason {
			t.Errorf("%s: got %+v, want %+v", name, *got, *want)
		}
	}

	// TS returns undefined for these; keep nil.
	for _, name := range []string{"", "   ", "plain-theme"} {
		if got := InferThemeMode(name); got != nil {
			t.Errorf("%q: expected nil, got %+v", name, *got)
		}
	}
}

func TestGoldenModeHints(t *testing.T) {
	var golden struct {
		Normalized []string `json:"normalized"`
		Merges     []struct {
			OK    bool            `json:"ok"`
			Value map[string]Mode `json:"value"`
			Error string          `json:"error"`
		} `json:"merges"`
		Resolve []*ResolvedHint `json:"resolve"`
	}
	loadGolden(t, "modeHints", &golden)

	inputs := []string{"Catppuccin Latte", "Rose-Pine Dawn"}
	for i, in := range inputs {
		if got := NormalizeModeHintKey(in); got != golden.Normalized[i] {
			t.Errorf("normalized[%d] %q: got %q want %q", i, in, got, golden.Normalized[i])
		}
	}

	got, err := MergeModeHintRecords("r/x", map[string]Mode{"dawn": ModeLight}, map[string]Mode{"moon": ModeDark})
	if err != nil {
		t.Fatalf("merge ok case: %v", err)
	}
	if !reflect.DeepEqual(mapToSet(got), mapToSet(golden.Merges[0].Value)) {
		t.Errorf("merge[0]: got %v want %v", got, golden.Merges[0].Value)
	}

	_, err = MergeModeHintRecords("r/x", map[string]Mode{"mocha": ModeDark}, map[string]Mode{"mocha": ModeLight})
	if err == nil || err.Error() != golden.Merges[1].Error {
		t.Errorf("merge[1] error: got %v want %q", err, golden.Merges[1].Error)
	}

	hints := map[string]Mode{"rosepinedawn": ModeLight}
	hint := ResolveModeHint("Rose Pine Dawn", hints)
	if hint == nil || hint.Mode != golden.Resolve[0].Mode ||
		hint.MatchedKey != golden.Resolve[0].MatchedKey || hint.NormalizedMatch != golden.Resolve[0].NormalizedMatch {
		t.Errorf("resolve[0]: got %+v want %+v", hint, *golden.Resolve[0])
	}
	if ResolveModeHint("nothing-matches", hints) != nil {
		t.Error("resolve[1]: expected nil")
	}
}

func mapToSet(m map[string]Mode) map[string]bool {
	out := make(map[string]bool, len(m))
	for k, v := range m {
		out[k+"="+string(v)] = true
	}
	return out
}

func TestGoldenNormalizeThemeName(t *testing.T) {
	var golden map[string]string
	loadGolden(t, "normalizeThemeName", &golden)
	if len(golden) == 0 {
		t.Fatal("empty golden fixture")
	}
	for fullRepo, want := range golden {
		if got := NormalizeThemeName(fullRepo); got != want {
			t.Errorf("%s: got %q want %q", fullRepo, got, want)
		}
	}
}

func TestGoldenExtractColorschemes(t *testing.T) {
	var want []string
	loadGolden(t, "extractColorschemes", &want)

	items := []gh.TreeItem{
		{Path: "colors/alpha.vim", Type: "blob"},
		{Path: "colors/beta.lua", Type: "blob"},
		{Path: "colors/beta.vim", Type: "blob"},         // duplicate base name
		{Path: "colors/nested/gamma.vim", Type: "blob"}, // nested: no match
		{Path: "colors/gamma.vim", Type: "tree"},        // not a blob
		{Path: "lua/theme/init.lua", Type: "blob"},      // wrong dir
	}
	got := ExtractColorschemes(items)
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
}

func TestGoldenBuildEntry(t *testing.T) {
	var want Entry
	loadGolden(t, "buildEntry", &want)

	repo := gh.RepoItem{
		ID:         123,
		FullName:   "acme/cooltheme.nvim",
		Stargazers: 42,
		Topics:     []string{"neovim"},
		UpdatedAt:  "2026-01-01T00:00:00Z",
	}
	got, err := BuildEntry(repo, []string{"cooltheme"})
	if err != nil {
		t.Fatalf("buildEntry: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("entry mismatch:\n got %#v\nwant %#v", got, want)
	}

	// Invalid payloads error exactly like the TS implementation.
	for _, bad := range []gh.RepoItem{{FullName: ""}, {FullName: "noSlashHere"}} {
		if _, err := BuildEntry(bad, nil); err == nil || err.Error() != "invalid repository payload" {
			t.Errorf("full_name %q: expected invalid payload error, got %v", bad.FullName, err)
		}
	}
}

func TestGoldenNameAndColorscheme(t *testing.T) {
	var golden struct {
		Valid [][2]any `json:"valid"` // [name, bool]
		Infer [][2]any `json:"infer"` // [name, mode-or-null]
	}
	loadGolden(t, "nameAndColorscheme", &golden)

	for _, pair := range golden.Valid {
		name := pair[0].(string)
		want := pair[1].(bool)
		if got := IsValidThemeName(name); got != want {
			t.Errorf("valid %q: got %v want %v", name, got, want)
		}
	}
	for _, pair := range golden.Infer {
		name := pair[0].(string)
		got := InferModeFromColorscheme(name)
		mode, isMode := pair[1].(string)
		switch {
		case isMode && (got == nil || *got != Mode(mode)):
			t.Errorf("infer %q: got %v want %q", name, got, mode)
		case !isMode && got != nil:
			t.Errorf("infer %q: got %q want null", name, *got)
		}
	}
}

func TestGoldenDedupe(t *testing.T) {
	var want []string
	loadGolden(t, "dedupe", &want)

	entries := []Entry{
		{Name: "gruvbox", Repo: "morhetz/gruvbox", Colorscheme: "gruvbox", Stars: 6000},
		{Name: "GruvBox", Repo: "ellisonleao/gruvbox.nvim", Colorscheme: "gruvbox", Stars: 4000},
		{Name: "GRUVBOX", Repo: "a/gruvbox.nvim", Colorscheme: "gruvbox", Stars: 10},
		{Name: ".hidden", Repo: "x/.hidden"}, // invalid names skipped entirely
		{Name: "x", Repo: "x/x"},
	}
	got := DeduplicateThemes(entries, []string{"A/Gruvbox.Nvim"})
	if len(got) != len(want) {
		t.Fatalf("got %d entries %v, want %d", len(got), got, len(want))
	}
	for i, entry := range got {
		if entry.Repo != want[i] {
			t.Errorf("winner[%d]: got repo %q want %q", i, entry.Repo, want[i])
		}
	}
}

func goldenSignalsEqual(t *testing.T, what string, got []Signal, want []Signal) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s signals: got %d (%+v) want %d (%+v)", what, len(got), got, len(want), want)
	}
	for i := range want {
		if got[i].Strategy != want[i].Strategy || !floatEq(got[i].Score, want[i].Score) ||
			got[i].Reason != want[i].Reason {
			t.Errorf("%s signal[%d]: got %+v want %+v", what, i, got[i], want[i])
		}
	}
}

func TestGoldenDetectFromText(t *testing.T) {
	type goldenResult struct {
		Detected              string   `json:"detected"`
		Confidence            float64  `json:"confidence"`
		Signals               []Signal `json:"signals"`
		NeedsSourceInspection bool     `json:"needsSourceInspection"`
	}
	var golden map[string]goldenResult
	loadGolden(t, "detectFromText", &golden)
	if len(golden) == 0 {
		t.Fatal("empty golden fixture")
	}

	readmes := map[string]string{
		"setup":     "require('lualine').setup({\n  option = true\n})\n:colorscheme lualine",
		"load":      "require('theme').load()",
		"vimGlobal": "let g:theme_transparency = 1",
		"unknown":   "Just some prose without code.",
		"mixed":     "require('x').load()\nrequire('y').setup({ opt = 1 })",
	}

	for key, readme := range readmes {
		want, ok := golden[key]
		if !ok {
			t.Fatalf("no golden case for %q", key)
		}
		got := DetectFromText(readme)
		if got.Detected != want.Detected || !floatEq(got.Confidence, want.Confidence) ||
			got.NeedsSourceInspection != want.NeedsSourceInspection {
			t.Errorf("%s: got detected=%s conf=%v inspect=%v want %s/%v/%v",
				key, got.Detected, got.Confidence, got.NeedsSourceInspection,
				want.Detected, want.Confidence, want.NeedsSourceInspection)
		}
		goldenSignalsEqual(t, key, got.Signals, want.Signals)
	}
}

func TestGoldenInspectSource(t *testing.T) {
	type goldenPartial struct {
		Detected   string   `json:"detected"`
		Confidence float64  `json:"confidence"`
		Signals    []Signal `json:"signals"`
	}
	var golden map[string]goldenPartial
	loadGolden(t, "inspectSource", &golden)
	if len(golden) == 0 {
		t.Fatal("empty golden fixture")
	}

	blobs := func(paths ...string) []gh.TreeItem {
		items := make([]gh.TreeItem, 0, len(paths))
		for _, p := range paths {
			items = append(items, gh.TreeItem{Path: p, Type: "blob"})
		}
		return items
	}
	trees := map[string][]gh.TreeItem{
		"luaModule": blobs("lua/theme/init.lua"),
		"vimColors": blobs("colors/foo.vim"),
		"luaColors": blobs("colors/foo.lua"),
		"pluginDir": blobs("plugin/theme.lua"),
		"empty":     {},
	}

	for key, tree := range trees {
		want, ok := golden[key]
		if !ok {
			t.Fatalf("no golden case for %q", key)
		}
		got := InspectSource(tree)
		if got.Detected != want.Detected || !floatEq(got.Confidence, want.Confidence) {
			t.Errorf("%s: got %s/%v want %s/%v", key, got.Detected, got.Confidence, want.Detected, want.Confidence)
		}
		goldenSignalsEqual(t, key, got.Signals, want.Signals)
	}
}

func TestGoldenVariantNames(t *testing.T) {
	var golden map[string]*Mode
	loadGolden(t, "variantNames", &golden)
	if len(golden) == 0 {
		t.Fatal("empty golden fixture")
	}
	for name, want := range golden {
		got := InferModeFromColorscheme(name)
		if want == nil && got != nil {
			t.Errorf("%s: got %q want null", name, *got)
		}
		if want != nil && (got == nil || *got != *want) {
			t.Errorf("%s: got %v want %q", name, got, *want)
		}
	}
}

func TestApplyInferredModes(t *testing.T) {
	entries := ApplyInferredModes([]Entry{
		{Name: "tokyonight", Colorscheme: "tokyonight-night", Meta: &Meta{
			Strategy: &StrategyRef{Type: "colorscheme"}, Mode: ModeLight,
		}, Variants: []Variant{
			{Name: "night", Colorscheme: "night"},
			{Name: "day", Colorscheme: "day", Mode: ""},
			{Name: "styled", Colorscheme: "day", Mode: ModeDark}, // existing mode kept
		}},
		{Name: "mystery", Colorscheme: "mystery"},
	})

	first := entries[0]
	if first.Meta == nil || first.Meta.Mode != ModeDark {
		t.Errorf("base meta mode: got %+v want dark (inference wins)", first.Meta)
	}
	if first.Meta.Strategy == nil || first.Meta.Strategy.Type != "colorscheme" {
		t.Errorf("meta strategy must survive spread: %+v", first.Meta)
	}
	wantVariants := []Mode{"dark", "light", ModeDark}
	for i, v := range first.Variants {
		if v.Mode != wantVariants[i] {
			t.Errorf("variant[%d] %s: mode %q want %q", i, v.Name, v.Mode, wantVariants[i])
		}
	}
	if second := entries[1]; second.Meta == nil || second.Meta.Mode != "" {
		t.Errorf("low-confidence entry: meta should exist with empty mode, got %+v", second.Meta)
	}
}

func TestResolveModeHintExactBeatsNormalized(t *testing.T) {
	hints := map[string]Mode{"rose pine dawn": ModeDark, "rosepinedawn": ModeLight}
	hint := ResolveModeHint("rosepinedawn", hints)
	if hint == nil || hint.NormalizedMatch || hint.MatchedKey != "rosepinedawn" || hint.Mode != ModeLight {
		t.Errorf("exact lookup must win: %+v", hint)
	}
}
