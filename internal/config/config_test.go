package config

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func writeTemp(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "registry.json")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLoadDefaults(t *testing.T) {
	cfg := Load(filepath.Join(t.TempDir(), "missing.json"))
	want := Default()
	if !reflect.DeepEqual(cfg, want) {
		t.Fatalf("missing file should yield defaults:\n got %+v\nwant %+v", cfg, want)
	}
}

func TestLoadExcludeReposSurvives(t *testing.T) {
	path := writeTemp(t, `{
		"discovery": {
			"topics": ["nvim-theme"],
			"excludeRepos": ["veekram/vim", "cvusmo/blackbeard-nvim"]
		}
	}`)
	cfg := Load(path)
	got := cfg.Discovery.ExcludeRepos
	want := []string{"veekram/vim", "cvusmo/blackbeard-nvim"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("excludeRepos stripped: got %v want %v", got, want)
	}
}

func TestLoadMalformedFallsBack(t *testing.T) {
	for _, content := range []string{
		`{broken`,
		`[1,2,3]`,
		`"just a string"`,
		`null`,
	} {
		cfg := Load(writeTemp(t, content))
		if !reflect.DeepEqual(cfg, Default()) {
			t.Fatalf("malformed %q should fall back to defaults, got %+v", content, cfg)
		}
	}
}

func TestLoadUnknownKeysIgnored(t *testing.T) {
	cfg := Load(writeTemp(t, `{"version":"3.0.0","bogus":{"x":1}}`))
	if cfg.Version != "3.0.0" {
		t.Fatalf("known key not loaded: %q", cfg.Version)
	}
}

func TestInvalidValuesCatchToDefaults(t *testing.T) {
	cfg := Load(writeTemp(t, `{
		"github": {"rateLimit": {"delayMs": -5, "retryLimit": 99}},
		"discovery": {"pagination": {"perPage": 0}},
		"processing": {"concurrency": 500},
		"runtime": {"logLevel": "debug", "scanIntervalSeconds": 1},
		"sort": {"by": "nope", "order": "sideways"},
		"filters": {"staleAfterDays": 0}
	}`))
	if cfg.GitHub.RateLimit.DelayMs != 250 || cfg.GitHub.RateLimit.RetryLimit != 3 {
		t.Fatalf("rateLimit catches wrong: %+v", cfg.GitHub.RateLimit)
	}
	if cfg.Discovery.Pagination.PerPage != 100 {
		t.Fatalf("perPage catch wrong: %d", cfg.Discovery.Pagination.PerPage)
	}
	if cfg.Processing.Concurrency != 5 {
		t.Fatalf("concurrency catch wrong: %d", cfg.Processing.Concurrency)
	}
	if cfg.Runtime.LogLevel != "DEBUG" {
		t.Fatalf("logLevel uppercase preprocess failed: %q", cfg.Runtime.LogLevel)
	}
	if cfg.Runtime.ScanIntervalSeconds != 1800 {
		t.Fatalf("scanIntervalSeconds catch wrong: %d", cfg.Runtime.ScanIntervalSeconds)
	}
	if cfg.Sort.By != "stars" || cfg.Sort.Order != "desc" {
		t.Fatalf("sort catches wrong: %+v", cfg.Sort)
	}
	if cfg.Filters.StaleAfterDays != 14 {
		t.Fatalf("staleAfterDays catch wrong: %d", cfg.Filters.StaleAfterDays)
	}
}

func TestPartialConfigKeepsDefaults(t *testing.T) {
	cfg := Load(writeTemp(t, `{"output": {"index": "custom/index.json"}}`))
	if cfg.Output.Index != "custom/index.json" {
		t.Fatalf("index override lost: %q", cfg.Output.Index)
	}
	if cfg.Output.Themes != "artifacts/themes.json" {
		t.Fatalf("sibling default lost: %q", cfg.Output.Themes)
	}
}

func TestDefaultMatchesTSZodDefaults(t *testing.T) {
	d := Default()
	if d.Version != "2.0.0" ||
		d.Overrides != "config/overrides.json" ||
		d.Processing.Batch.Size != 50 ||
		d.Filters.MinStars != 0 ||
		d.Publish.Enabled ||
		d.Publish.Git.Branch != "master" {
		t.Fatalf("defaults drifted from zod schema: %+v", d)
	}
}
