// Command registry is the one binary driving every registry pipeline stage,
// replacing the eight tasks/*.ts commander scripts.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/raulcorreia7/theme-browser-registry/internal/config"
	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
	"github.com/raulcorreia7/theme-browser-registry/internal/pipeline"
	"github.com/raulcorreia7/theme-browser-registry/internal/store"
	"github.com/spf13/cobra"
)

// Default paths mirror today's task CLIs exactly.
const (
	defaultConfig   = "config/registry.json"
	defaultIndex    = "artifacts/index.json"
	defaultThemes   = "artifacts/themes.json"
	defaultTop50    = "artifacts/themes-top-50.json"
	defaultManifest = "artifacts/manifest.json"
	defaultSources  = "config/sources"
	defaultReports  = "reports"
	defaultOverride = "config/overrides.json"
	defaultRegistry = "../plugin/lua/theme-browser/data/registry.json"
	defaultCount    = 50
)

type flags struct {
	config        string
	index         string
	themes        string
	top50         string
	manifest      string
	sources       string
	reports       string
	overrides     string
	registry      string
	count         int
	force         bool
	noCache       bool
	testing       bool
	noDetectApply bool
	minify        bool
}

func main() {
	root := &cobra.Command{
		Use:           "registry",
		Short:         "Theme registry pipeline tooling",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.PersistentFlags().StringVarP(&f.config, "config", "c", defaultConfig, "Config file")

	addSync(root)
	addDetect(root)
	addMerge(root)
	addBuild(root)
	addBundle(root)
	addManifest(root)
	addValidate(root)
	addPipeline(root)
	addPublish(root)
	addExport(root)

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

var f flags

func addSync(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "sync",
		Short: "Discover and index theme repositories",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load(f.config)
			github, cache, cleanup, err := openClients(cfg)
			if err != nil {
				return err
			}
			defer cleanup()
			stats, err := pipeline.Sync(cmd.Context(), cfg, f.force, github, cache)
			if err != nil {
				return err
			}
			return json.NewEncoder(os.Stdout).Encode(stats)
		},
	}
	cmd.Flags().StringVarP(&f.index, "index", "i", defaultIndex, "Index output")
	cmd.Flags().StringVarP(&f.manifest, "manifest", "m", defaultManifest, "Manifest output")
	cmd.Flags().BoolVarP(&f.force, "force", "f", false, "Force sync refresh")
	root.AddCommand(cmd)
}

func addDetect(root *cobra.Command) {
	var (
		sample      int
		repoFilter  string
		themeFilter string
		concurrency int
		apply       bool
	)
	cmd := &cobra.Command{
		Use:   "detect",
		Short: "Detect load strategies from READMEs and trees",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load(f.config)
			github, cache, cleanup, err := openClients(cfg)
			if err != nil {
				return err
			}
			defer cleanup()
			res, err := pipeline.Detect(cmd.Context(), pipeline.DetectOptions{
				SourcesDir:  f.sources,
				OutputDir:   f.reports,
				IndexFile:   f.index,
				CacheDir:    ".cache/theme-verifier",
				Sample:      sample,
				RepoFilter:  repoFilter,
				ThemeFilter: themeFilter,
				Apply:       apply,
				NoCache:     f.noCache,
				Concurrency: concurrency,
			}, github, cache)
			if err != nil {
				return err
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(res.Rows)
		},
	}
	cmd.Flags().StringVarP(&f.sources, "sources", "s", defaultSources, "Sources directory")
	cmd.Flags().StringVarP(&f.reports, "reports", "r", defaultReports, "Reports directory")
	cmd.Flags().StringVarP(&f.index, "index", "i", defaultIndex, "Index input")
	cmd.Flags().IntVar(&sample, "sample", 0, "Limit repos processed (0 = all)")
	cmd.Flags().StringVar(&repoFilter, "repo-filter", "", "Only detect this repo")
	cmd.Flags().StringVar(&themeFilter, "theme-filter", "", "Only detect this theme")
	cmd.Flags().IntVar(&concurrency, "concurrency", 6, "Worker concurrency")
	cmd.Flags().BoolVar(&apply, "apply", false, "Apply detection patch to source files")
	cmd.Flags().BoolVar(&f.noCache, "no-cache", false, "Disable detect cache")
	root.AddCommand(cmd)
}

