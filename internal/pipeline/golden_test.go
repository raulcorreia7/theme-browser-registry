package pipeline

// golden_test.go replays merge → build → rank → bundle → manifest → validate
// over the TS-captured fixtures and compares outputs against
// testdata/golden/expected byte-for-byte (generated_at frozen via the clock
// seam). The captured Merge output lives at fixtures/detect-sources/
// overrides.json; it is compared semantically because JSON key order in that
// capture follows the source files' original key order.

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

const goldenDir = "../../testdata/golden"

func readGolden(t *testing.T, rel string) []byte {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(goldenDir, rel))
	if err != nil {
		t.Fatalf("read golden %s: %v", rel, err)
	}
	return b
}

func assertBytesEqual(t *testing.T, name string, got, want []byte) {
	t.Helper()
	if bytes.Equal(got, want) {
		return
	}
	// Fall back to a normalized decode-compare to report semantic vs
	// formatting differences precisely.
	var g, w any
	gErr := json.Unmarshal(got, &g)
	wErr := json.Unmarshal(want, &w)
	if gErr == nil && wErr == nil && normalizeJSON(g) == normalizeJSON(w) {
		t.Errorf("%s: bytes differ but content matches (formatting drift)\n got: %s\nwant: %s", name, got[:min(len(got), 200)], want[:min(len(want), 200)])
		return
	}
	t.Errorf("%s: content mismatch\n got: %s\nwant: %s", name, got[:min(len(got), 400)], want[:min(len(want), 400)])
}

// normalizeJSON renders decoded JSON deterministically so key order and float
// representation do not mask real differences.
func normalizeJSON(v any) string {
	// encoding/json emits map keys sorted, making the round-trip canonical.
	b, err := json.Marshal(v)
	if err != nil {
		return "<unmarshalable>"
	}
	return string(b)
}

func TestGoldenPipeline(t *testing.T) {
	dir := t.TempDir()

	// Mirror the real layout: <dir>/config/sources/* with overrides written to
	// <dir>/config/overrides.json so Build resolves hints from
	// <dir>/config/sources/hints.json (src/lib/sources.ts ladder).
	sourcesDir := filepath.Join(dir, "config", "sources")
	if err := os.MkdirAll(sourcesDir, 0o755); err != nil {
		t.Fatal(err)
	}
	rawSources, err := os.ReadDir(filepath.Join(goldenDir, "fixtures", "sources-raw"))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range rawSources {
		b, err := os.ReadFile(filepath.Join(goldenDir, "fixtures", "sources-raw", e.Name()))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(sourcesDir, e.Name()), b, 0o644); err != nil {
			t.Fatal(err)
		}
	}

	fixtures := func(rel string) string { return filepath.Join(goldenDir, "fixtures", rel) }
	overridesPath := filepath.Join(dir, "config", "overrides.json")
	themesPath := filepath.Join(dir, "themes.json")
	top50Path := filepath.Join(dir, "themes-top-50.json")
	bundlePath := filepath.Join(dir, "registry.json")
	manifestPath := filepath.Join(dir, "manifest.json")

	// Step 3: merge.
	if _, err := Merge(fixtures("sources-raw"), overridesPath); err != nil {
		t.Fatalf("merge: %v", err)
	}
	// The capture preserves the source files' original key order (name, repo,
	// colorscheme) while typed theme.Entry marshalling fixes name, colorscheme,
	// repo. Content is identical; compare semantically.
	var gotOv, wantOv any
	if err := json.Unmarshal(mustRead(t, overridesPath), &gotOv); err != nil {
		t.Fatal(err)
	}
	wantBytes := readGolden(t, "fixtures/detect-sources/overrides.json")
	if err := json.Unmarshal(wantBytes, &wantOv); err != nil {
		t.Fatal(err)
	}
	if normalizeJSON(gotOv) != normalizeJSON(wantOv) {
		t.Errorf("overrides.json semantic mismatch\n got: %s\nwant: %s", mustRead(t, overridesPath), wantBytes)
	}

	// Step 4: build.
	if _, err := Build(BuildOptions{
		Index:     fixtures("index.json"),
		Overrides: overridesPath,
		Output:    themesPath,
	}); err != nil {
		t.Fatalf("build: %v", err)
	}
	assertBytesEqual(t, "themes.json", readGolden(t, "expected/themes.json"), mustRead(t, themesPath))

	// Step 5: rank(8).
	var rows []theme.Output
	rawThemes := mustRead(t, themesPath)
	if err := json.Unmarshal(rawThemes, &rows); err != nil {
		t.Fatal(err)
	}
	ranked := Rank(rows, 8)
	rankedBytes, err := json.MarshalIndent(ranked, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	rankedBytes = append(rankedBytes, '\n')
	assertBytesEqual(t, "themes-top-50.json", readGolden(t, "expected/themes-top-50.json"), rankedBytes)
	if err := os.WriteFile(top50Path, rankedBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	// Step 6: bundle(8).
	if _, err := Bundle(BundleOptions{Input: themesPath, Output: bundlePath, Count: 8}); err != nil {
		t.Fatalf("bundle: %v", err)
	}
	assertBytesEqual(t, "registry-bundle.json", readGolden(t, "expected/registry-bundle.json"), mustRead(t, bundlePath))

	// Step 7: manifest with frozen clock (1970-01-01T00:00:00.000Z).
	prevNow := now
	now = func() time.Time { return time.Unix(0, 0) }
	defer func() { now = prevNow }()
	if _, err := WriteManifest(themesPath, manifestPath); err != nil {
		t.Fatalf("manifest: %v", err)
	}
	wantManifest := readGolden(t, "expected/manifest.json")
	gotManifest := mustRead(t, manifestPath)
	var wm, gm theme.Manifest
	if json.Unmarshal(wantManifest, &wm) != nil || json.Unmarshal(gotManifest, &gm) != nil {
		t.Fatal("manifest decode failed")
	}
	if wm != gm {
		t.Errorf("manifest mismatch:\n got: %+v\nwant: %+v", gm, wm)
	}
	if !bytes.Equal(gotManifest, wantManifest) {
		t.Errorf("manifest bytes differ:\n got: %s\nwant: %s", gotManifest, wantManifest)
	}

	// Step 8: validate.
	vr, err := Validate(themesPath)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	vrBytes, err := json.MarshalIndent(vr, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	vrBytes = append(vrBytes, '\n')
	assertBytesEqual(t, "validation.json", readGolden(t, "expected/validation.json"), vrBytes)
}

func mustRead(t *testing.T, path string) []byte {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return b
}
