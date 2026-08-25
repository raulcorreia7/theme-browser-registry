package pipeline

// pipeline.go composes the eight stages exactly like tasks/pipeline.ts, with
// identical --testing output redirections and "Step N/8:" logging to stderr.

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/raulcorreia7/theme-browser-registry/internal/config"
	"github.com/raulcorreia7/theme-browser-registry/internal/detect"
	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
	"github.com/raulcorreia7/theme-browser-registry/internal/store"
	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

type PipelineOptions struct {
	Config        string
	Index         string
	Themes        string
	Sources       string
	Reports       string
	Overrides     string
	Top50         string
	Manifest      string
	LocalRegistry string
	Count         int
	Force         bool
	NoCache       bool
	DetectApply   bool
	Testing       bool
}

func stepf(n int, name string) {
	fmt.Fprintf(os.Stderr, "Step %d/8: %s\n", n, name)
}

func msDuration(ms int) time.Duration {
	return time.Duration(ms) * time.Millisecond
}

// Pipeline runs sync → detect → merge → build → top50(rank) → bundle →
// manifest → validate. In testing mode outputs redirect to artifacts/testing/*
// and reports/testing/, the detect patch is never applied, and the indexer
// cache moves to .state/indexer.testing.db.
func Pipeline(ctx context.Context, o PipelineOptions) error {
	if o.Testing {
		o.Index = "artifacts/testing/index.json"
		o.Themes = "artifacts/testing/themes.json"
		o.Top50 = "artifacts/testing/themes-top-50.json"
		o.Manifest = "artifacts/testing/manifest.json"
		o.Overrides = "artifacts/testing/overrides.json"
		o.Reports = "reports/testing"
		o.LocalRegistry = "artifacts/testing/registry.json"
		if o.DetectApply {
			fmt.Fprintln(os.Stderr, "testing mode enabled: detect patch apply disabled to avoid mutating source files")
		}
		o.DetectApply = false
	}

	cfg := config.Load(o.Config)
	cfg.Output.Index = o.Index
	cfg.Output.Themes = o.Themes
	cfg.Output.Manifest = o.Manifest
	cfg.Overrides = o.Overrides
	if o.Testing {
		cfg.Output.Cache = ".state/indexer.testing.db"
	}

	stepf(1, "sync")
	syncCache, err := store.Open(cfg.Output.Cache)
	if err != nil {
		return err
	}
	github := gh.NewLiveClient(gh.LiveOptions{
		Delay:      msDuration(cfg.GitHub.RateLimit.DelayMs),
		RetryLimit: cfg.GitHub.RateLimit.RetryLimit,
	})
	syncStats, syncErr := Sync(ctx, cfg, o.Force, github, syncCache)
	if cerr := syncCache.Close(); syncErr == nil && cerr != nil {
		syncErr = cerr
	}
	if syncErr != nil {
		return fmt.Errorf("sync: %w", syncErr)
	}
	fmt.Fprintf(os.Stderr, "Synced %d themes (fetched=%d, cached=%d, errors=%d)\n",
		syncStats.Written, syncStats.Fetched, syncStats.Cached, syncStats.Errors)

	stepf(2, "detect")
	if err := os.MkdirAll(o.Reports, 0o755); err != nil {
		return err
	}
	var detectCache *store.Cache
	if !o.NoCache {
		detectCache, err = store.Open(".cache/registry.db")
		if err != nil {
			return err
		}
	}
	detectRes, derr := Detect(ctx, DetectOptions{
		SourcesDir: o.Sources,
		OutputDir:  o.Reports,
		IndexFile:  o.Index,
		CacheDir:   ".cache/theme-verifier",
		NoCache:    o.NoCache,
	}, github, detectCache)
	if detectCache != nil {
		detectCache.Close()
	}
	if derr != nil {
		return fmt.Errorf("detect: %w", derr)
	}

	if o.DetectApply && len(detectRes.Patch) > 0 {
		rawIndex, rerr := os.ReadFile(o.Index)
		if rerr != nil {
			return rerr
		}
		var indexEntries []theme.Entry
		if jerr := json.Unmarshal(rawIndex, &indexEntries); jerr != nil {
			return jerr
		}
		sources, serr := detect.LoadSources(o.Sources)
		if serr != nil {
			return serr
		}
		updated := detect.ApplyDetectionPatch(sources, detectRes.Patch, indexEntries)
		if serr := detect.SaveSources(o.Sources, updated); serr != nil {
			return serr
		}
		fmt.Fprintf(os.Stderr, "Applied detect patch to %s\n", o.Sources)
	}
	fmt.Fprintln(os.Stderr, "Detect complete")

	stepf(3, "merge")
	mergeRes, err := Merge(o.Sources, o.Overrides)
	if err != nil {
		return fmt.Errorf("merge: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Merged %d themes + %d builtin\n", mergeRes.Themes, mergeRes.Builtin)

	stepf(4, "build")
	buildRes, err := Build(BuildOptions{
		Index:          o.Index,
		Overrides:      o.Overrides,
		Output:         o.Themes,
		PreferredRepos: cfg.Discovery.IncludeRepos,
	})
	if err != nil {
		return fmt.Errorf("build: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Built themes=%d, variants=%d, size=%.1fKB\n",
		buildRes.Themes, buildRes.Variants, float64(buildRes.Size)/1024)

	stepf(5, "top50")
	topCount, err := writeTopThemes(o.Themes, o.Top50, o.Count)
	if err != nil {
		return fmt.Errorf("top50: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Top themes generated: %d\n", topCount)

	stepf(6, "bundle")
	bundleRes, err := Bundle(BundleOptions{Input: o.Themes, Output: o.LocalRegistry, Count: o.Count})
	if err != nil {
		return fmt.Errorf("bundle: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Bundled selected=%d dark=%d light=%d\n",
		bundleRes.Selected, bundleRes.DarkCount, bundleRes.LightCount)

	stepf(7, "manifest")
	manifest, err := WriteManifest(o.Themes, o.Manifest)
	if err != nil {
		return fmt.Errorf("manifest: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Manifest version=%s count=%d\n", manifest.Version, manifest.Count)

	stepf(8, "validate")
	vr, err := Validate(o.Themes)
	if err != nil {
		return fmt.Errorf("validate: %w", err)
	}
	for _, e := range vr.Errors {
		fmt.Fprintln(os.Stderr, e)
	}
	if !vr.Passed {
		return fmt.Errorf("validation failed with %d error(s)", len(vr.Errors))
	}
	fmt.Fprintln(os.Stderr, "Validation passed")

	fmt.Fprintln(os.Stderr, "Pipeline complete")
	fmt.Fprintf(os.Stderr, "  index: %s\n  themes: %s\n  top50: %s\n  local registry: %s\n  manifest: %s\n",
		o.Index, o.Themes, o.Top50, o.LocalRegistry, o.Manifest)
	return nil
}

// writeTopThemes ports tasks/pipeline.ts writeTopThemes via Rank.
func writeTopThemes(inputPath, outputPath string, count int) (int, error) {
	raw, err := os.ReadFile(inputPath)
	if err != nil {
		return 0, err
	}
	var rows []theme.Output
	if err := json.Unmarshal(raw, &rows); err != nil {
		return 0, err
	}
	ranked := Rank(rows, count)
	if dir := filepath.Dir(outputPath); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return 0, err
		}
	}
	if err := writeJSON(outputPath, ranked); err != nil {
		return 0, err
	}
	return len(ranked), nil
}