func addMerge(root *cobra.Command) {
	var output string
	cmd := &cobra.Command{
		Use:   "merge",
		Short: "Merge strategy sources into the overrides artifact",
		RunE: func(cmd *cobra.Command, args []string) error {
			res, err := pipeline.Merge(f.sources, output)
			if err != nil {
				return err
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(map[string]any{"themes": res.Themes, "builtin": res.Builtin, "outputPath": res.OutputPath})
		},
	}
	cmd.Flags().StringVarP(&f.sources, "sources", "s", defaultSources, "Sources directory")
	cmd.Flags().StringVarP(&output, "overrides", "o", defaultOverride, "Overrides output")
	root.AddCommand(cmd)
}

func addBuild(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "build",
		Short: "Build the optimized themes artifact",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load(f.config)
			res, err := pipeline.Build(pipeline.BuildOptions{
				Index:          f.index,
				Overrides:      f.overrides,
				Output:         f.themes,
				Minify:         f.minify,
				PreferredRepos: cfg.Discovery.IncludeRepos,
			})
			if err != nil {
				return err
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(map[string]any{"themes": res.Themes, "variants": res.Variants, "size": res.Size, "outputPath": res.OutputPath})
		},
	}
	cmd.Flags().StringVarP(&f.index, "index", "i", defaultIndex, "Index input")
	cmd.Flags().StringVarP(&f.overrides, "overrides", "o", defaultOverride, "Overrides input")
	cmd.Flags().StringVarP(&f.themes, "themes", "O", defaultThemes, "Themes output")
	cmd.Flags().BoolVar(&f.minify, "minify", false, "Write minified JSON")
	root.AddCommand(cmd)
}

func addBundle(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "bundle",
		Short: "Select themes for the Lua plugin bundle",
		RunE: func(cmd *cobra.Command, args []string) error {
			res, err := pipeline.Bundle(pipeline.BundleOptions{Input: f.themes, Output: f.registry, Count: f.count})
			if err != nil {
				return err
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(map[string]any{"selected": res.Selected, "darkCount": res.DarkCount, "lightCount": res.LightCount, "outputPath": res.OutputPath})
		},
	}
	cmd.Flags().StringVarP(&f.themes, "input", "i", defaultThemes, "Themes input")
	cmd.Flags().StringVarP(&f.registry, "local-registry", "l", defaultRegistry, "Bundled registry output")
	cmd.Flags().IntVarP(&f.count, "count", "n", defaultCount, "Bundle count")
	root.AddCommand(cmd)
}

func addManifest(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "manifest",
		Short: "Write manifest.json with checksum for the themes artifact",
		RunE: func(cmd *cobra.Command, args []string) error {
			m, err := pipeline.WriteManifest(f.themes, f.manifest)
			if err != nil {
				return err
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(m)
		},
	}
	cmd.Flags().StringVarP(&f.themes, "themes", "i", defaultThemes, "Themes input")
	cmd.Flags().StringVarP(&f.manifest, "manifest", "m", defaultManifest, "Manifest output")
	root.AddCommand(cmd)
}

func addValidate(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "validate",
		Short: "Validate the themes artifact against publication gates",
		RunE: func(cmd *cobra.Command, args []string) error {
			res, err := pipeline.Validate(f.themes)
			if err != nil {
				return err
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			if err := enc.Encode(res); err != nil {
				return err
			}
			if !res.Passed {
				os.Exit(1)
			}
			return nil
		},
	}
	cmd.Flags().StringVarP(&f.themes, "input", "i", defaultThemes, "Themes input")
	root.AddCommand(cmd)
}

