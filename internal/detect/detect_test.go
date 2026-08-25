package detect

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// failingGH fails every call and records that it was hit; the golden run
// must serve everything from caches, so zero calls is an assertion.
type failingGH struct {
	mu    sync.Mutex
	calls int
}

func (f *failingGH) fail() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	return errors.New("unexpected live GitHub call")
}

func (f *failingGH) SearchRepositories(context.Context, string, int, int, int) (gh.RepoPage, error) {
	return gh.RepoPage{}, f.fail()
}
func (f *failingGH) Repository(context.Context, string) (*gh.RepoItem, error) {
	return nil, f.fail()
}
func (f *failingGH) Tree(context.Context, string, string) ([]gh.TreeItem, error) {
	return nil, f.fail()
}
func (f *failingGH) Readme(context.Context, string) (*string, error) {
	return nil, f.fail()
}

const fixturesDir = "../../testdata/golden/fixtures"

func copyDir(t *testing.T, src, dst string) {
	t.Helper()
	err := filepath.Walk(src, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
	if err != nil {
		t.Fatalf("copyDir: %v", err)
	}
}

// blankGeneratedAt blanks generated_at recursively for timestamp-insensitive
// comparison.
func blankGeneratedAt(v any) {
	switch x := v.(type) {
	case map[string]any:
		if _, ok := x["generated_at"]; ok {
			x["generated_at"] = ""
		}
		for _, child := range x {
			blankGeneratedAt(child)
		}
	case []any:
		for _, child := range x {
			blankGeneratedAt(child)
		}
	}
}

func deepDiff(path string, got, want any) (string, bool) {
	g, gok := got.(float64)
	w, wok := want.(float64)
	if gok && wok {
		if math.Abs(g-w) <= 1e-9 {
			return "", true
		}
		return fmt.Sprintf("\t%s: got %v want %v\n", path, g, w), false
	}
	switch w := want.(type) {
	case map[string]any:
		gm, ok := got.(map[string]any)
		if !ok {
			return fmt.Sprintf("\t%s: type got %T want object\n", path, got), false
		}
		var sb strings.Builder
		eq := true
		for k, wv := range w {
			gv, present := gm[k]
			if !present {
				sb.WriteString(fmt.Sprintf("\t%s.%s: missing\n", path, k))
				eq = false
				continue
			}
			if msg, o := deepDiff(path+"."+k, gv, wv); !o {
				sb.WriteString(msg)
				eq = false
			}
		}
		for k := range gm {
			if _, present := w[k]; !present {
				sb.WriteString(fmt.Sprintf("\t%s.%s: unexpected extra key\n", path, k))
				eq = false
			}
		}
		return sb.String(), eq
	case []any:
		ga, ok := got.([]any)
		if !ok {
			return fmt.Sprintf("\t%s: type got %T want array\n", path, got), false
		}
		if len(ga) != len(w) {
			return fmt.Sprintf("\t%s: length got %d want %d\n", path, len(ga), len(w)), false
		}
		var sb strings.Builder
		eq := true
		for i := range w {
			if msg, o := deepDiff(fmt.Sprintf("%s[%d]", path, i), ga[i], w[i]); !o {
				sb.WriteString(msg)
				eq = false
			}
		}
		return sb.String(), eq
	default:
		if got == want {
			return "", true
		}
		return fmt.Sprintf("\t%s: got %#v want %#v\n", path, got, want), false
	}
}

func assertJSONEqual(t *testing.T, name string, gotRaw []byte, wantPath string) {
	t.Helper()
	var got, want any
	if err := json.Unmarshal(gotRaw, &got); err != nil {
		t.Fatalf("%s: decode got: %v", name, err)
	}
	wantRaw, err := os.ReadFile(wantPath)
	if err != nil {
		t.Fatalf("%s: read golden: %v", name, err)
	}
	if err := json.Unmarshal(wantRaw, &want); err != nil {
		t.Fatalf("%s: decode golden: %v", name, err)
	}
	blankGeneratedAt(got)
	blankGeneratedAt(want)
	if msg, ok := deepDiff(name, got, want); !ok {
		t.Errorf("%s mismatch:\n%s", name, msg)
	}
}

func TestRunGolden(t *testing.T) {
	cacheDir := t.TempDir()
	copyDir(t, filepath.Join(fixturesDir, "detect-cache"), cacheDir)

	ghc := &failingGH{}
	res, err := Run(context.Background(), Options{
		SourcesDir: filepath.Join(fixturesDir, "detect-sources"),
		OutputDir:  t.TempDir(),
		IndexFile:  filepath.Join(fixturesDir, "index.json"),
		CacheDir:   cacheDir,
	}, Deps{GitHub: ghc})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	if ghc.calls != 0 {
		t.Errorf("expected zero live GitHub calls, got %d", ghc.calls)
	}

	rowsRaw, err := json.Marshal(res.Rows)
	if err != nil {
		t.Fatal(err)
	}
	assertJSONEqual(t, "rows", rowsRaw, "../../testdata/golden/expected/detection.json")

	patchRaw, err := json.Marshal(res.Patch)
	if err != nil {
		t.Fatal(err)
	}
	assertJSONEqual(t, "patch", patchRaw, "../../testdata/golden/expected/patch.json")

	reportRaw, err := json.Marshal(res.VariantReport)
	if err != nil {
		t.Fatal(err)
	}
	assertJSONEqual(t, "variantReport", reportRaw, "../../testdata/golden/expected/variant-report.json")

	if !strings.HasSuffix(res.VariantReport.GeneratedAt, "Z") {
		t.Errorf("generated_at not UTC ISO timestamp: %q", res.VariantReport.GeneratedAt)
	}
}

func TestSaveSourcesBuckets(t *testing.T) {
	sources, err := LoadSources(filepath.Join(fixturesDir, "detect-sources"))
	if err != nil {
		t.Fatal(err)
	}

	out := t.TempDir()
	if err := SaveSources(out, sources); err != nil {
		t.Fatal(err)
	}

	// sources-raw/*.json are captured per-strategy source files (inputs to
	// loadSources folding); compare bucket contents semantically.
	for _, name := range []string{"setup", "colorscheme", "builtin"} {
		gotRaw, err := os.ReadFile(filepath.Join(out, name+".json"))
		if err != nil {
			t.Fatalf("%s.json: %v", name, err)
		}
		wantRaw, err := os.ReadFile(filepath.Join(fixturesDir, "sources-raw", name+".json"))
		if err != nil {
			t.Fatal(err)
		}
		var gotSaved struct {
			Strategy string        `json:"strategy"`
			Count    int           `json:"count"`
			Themes   []theme.Entry `json:"themes"`
		}
		var wantFile struct {
			Strategy string        `json:"strategy"`
			Themes   []theme.Entry `json:"themes"`
		}
		if err := json.Unmarshal(gotRaw, &gotSaved); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(wantRaw, &wantFile); err != nil {
			t.Fatal(err)
		}
		sort.Slice(wantFile.Themes, func(i, j int) bool {
			return wantFile.Themes[i].Name < wantFile.Themes[j].Name
		})
		if gotSaved.Strategy != name {
			t.Errorf("%s.json: strategy %q", name, gotSaved.Strategy)
		}
		if gotSaved.Count != len(gotSaved.Themes) {
			t.Errorf("%s.json: count %d != len(themes) %d", name, gotSaved.Count, len(gotSaved.Themes))
		}
		gotJSON, _ := json.Marshal(gotSaved.Themes)
		wantJSON, _ := json.Marshal(wantFile.Themes)
		if string(gotJSON) != string(wantJSON) {
			t.Errorf("%s.json themes differ:\ngot:  %s\nwant: %s", name, gotJSON, wantJSON)
		}
	}
	if _, err := os.Stat(filepath.Join(out, "load.json")); !os.IsNotExist(err) {
		t.Errorf("load.json should not be written for empty bucket (err=%v)", err)
	}
}
func TestApplyDetectionPatch(t *testing.T) {
	sources, err := LoadSources(filepath.Join(fixturesDir, "detect-sources"))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(fixturesDir, "index.json"))
	if err != nil {
		t.Fatal(err)
	}
	var index []theme.Entry
	if err := json.Unmarshal(raw, &index); err != nil {
		t.Fatal(err)
	}

	var patch []PatchEntry
	patchRaw, err := os.ReadFile("../../testdata/golden/expected/patch.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(patchRaw, &patch); err != nil {
		t.Fatal(err)
	}

	updated := ApplyDetectionPatch(sources, patch, index)

	byRepo := map[string]string{}
	for _, e := range updated.Overrides {
		if e.Meta == nil || e.Meta.Strategy == nil {
			t.Errorf("override %s has no meta.strategy", e.Repo)
			continue
		}
		byRepo[e.Repo] = e.Meta.Strategy.Type
	}
	want := map[string]string{
		"catppuccin/nvim":          "setup",
		"navarasu/onedark.nvim":    "load",
		"srcery-colors/srcery-vim": "colorscheme",
		"folke/tokyonight.nvim":    "setup",
		"ellisonleao/gruvbox.nvim": "colorscheme",
		"embark/vim-embark":        "colorscheme",
		"morhetz/gruvbox":          "colorscheme",
		"rose-pine/neovim":         "setup",
	}
	if len(updated.Overrides) != len(want) {
		t.Fatalf("expected %d overrides, got %d", len(want), len(updated.Overrides))
	}
	for repo, strategy := range want {
		if byRepo[repo] != strategy {
			t.Errorf("repo %s: got strategy %q want %q", repo, byRepo[repo], strategy)
		}
	}
	if len(updated.Builtin) != 1 || updated.Builtin[0].Name != "default-dark" {
		t.Errorf("builtin bucket not preserved: %+v", updated.Builtin)
	}

	// Pure: input sources untouched.
	if sources.Overrides[1].Meta.Strategy.Type != "colorscheme" {
		t.Errorf("input sources mutated by ApplyDetectionPatch")
	}
}

