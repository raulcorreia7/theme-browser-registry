// Package config loads the registry pipeline configuration.
//
// Load mirrors the TypeScript loadConfig: a missing, unreadable, or malformed
// file falls back to defaults, unknown keys are ignored, and every invalid or
// absent leaf catches to its zod default. Unlike the TS schema, ExcludeRepos
// is a real field — the original zod schema silently stripped it.
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// Pagination bounds topic search.
type Pagination struct {
	PerPage          int `json:"perPage"`
	MaxPagesPerTopic int `json:"maxPagesPerTopic"`
}

// Discovery controls how repositories are found.
type Discovery struct {
	Topics       []string   `json:"topics"`
	IncludeRepos []string   `json:"includeRepos"`
	ExcludeRepos []string   `json:"excludeRepos"` // real field; the TS zod schema dropped it
	Pagination   Pagination `json:"pagination"`
}

// RateLimit is the GitHub request pacing configuration.
type RateLimit struct {
	DelayMs    int `json:"delayMs"`
	RetryLimit int `json:"retryLimit"`
}

// GitHub wraps GitHub client settings.
type GitHub struct {
	RateLimit RateLimit `json:"rateLimit"`
}

// Batch is the processing batch checkpoint settings.
type Batch struct {
	Size    int `json:"size"`
	PauseMs int `json:"pauseMs"`
}

// Processing controls worker pool and batch sizing.
type Processing struct {
	Batch          Batch `json:"batch"`
	Concurrency    int   `json:"concurrency"`
	MaxReposPerRun int   `json:"maxReposPerRun"`
}

// Dotfiles holds the dotfiles-repo heuristic token tables.
type Dotfiles struct {
	Enabled           bool     `json:"enabled"`
	Topics            []string `json:"topics"`
	NameTokens        []string `json:"nameTokens"`
	DescriptionTokens []string `json:"descriptionTokens"`
}

// Filters are the discovery-time repo filters.
type Filters struct {
	MinStars       int      `json:"minStars"`
	SkipArchived   bool     `json:"skipArchived"`
	SkipDisabled   bool     `json:"skipDisabled"`
	StaleAfterDays int      `json:"staleAfterDays"`
	Dotfiles       Dotfiles `json:"dotfiles"`
}

// Output paths of generated artifacts.
type Output struct {
	Index    string `json:"index"`
	Themes   string `json:"themes"`
	Manifest string `json:"manifest"`
	Cache    string `json:"cache"`
}

// Runtime settings for long-running invocations.
type Runtime struct {
	ScanIntervalSeconds int    `json:"scanIntervalSeconds"`
	LogLevel            string `json:"logLevel"` // DEBUG|INFO|WARNING|ERROR
}

// Sort is artifact row ordering.
type Sort struct {
	By    string `json:"by"`    // stars|updated_at|name
	Order string `json:"order"` // asc|desc
}

// PublishGit is the publish push target.
type PublishGit struct {
	Remote  string `json:"remote"`
	Branch  string `json:"branch"`
	Message string `json:"message"`
}

// Publish controls artifact publishing.
type Publish struct {
	Enabled bool       `json:"enabled"`
	Git     PublishGit `json:"git"`
}

// Config is the full registry configuration surface.
type Config struct {
	Version    string     `json:"version"`
	Discovery  Discovery  `json:"discovery"`
	GitHub     GitHub     `json:"github"`
	Processing Processing `json:"processing"`
	Filters    Filters    `json:"filters"`
	Output     Output     `json:"output"`
	Overrides  string     `json:"overrides"`
	Runtime    Runtime    `json:"runtime"`
	Sort       Sort       `json:"sort"`
	Publish    Publish    `json:"publish"`
}

var dotfileTopics = []string{"dotfiles", "dotfile", "nvim-config", "neovim-config", "vim-config", "vimrc"}

// Default returns the configuration identical to ConfigSchema.parse({}).
func Default() Config {
	return Config{
		Version: "2.0.0",
		Discovery: Discovery{
			Topics:       []string{"neovim-colorscheme", "nvim-theme", "vim-colorscheme"},
			IncludeRepos: []string{},
			ExcludeRepos: []string{},
			Pagination:   Pagination{PerPage: 100, MaxPagesPerTopic: 5},
		},
		GitHub: GitHub{RateLimit: RateLimit{DelayMs: 250, RetryLimit: 3}},
		Processing: Processing{
			Batch:          Batch{Size: 50, PauseMs: 0},
			Concurrency:    5,
			MaxReposPerRun: 0,
		},
		Filters: Filters{
			MinStars:       0,
			SkipArchived:   true,
			SkipDisabled:   true,
			StaleAfterDays: 14,
			Dotfiles: Dotfiles{
				Enabled:           true,
				Topics:            append([]string(nil), dotfileTopics...),
				NameTokens:        []string{"dotfiles", "dotfile"},
				DescriptionTokens: []string{"dotfiles", "dotfile"},
			},
		},
		Output: Output{
			Index:    "artifacts/index.json",
			Themes:   "artifacts/themes.json",
			Manifest: "artifacts/manifest.json",
			Cache:    ".state/indexer.db",
		},
		Overrides: "config/overrides.json",
		Runtime:   Runtime{ScanIntervalSeconds: 1800, LogLevel: "INFO"},
		Sort:      Sort{By: "stars", Order: "desc"},
		Publish: Publish{
			Enabled: false,
			Git: PublishGit{
				Remote:  "origin",
				Branch:  "master",
				Message: "chore(registry): publish latest index artifacts",
			},
		},
	}
}

