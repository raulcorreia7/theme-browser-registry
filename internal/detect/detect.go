package detect

import (
	"context"
	"errors"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// hardExcludedRepos mirrors the TS excludedRepos set.
var hardExcludedRepos = map[string]bool{"veekram/vim": true}

func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0o755)
}

// cachePath mirrors the TS cachePath: <base>/<kind>/<owner>__<repo>.<ext>.
func cachePath(base, kind, repo, ext string) string {
	slug := strings.Replace(repo, "/", "__", 1)
	return filepath.Join(base, kind, slug+"."+ext)
}

// findCurrentStrategy ports findCurrentStrategy: first override entry for the
// repo determines meta.strategy.type; "missing" when absent.
func findCurrentStrategy(repo string, sources Sources) string {
	for _, o := range sources.Overrides {
		if o.Repo == repo {
			if o.Meta != nil && o.Meta.Strategy != nil && o.Meta.Strategy.Type != "" {
				return o.Meta.Strategy.Type
			}
			return "missing"
		}
	}
	return "missing"
}

// fetchReadme ports fetchReadme: sqlite cache (when present and not
// noCache) -> <cacheDir>/readme/<owner>__<repo>.md -> live GitHub read,
// writing the file cache back on success.
func fetchReadme(ctx context.Context, repo string, d Deps, o Options) (string, error) {
	if d.Cache != nil && !o.NoCache {
		if cached, err := d.Cache.ReadReadme(repo); err == nil && cached != nil {
			return *cached, nil
		}
		// Cache errors fall through to the file cache like the TS catch.
	}

	cpath := cachePath(o.CacheDir, "readme", repo, "md")
	if !o.NoCache {
		if data, err := os.ReadFile(cpath); err == nil {
			return string(data), nil
		}
	}

	readme, err := d.GitHub.Readme(ctx, repo)
	if err != nil {
		return "", err
	}
	if readme == nil {
		return "", errors.New("README content missing")
	}

	if !o.NoCache {
		if err := writeJSONFileText(cpath, *readme); err != nil {
			return "", err
		}
	}
	return *readme, nil
}

