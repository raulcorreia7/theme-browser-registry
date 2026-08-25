package pipeline

// detect.go wraps the sibling-owned internal/detect package (ported from
// src/detect/*).

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/raulcorreia7/theme-browser-registry/internal/detect"
	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
	"github.com/raulcorreia7/theme-browser-registry/internal/store"
)

// runDetect is the single call site into internal/detect (integration seam).
func runDetect(ctx context.Context, o detect.Options, d detect.Deps) (detect.Result, error) {
	return detect.Run(ctx, o, d)
}

type DetectOptions struct {
	SourcesDir  string
	OutputDir   string
	IndexFile   string
	CacheDir    string
	Sample      int
	RepoFilter  string
	ThemeFilter string
	Apply       bool
	NoCache     bool
	Concurrency int // zero value = TS default 6
}

type DetectResult struct {
	Rows          []detect.Row
	Patch         []detect.PatchEntry
	VariantReport detect.VariantCoverageReport
}

// Detect runs strategy detection over the index and writes detection.json and
// variant-coverage.json into o.OutputDir (the TS pipeline wrote these reports).
func Detect(ctx context.Context, o DetectOptions, client gh.Client, cache *store.Cache) (DetectResult, error) {
	res, err := runDetect(ctx, detect.Options{
		SourcesDir:  o.SourcesDir,
		OutputDir:   o.OutputDir,
		IndexFile:   o.IndexFile,
		CacheDir:    o.CacheDir,
		Sample:      o.Sample,
		RepoFilter:  o.RepoFilter,
		ThemeFilter: o.ThemeFilter,
		Apply:       o.Apply,
		NoCache:     o.NoCache,
		Concurrency: o.Concurrency,
	}, detect.Deps{GitHub: client, Cache: cache})
	if err != nil {
		return DetectResult{}, err
	}

	if err := writeJSON(filepath.Join(o.OutputDir, "detection.json"), res.Rows); err != nil {
		return DetectResult{}, fmt.Errorf("write detection report: %w", err)
	}
	if err := writeJSON(filepath.Join(o.OutputDir, "variant-coverage.json"), res.VariantReport); err != nil {
		return DetectResult{}, fmt.Errorf("write variant coverage report: %w", err)
	}

	return DetectResult{Rows: res.Rows, Patch: res.Patch, VariantReport: res.VariantReport}, nil
}