func addPipeline(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "pipeline",
		Short: "Run the full registry pipeline",
		RunE: func(cmd *cobra.Command, args []string) error {
			return pipeline.Pipeline(cmd.Context(), pipeline.PipelineOptions{
				Config:        f.config,
				Index:         f.index,
				Themes:        f.themes,
				Sources:       f.sources,
				Reports:       f.reports,
				Overrides:     f.overrides,
				Top50:         f.top50,
				Manifest:      f.manifest,
				LocalRegistry: f.registry,
				Count:         f.count,
				Force:         f.force,
				NoCache:       f.noCache,
				DetectApply:   !f.noDetectApply,
				Testing:       f.testing,
			})
		},
	}
	cmd.Flags().StringVarP(&f.index, "index", "i", defaultIndex, "Index output")
	cmd.Flags().StringVarP(&f.themes, "themes", "O", defaultThemes, "Themes output")
	cmd.Flags().StringVarP(&f.sources, "sources", "s", defaultSources, "Sources directory")
	cmd.Flags().StringVarP(&f.reports, "reports", "r", defaultReports, "Reports directory")
	cmd.Flags().StringVarP(&f.overrides, "overrides", "o", defaultOverride, "Overrides output")
	cmd.Flags().StringVarP(&f.top50, "top50", "t", defaultTop50, "Top themes output")
	cmd.Flags().StringVarP(&f.manifest, "manifest", "m", defaultManifest, "Manifest output")
	cmd.Flags().StringVarP(&f.registry, "local-registry", "l", defaultRegistry, "Bundled registry output")
	cmd.Flags().IntVarP(&f.count, "count", "n", defaultCount, "Top themes + bundle count")
	cmd.Flags().BoolVarP(&f.force, "force", "f", false, "Force sync refresh")
	cmd.Flags().BoolVar(&f.noCache, "no-cache", false, "Disable detect cache")
	cmd.Flags().BoolVar(&f.noDetectApply, "no-detect-apply", false, "Do not apply detect patch to source files")
	cmd.Flags().BoolVar(&f.testing, "testing", false, "Testing mode (isolated local outputs)")
	root.AddCommand(cmd)
}

func addPublish(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "publish",
		Short: "Sync once then commit+push artifacts per config.publish",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load(f.config)
			github, cache, cleanup, err := openClients(cfg)
			if err != nil {
				return err
			}
			defer cleanup()
			if _, err := pipeline.Sync(cmd.Context(), cfg, f.force, github, cache); err != nil {
				return err
			}
			if !cfg.Publish.Enabled {
				fmt.Fprintln(os.Stderr, "publish disabled in config; artifacts written locally only")
				return nil
			}
			files := []string{cfg.Output.Index, cfg.Output.Manifest}
			run := func(args ...string) error {
				c := exec.Command("git", args...)
				c.Stderr = os.Stderr
				return c.Run()
			}
			if err := run(append([]string{"add"}, files...)...); err != nil {
				return fmt.Errorf("git add: %w", err)
			}
			if err := run("commit", "-m", cfg.Publish.Git.Message); err != nil {
				return fmt.Errorf("git commit: %w", err)
			}
			if err := run("push", cfg.Publish.Git.Remote, fmt.Sprintf("HEAD:%s", cfg.Publish.Git.Branch)); err != nil {
				return fmt.Errorf("git push: %w", err)
			}
			fmt.Fprintf(os.Stderr, "Published %v to %s/%s\n", files, cfg.Publish.Git.Remote, cfg.Publish.Git.Branch)
			return nil
		},
	}
	cmd.Flags().BoolVarP(&f.force, "force", "f", false, "Force sync refresh")
	root.AddCommand(cmd)
}

func addExport(root *cobra.Command) {
	cmd := &cobra.Command{
		Use:   "export",
		Short: "Dump cache payloads as JSON",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load(f.config)
			cache, err := store.Open(cfg.Output.Cache)
			if err != nil {
				return err
			}
			defer cache.Close()
			entries, err := cache.ListPayloads()
			if err != nil {
				return err
			}
			enc := json.NewEncoder(os.Stdout)
			enc.SetIndent("", "  ")
			return enc.Encode(map[string]any{
				"exported_at": time.Now().UTC().Format(time.RFC3339Nano),
				"count":       len(entries),
				"entries":     entries,
			})
		},
	}
	root.AddCommand(cmd)
}

// openClients builds the live GitHub adapter and the sqlite cache shared by
// sync/detect/publish subcommands.
func openClients(cfg config.Config) (gh.Client, *store.Cache, func(), error) {
	github := gh.NewLiveClient(gh.LiveOptions{
		Delay:      time.Duration(cfg.GitHub.RateLimit.DelayMs) * time.Millisecond,
		RetryLimit: cfg.GitHub.RateLimit.RetryLimit,
	})
	cache, err := store.Open(cfg.Output.Cache)
	if err != nil {
		return nil, nil, nil, err
	}
	return github, cache, func() { _ = cache.Close() }, nil
}
