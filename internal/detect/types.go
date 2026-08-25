// Package detect ports src/detect (index.ts, types.ts, variant.ts) from the
// TypeScript pipeline. Strategy scoring itself lives in internal/theme
// (DetectFromText/InspectSource); this package orchestrates caches, hints,
// statuses, patching and reporting around them.
package detect

import (
	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
	"github.com/raulcorreia7/theme-browser-registry/internal/store"
	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// StrategyType is the detection strategy vocabulary from src/detect/types.ts.
type StrategyType string

const (
	StrategySetup       StrategyType = "setup"
	StrategyLoad        StrategyType = "load"
	StrategyColorscheme StrategyType = "colorscheme"
	StrategyFile        StrategyType = "file"
	StrategyUnknown     StrategyType = "unknown"
)

const (
	// HighConfidenceThreshold mirrors CONFIG.HIGH_CONFIDENCE_THRESHOLD.
	HighConfidenceThreshold = 0.9
	// MinConfidenceThreshold mirrors CONFIG.MIN_CONFIDENCE_THRESHOLD.
	MinConfidenceThreshold = 0.5
)

// Status values for Row.Status.
const (
	StatusMatch       = "match"
	StatusMismatch    = "mismatch"
	StatusMissingMeta = "missing-meta"
	StatusError       = "error"
)

// Signal is one scored heuristic hit (DetectionSignal).
type Signal struct {
	Strategy StrategyType `json:"strategy"`
	Score    float64      `json:"score"`
	Reason   string       `json:"reason"`
}

// VariantModeResult is the per-variant mode detection outcome
// (VariantModeResult in types.ts).
type VariantModeResult struct {
	Name         string     `json:"name"`
	DetectedMode theme.Mode `json:"detectedMode,omitempty"`
	Confidence   float64    `json:"confidence"`
	Source       string     `json:"source"` // pattern | hint | readme | unknown
	Reason       string     `json:"reason,omitempty"`
}

// VariantCoverage is the ExtendedDetectionRow variants block.
type VariantCoverage struct {
	Total    int                 `json:"total"`
	WithMode int                 `json:"withMode"`
	Detected []VariantModeResult `json:"detected"`
	Coverage int                 `json:"coverage"` // percent 0-100
}

// Row is one repo's detection row (ExtendedDetectionRow).
type Row struct {
	Repo             string           `json:"repo"`
	ThemeNames       []string         `json:"themeNames"`
	CurrentStrategy  string           `json:"currentStrategy"` // StrategyType or "missing"
	DetectedStrategy StrategyType     `json:"detectedStrategy"`
	Confidence       float64          `json:"confidence"`
	Status           string           `json:"status"` // match | mismatch | missing-meta | error
	Signals          []Signal         `json:"signals"`
	Error            string           `json:"error,omitempty"`
	Variants         *VariantCoverage `json:"variants,omitempty"`
}

// PatchEntry is one actionable strategy fix (PatchEntry).
type PatchEntry struct {
	Repo       string       `json:"repo"`
	Strategy   StrategyType `json:"strategy"`
	Confidence float64      `json:"confidence"`
}

// Options mirrors DetectOptions; zero values mean TS defaults
// (Concurrency 0 -> 6).
type Options struct {
	SourcesDir  string
	OutputDir   string
	IndexFile   string
	CacheDir    string
	Sample      int
	RepoFilter  string // TS option "repo"
	ThemeFilter string // TS option "theme"
	Apply       bool
	NoCache     bool
	Concurrency int
}

// Deps carries the injected collaborators (DetectDeps). A nil Cache means
// no sqlite cache, matching the TS `cache: RepoCache | null`.
type Deps struct {
	GitHub gh.Client
	Cache  *store.Cache
}

// ReportSummary is the variant coverage summary block.
type ReportSummary struct {
	TotalReposWithVariants int `json:"total_repos_with_variants"`
	TotalVariants          int `json:"total_variants"`
	WithMode               int `json:"with_mode"`
	NeedDetection          int `json:"need_detection"`
	CoveragePercent        int `json:"coverage_percent"`
}

// ReportBySource counts detected variant modes by their source.
type ReportBySource struct {
	Pattern int `json:"pattern"`
	Hint    int `json:"hint"`
	Readme  int `json:"readme"`
	Unknown int `json:"unknown"`
}

// RepoAttention is one entry of repos_needing_attention.
type RepoAttention struct {
	Repo            string   `json:"repo"`
	Total           int      `json:"total"`
	WithMode        int      `json:"withMode"`
	Coverage        int      `json:"coverage"`
	UnknownVariants []string `json:"unknownVariants"`
}

// VariantCoverageReport is the report written to reports/detection/
// (VariantCoverageReport).
type VariantCoverageReport struct {
	GeneratedAt           string          `json:"generated_at"`
	Summary               ReportSummary   `json:"summary"`
	BySource              ReportBySource  `json:"by_source"`
	ReposNeedingAttention []RepoAttention `json:"repos_needing_attention"`
}

// Result is the run output (DetectResult).
type Result struct {
	Rows          []Row                 `json:"rows"`
	Patch         []PatchEntry          `json:"patch"`
	VariantReport VariantCoverageReport `json:"variantReport"`
}