// normalize re-applies per-field catches (bounds and enums) exactly like the
// zod .catch() clauses, so an out-of-range value falls back to its default.
func (c *Config) normalize() {
	d := Default()

	if len(c.Discovery.Topics) == 0 || c.Discovery.Topics == nil {
		c.Discovery.Topics = d.Discovery.Topics
	}
	if c.Discovery.IncludeRepos == nil {
		c.Discovery.IncludeRepos = []string{}
	}
	if c.Discovery.ExcludeRepos == nil {
		c.Discovery.ExcludeRepos = []string{}
	}
	if c.Discovery.Pagination.PerPage < 1 || c.Discovery.Pagination.PerPage > 100 {
		c.Discovery.Pagination.PerPage = 100
	}
	if c.Discovery.Pagination.MaxPagesPerTopic < 0 || c.Discovery.Pagination.MaxPagesPerTopic > 50 {
		c.Discovery.Pagination.MaxPagesPerTopic = 5
	}

	if c.GitHub.RateLimit.DelayMs < 0 {
		c.GitHub.RateLimit.DelayMs = 250
	}
	if c.GitHub.RateLimit.RetryLimit < 1 || c.GitHub.RateLimit.RetryLimit > 10 {
		c.GitHub.RateLimit.RetryLimit = 3
	}

	if c.Processing.Batch.Size < 1 {
		c.Processing.Batch.Size = 50
	}
	if c.Processing.Batch.PauseMs < 0 {
		c.Processing.Batch.PauseMs = 0
	}
	if c.Processing.Concurrency < 1 || c.Processing.Concurrency > 20 {
		c.Processing.Concurrency = 5
	}
	if c.Processing.MaxReposPerRun < 0 {
		c.Processing.MaxReposPerRun = 0
	}

	if c.Filters.MinStars < 0 {
		c.Filters.MinStars = 0
	}
	if c.Filters.StaleAfterDays < 1 {
		c.Filters.StaleAfterDays = 14
	}
	if c.Filters.Dotfiles.Topics == nil {
		c.Filters.Dotfiles.Topics = append([]string(nil), d.Filters.Dotfiles.Topics...)
	}
	if c.Filters.Dotfiles.NameTokens == nil {
		c.Filters.Dotfiles.NameTokens = d.Filters.Dotfiles.NameTokens
	}
	if c.Filters.Dotfiles.DescriptionTokens == nil {
		c.Filters.Dotfiles.DescriptionTokens = d.Filters.Dotfiles.DescriptionTokens
	}

	switch c.Sort.By {
	case "stars", "updated_at", "name":
	default:
		c.Sort.By = "stars"
	}
	switch c.Sort.Order {
	case "asc", "desc":
	default:
		c.Sort.Order = "desc"
	}

	c.Runtime.LogLevel = strings.ToUpper(c.Runtime.LogLevel)
	switch c.Runtime.LogLevel {
	case "DEBUG", "INFO", "WARNING", "ERROR":
	default:
		c.Runtime.LogLevel = "INFO"
	}
	if c.Runtime.ScanIntervalSeconds < 60 {
		c.Runtime.ScanIntervalSeconds = 1800
	}
}

// Load reads the JSON config at path. A missing, unreadable, malformed, or
// non-object file falls back to defaults (matching loadConfig); unknown keys
// are ignored; invalid values catch to defaults.
func Load(path string) Config {
	cfg := Default()

	content, err := os.ReadFile(path)
	if err != nil {
		return cfg
	}

	// Reject non-object roots before unmarshal so arrays/scalars keep defaults.
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(content, &probe); err != nil {
		return cfg
	}
	if err := json.Unmarshal(content, &cfg); err != nil {
		return cfg
	}
	cfg.normalize()
	return cfg
}

// EnsureDir creates the parent directory of path (used by cache/db setup).
func EnsureDir(path string) error {
	return os.MkdirAll(filepath.Dir(path), 0o755)
}