func TestLoadHintsConflict(t *testing.T) {
	dir := t.TempDir()
	hints := `{"hints":[{"repo":"a/b","strategy":"setup"},{"repo":"a/b","strategy":"load"}]}`
	if err := os.WriteFile(filepath.Join(dir, "hints.json"), []byte(hints), 0o644); err != nil {
		t.Fatal(err)
	}
	_, _, err := LoadHintsData(dir)
	if err == nil {
		t.Fatal("expected conflict error")
	}
	wantSub := "Failed to load hints: Conflicting strategy hints for a/b: setup vs load"
	if !strings.Contains(err.Error(), wantSub) {
		t.Errorf("error %q does not contain %q", err.Error(), wantSub)
	}
}

func TestFiltersAndSample(t *testing.T) {
	cacheDir := t.TempDir()
	copyDir(t, filepath.Join(fixturesDir, "detect-cache"), cacheDir)
	opts := func(mutate func(*Options)) Options {
		o := Options{
			SourcesDir: filepath.Join(fixturesDir, "detect-sources"),
			OutputDir:  t.TempDir(),
			IndexFile:  filepath.Join(fixturesDir, "index.json"),
			CacheDir:   t.TempDir(),
		}
		copyDir(t, filepath.Join(fixturesDir, "detect-cache"), o.CacheDir)
		mutate(&o)
		return o
	}

	res, err := Run(context.Background(), opts(func(o *Options) { o.Sample = 2 }), Deps{GitHub: &failingGH{}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Rows) != 2 {
		t.Errorf("sample=2: got %d rows, want 2", len(res.Rows))
	}

	res, err = Run(context.Background(), opts(func(o *Options) { o.ThemeFilter = "gruvbox" }), Deps{GitHub: &failingGH{}})
	if err != nil {
		t.Fatal(err)
	}
	// First index entry named gruvbox is ellisonleao/gruvbox.nvim.
	if len(res.Rows) != 1 || res.Rows[0].Repo != "ellisonleao/gruvbox.nvim" {
		t.Errorf("theme filter: got %+v", res.Rows)
	}

	res, err = Run(context.Background(), opts(func(o *Options) { o.RepoFilter = "morhetz/gruvbox" }), Deps{GitHub: &failingGH{}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Rows) != 1 || res.Rows[0].Repo != "morhetz/gruvbox" {
		t.Errorf("repo filter: got %+v", res.Rows)
	}
}