func writeJSONFileText(path, content string) error {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

// fetchRepoTree ports fetchRepoTree: file cache -> live tree, caching the
// mapped {path,type} list as JSON.
func fetchRepoTree(ctx context.Context, repo string, d Deps, o Options) ([]gh.TreeItem, error) {
	cpath := cachePath(o.CacheDir, "tree", repo, "json")
	if !o.NoCache {
		var items []gh.TreeItem
		if err := readJSONFile(cpath, &items); err == nil {
			return items, nil
		}
	}

	tree, err := d.GitHub.Tree(ctx, repo, "HEAD")
	if err != nil {
		return nil, err
	}
	items := make([]gh.TreeItem, len(tree))
	copy(items, tree)

	if !o.NoCache {
		if err := writeJSONFile(cpath, items); err != nil {
			return nil, err
		}
	}
	return items, nil
}

// detectRepo ports detectRepo for one repo. All failures become a
// status:"error" row.
func detectRepo(ctx context.Context, repo string, repoThemes []theme.Entry, sources Sources, d Deps, o Options,
	strategyHints map[string]StrategyType, variantHints map[string]map[string]theme.Mode) Row {

	rowErr := func(err error) Row {
		return Row{
			Repo:             repo,
			ThemeNames:       uniqueThemeNames(repoThemes),
			CurrentStrategy:  findCurrentStrategy(repo, sources),
			DetectedStrategy: StrategyUnknown,
			Confidence:       0,
			Status:           StatusError,
			Signals:          []Signal{},
			Error:            err.Error(),
		}
	}

	readme, err := fetchReadme(ctx, repo, d, o)
	if err != nil {
		return rowErr(err)
	}
	det := theme.DetectFromText(readme)
	signals := toDetectSignals(det.Signals)

	if det.NeedsSourceInspection {
		tree, err := fetchRepoTree(ctx, repo, d, o)
		if err != nil {
			return rowErr(err)
		}
		src := theme.InspectSource(tree)

		signals = append(signals, toDetectSignals(src.Signals)...)

		// TS adoption rule; note src.Detected is always non-empty ("unknown"
		// included), which is truthy exactly like the TS check.
		if (det.Detected == string(StrategyUnknown) && src.Detected != "") ||
			(det.Confidence < HighConfidenceThreshold && src.Detected != "" && src.Detected != string(StrategyUnknown)) {
			det.Detected = src.Detected
			if src.Confidence > det.Confidence {
				det.Confidence = src.Confidence
			}
		}
	}

	if hinted, ok := strategyHints[repo]; ok {
		signals = append(signals, Signal{
			Strategy: hinted, Score: 10, Reason: "Manual hint override",
		})
		det.Detected = string(hinted)
		det.Confidence = 1.0
	}

	current := findCurrentStrategy(repo, sources)
	status := StatusMatch
	switch {
	case current == "missing":
		status = StatusMissingMeta
	case current != det.Detected:
		status = StatusMismatch
	}

	allVariants := []theme.Variant{}
	for _, t := range repoThemes {
		allVariants = append(allVariants, t.Variants...)
	}

	row := Row{
		Repo:             repo,
		ThemeNames:       uniqueThemeNames(repoThemes),
		CurrentStrategy:  current,
		DetectedStrategy: StrategyType(det.Detected),
		Confidence:       round2(det.Confidence),
		Status:           status,
		Signals:          signals,
	}

	if len(allVariants) > 0 {
		results := DetectVariantModesFromNames(allVariants)
		if hints, ok := variantHints[repo]; ok {
			results = ApplyVariantHints(results, hints)
		}
		withMode := 0
		for _, r := range results {
			if r.DetectedMode != "" {
				withMode++
			}
		}
		row.Variants = &VariantCoverage{
			Total:    len(allVariants),
			WithMode: withMode,
			Detected: results,
			Coverage: int(math.Round(float64(withMode) / float64(len(allVariants)) * 100)),
		}
	}

	return row
}

func toDetectSignals(in []theme.Signal) []Signal {
	out := make([]Signal, len(in))
	for i, s := range in {
		out[i] = Signal{Strategy: StrategyType(s.Strategy), Score: s.Score, Reason: s.Reason}
	}
	return out
}

func uniqueThemeNames(entries []theme.Entry) []string {
	seen := map[string]bool{}
	names := []string{}
	for _, t := range entries {
		if !seen[t.Name] {
			seen[t.Name] = true
			names = append(names, t.Name)
		}
	}
	return names
}

func round2(f float64) float64 {
	return math.Round(f*100) / 100
}

// GenerateVariantCoverageReport ports generateVariantCoverageReport.
func GenerateVariantCoverageReport(rows []Row) VariantCoverageReport {
	withVariants := []Row{}
	for _, r := range rows {
		if r.Variants != nil && r.Variants.Total > 0 {
			withVariants = append(withVariants, r)
		}
	}

	totalVariants, withMode := 0, 0
	bySource := ReportBySource{}
	for _, r := range withVariants {
		totalVariants += r.Variants.Total
		withMode += r.Variants.WithMode
		for _, v := range r.Variants.Detected {
			switch v.Source {
			case SourcePattern:
				bySource.Pattern++
			case SourceHint:
				bySource.Hint++
			case SourceReadme:
				bySource.Readme++
			default:
				bySource.Unknown++
			}
		}
	}

	attention := []RepoAttention{}
	for _, r := range withVariants {
		if r.Variants.Coverage >= 100 {
			continue
		}
		unknown := []string{}
		for _, v := range r.Variants.Detected {
			if v.DetectedMode == "" {
				unknown = append(unknown, v.Name)
			}
		}
		attention = append(attention, RepoAttention{
			Repo:            r.Repo,
			Total:           r.Variants.Total,
			WithMode:        r.Variants.WithMode,
			Coverage:        r.Variants.Coverage,
			UnknownVariants: unknown,
		})
	}
	sort.SliceStable(attention, func(i, j int) bool {
		return attention[i].Total > attention[j].Total
	})
	if len(attention) > 50 {
		attention = attention[:50]
	}

	coveragePercent := 0
	if totalVariants > 0 {
		coveragePercent = int(math.Round(float64(withMode) / float64(totalVariants) * 100))
	}

	return VariantCoverageReport{
		GeneratedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00"),
		Summary: ReportSummary{
			TotalReposWithVariants: len(withVariants),
			TotalVariants:          totalVariants,
			WithMode:               withMode,
			NeedDetection:          totalVariants - withMode,
			CoveragePercent:        coveragePercent,
		},
		BySource:              bySource,
		ReposNeedingAttention: attention,
	}
}

// Run ports run(): load index + sources + hints, filter repos, detect each
// repo concurrently (default 6), and assemble rows/patch/variant report.
func Run(ctx context.Context, o Options, d Deps) (Result, error) {
	if err := ensureDir(o.CacheDir); err != nil {
		return Result{}, err
	}
	if err := ensureDir(o.OutputDir); err != nil {
		return Result{}, err
	}

	var themes []theme.Entry
	if err := readJSONFile(o.IndexFile, &themes); err != nil {
		return Result{}, err
	}
	sources, err := LoadSources(o.SourcesDir)
	if err != nil {
		return Result{}, err
	}
	strategyHints, variantHints, err := LoadHintsData(o.SourcesDir)
	if err != nil {
		return Result{}, err
	}

	repoIndex := map[string][]theme.Entry{}
	var order []string
	for _, t := range themes {
		if t.Repo == "" {
			continue
		}
		if _, ok := repoIndex[t.Repo]; !ok {
			order = append(order, t.Repo)
		}
		repoIndex[t.Repo] = append(repoIndex[t.Repo], t)
	}

	repos := []string{}
	for _, r := range order {
		if !hardExcludedRepos[r] {
			repos = append(repos, r)
		}
	}
	sort.Strings(repos)
	if o.RepoFilter != "" {
		filtered := repos[:0]
		for _, r := range repos {
			if r == o.RepoFilter {
				filtered = append(filtered, r)
			}
		}
		repos = filtered
	}
	if o.ThemeFilter != "" {
		for _, t := range themes {
			if t.Name == o.ThemeFilter && t.Repo != "" {
				repos = []string{t.Repo}
				break
			}
		}
	}
	if o.Sample > 0 && o.Sample < len(repos) {
		repos = repos[:o.Sample]
	}

	concurrency := o.Concurrency
	if concurrency <= 0 {
		concurrency = 6
	}

	rows := make([]Row, len(repos))
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for i, repo := range repos {
		wg.Add(1)
		go func(i int, repo string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			rows[i] = detectRepo(ctx, repo, repoIndex[repo], sources, d, o, strategyHints, variantHints)
		}(i, repo)
	}
	wg.Wait()

	sort.SliceStable(rows, func(i, j int) bool {
		return lessCaseInsensitive(rows[i].Repo, rows[j].Repo)
	})

	patch := BuildPatch(rows)
	report := GenerateVariantCoverageReport(rows)

	return Result{Rows: rows, Patch: patch, VariantReport: report}, nil
}
