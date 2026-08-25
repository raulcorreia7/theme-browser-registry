package pipeline

// sync.go ports the src/sync/indexer.ts discovery walk: topic pagination,
// includeRepos whitelist, dotfiles heuristics with exact regexes,
// excludeRepos post-discovery deletion, an errgroup worker pool sized by
// processing.concurrency, and per-batch checkpoints writing index + manifest.
// RunLoop (watch) is intentionally NOT ported.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/raulcorreia7/theme-browser-registry/internal/config"
	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
	"github.com/raulcorreia7/theme-browser-registry/internal/store"
	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
	"golang.org/x/sync/errgroup"
)

type SyncStats struct {
	Discovered int `json:"discovered"`
	Scheduled  int `json:"scheduled"`
	Batches    int `json:"batches"`
	Fetched    int `json:"fetched"`
	Cached     int `json:"cached"`
	Errors     int `json:"errors"`
	Written    int `json:"written"`
}

var (
	reGitSuffix              = regexp.MustCompile(`\.git$`)
	reLeadingTrailingSlashes = regexp.MustCompile(`^/+|/+$`)
	reWhitespaceUnderscore   = regexp.MustCompile(`[\s_]+`)
	reRegexEscape            = regexp.MustCompile(`[.*+?^${}()|[\]\\]`)
)

var defaultDotfilesTopics = []string{
	"dotfiles", "dotfile", "nvim-config", "neovim-config", "vim-config", "vimrc",
}
var defaultDotfilesNameTokens = []string{"dotfiles", "dotfile"}
var defaultDotfilesDescriptionTokens = []string{"dotfiles", "dotfile"}

type dotfilesHeuristics struct {
	enabled           bool
	topics            map[string]bool
	nameTokens        []string
	descriptionTokens []string
}

func safeRepo(repo string) string {
	repo = strings.TrimSpace(repo)
	repo = reGitSuffix.ReplaceAllString(repo, "")
	return reLeadingTrailingSlashes.ReplaceAllString(repo, "")
}

func normalizeTopic(topic string) string {
	return reWhitespaceUnderscore.ReplaceAllString(strings.ToLower(strings.TrimSpace(topic)), "-")
}

func normalizeTokenList(values, fallback []string) []string {
	source := fallback
	if values != nil {
		source = values
	}
	set := map[string]bool{}
	var out []string
	for _, raw := range source {
		v := strings.ToLower(strings.TrimSpace(raw))
		if v != "" && !set[v] {
			set[v] = true
			out = append(out, v)
		}
	}
	return out
}

// resolveDotfilesHeuristics mirrors resolveDotfilesHeuristics in indexer.ts:
// topics pass through normalizeTokenList then normalizeTopic; name and
// description tokens only through normalizeTokenList.
func resolveDotfilesHeuristics(cfg config.Config) dotfilesHeuristics {
	d := cfg.Filters.Dotfiles
	h := dotfilesHeuristics{
		enabled:           d.Enabled,
		topics:            map[string]bool{},
		nameTokens:        normalizeTokenList(d.NameTokens, defaultDotfilesNameTokens),
		descriptionTokens: normalizeTokenList(d.DescriptionTokens, defaultDotfilesDescriptionTokens),
	}
	for _, t := range normalizeTokenList(d.Topics, defaultDotfilesTopics) {
		h.topics[normalizeTopic(t)] = true
	}
	return h
}

func escapeRegex(v string) string {
	return reRegexEscape.ReplaceAllString(v, "\\$&")
}

func repoNameFromFullName(fullName string) string {
	parts := strings.Split(fullName, "/")
	if len(parts) > 1 {
		return parts[1]
	}
	return fullName
}

func hasDotfilesName(fullName string, tokens []string) bool {
	repoName := strings.ToLower(repoNameFromFullName(fullName))
	for _, token := range tokens {
		re := regexp.MustCompile("(?i)(^|[-_.])" + escapeRegex(token) + "($|[-_.])")
		if re.MatchString(repoName) {
			return true
		}
	}
	return false
}

func hasDotfilesDescription(description string, tokens []string) bool {
	if description == "" {
		return false
	}
	lower := strings.ToLower(description)
	for _, token := range tokens {
		if strings.Contains(lower, token) {
			return true
		}
	}
	return false
}

func hasDotfilesTopic(topics []string, h dotfilesHeuristics) bool {
	for _, t := range topics {
		if h.topics[normalizeTopic(t)] {
			return true
		}
	}
	return false
}

func isLikelyDotfilesRepository(fullName string, topics []string, description *string, h dotfilesHeuristics) bool {
	if !h.enabled || fullName == "" {
		return false
	}
	desc := ""
	if description != nil {
		desc = *description
	}
	return hasDotfilesName(fullName, h.nameTokens) ||
		hasDotfilesTopic(topics, h) ||
		hasDotfilesDescription(desc, h.descriptionTokens)
}

type discoveredRepo struct {
	updatedAt   string
	stars       *int // nil mirrors JS null
	whitelisted bool
}

// discoverRepositories ports discoverRepositories. Topics are walked
// sequentially — the TS Promise.all serializes map writes behind one mutex,
// and the resulting map is identical.
func discoverRepositories(ctx context.Context, client gh.Client, cfg config.Config) (map[string]discoveredRepo, error) {
	discovered := map[string]discoveredRepo{}
	includeSet := map[string]bool{}
	for _, r := range cfg.Discovery.IncludeRepos {
		includeSet[safeRepo(r)] = true
	}
	dh := resolveDotfilesHeuristics(cfg)
	dotfilesSkipped := 0

	for _, topic := range cfg.Discovery.Topics {
		log.Printf("discover topic=%s perPage=%d maxPagesPerTopic=%d minStars=%d",
			topic, cfg.Discovery.Pagination.PerPage, cfg.Discovery.Pagination.MaxPagesPerTopic, cfg.Filters.MinStars)

		type pageResult struct {
			items   []gh.RepoItem
			hasNext bool
		}
		var pages []pageResult
		page := 1
		hasNext := true
		for hasNext {
			result, err := client.SearchRepositories(ctx, topic, page,
				cfg.Discovery.Pagination.PerPage, cfg.Filters.MinStars)
			if err != nil {
				return nil, fmt.Errorf("search topic=%s page=%d: %w", topic, page, err)
			}
			pages = append(pages, pageResult{result.Items, result.HasNext})
			page++
			hasNext = result.HasNext &&
				(cfg.Discovery.Pagination.MaxPagesPerTopic == 0 ||
					page <= cfg.Discovery.Pagination.MaxPagesPerTopic)
			if len(result.Items) == 0 {
				break
			}
		}

		for _, p := range pages {
			for _, item := range p.items {
				repo := safeRepo(item.FullName)
				if repo == "" {
					continue
				}
				if _, seen := discovered[repo]; seen {
					continue
				}
				isWhitelisted := includeSet[repo]
				stars := item.Stargazers
				meetsMinStars := stars >= cfg.Filters.MinStars

				switch {
				case !isWhitelisted && isLikelyDotfilesRepository(item.FullName, item.Topics, item.Description, dh):
					dotfilesSkipped++
				case isWhitelisted || meetsMinStars:
					s := stars
					discovered[repo] = discoveredRepo{
						updatedAt:   item.UpdatedAt,
						stars:       &s,
						whitelisted: isWhitelisted,
					}
				}
			}
		}
	}

	for _, repo := range cfg.Discovery.IncludeRepos {
		normalized := safeRepo(repo)
		if normalized != "" {
			if _, ok := discovered[normalized]; !ok {
				discovered[normalized] = discoveredRepo{whitelisted: true}
			}
		}
	}

	// excludeRepos applied post-discovery (config.Discovery.ExcludeRepos is a
	// real field here; the TS cast bug is fixed upstream by internal/config).
	for _, repo := range cfg.Discovery.ExcludeRepos {
		if normalized := safeRepo(repo); normalized != "" {
			delete(discovered, normalized)
		}
	}

	whitelistedCount := 0
	for _, d := range discovered {
		if d.whitelisted {
			whitelistedCount++
		}
	}
	log.Printf("discover completed topics=%d repos=%d whitelisted=%d excluded=%d dotfilesSkipped=%d",
		len(cfg.Discovery.Topics), len(discovered), whitelistedCount, len(cfg.Discovery.ExcludeRepos), dotfilesSkipped)
	return discovered, nil
}

func selectRepositoriesForRun(discovered map[string]discoveredRepo, maxReposPerRun int) []string {
	repos := make([]string, 0, len(discovered))
	for repo := range discovered {
		repos = append(repos, repo)
	}
	sort.Strings(repos)
	if maxReposPerRun > 0 && maxReposPerRun < len(repos) {
		repos = repos[:maxReposPerRun]
	}
	return repos
}

func sortEntries(entries []theme.Entry, sortBy, order string) []theme.Entry {
	reverse := order == "desc"
	cmp := func(a, b theme.Entry) int {
		switch sortBy {
		case "name":
			return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
		case "updated_at":
			return strings.Compare(a.UpdatedAt, b.UpdatedAt)
		default: // stars
			return a.Stars - b.Stars
		}
	}
	out := make([]theme.Entry, len(entries))
	copy(out, entries)
	sort.SliceStable(out, func(i, j int) bool {
		c := cmp(out[i], out[j])
		if reverse {
			c = -c
		}
		return c < 0
	})
	return out
}

// buildEntryForRepo requires internal/theme ExtractColorschemes and BuildEntry
// per the frozen stage contract.
func buildEntryForRepo(ctx context.Context, client gh.Client, cfg config.Config, dh dotfilesHeuristics, repo string, cache *store.Cache, whitelisted bool) (theme.Entry, error) {
	payload, err := client.Repository(ctx, repo)
	if err != nil {
		return theme.Entry{}, err
	}
	if payload == nil {
		return theme.Entry{}, fmt.Errorf("repository metadata not found")
	}
	if !whitelisted && payload.Stargazers < cfg.Filters.MinStars {
		return theme.Entry{}, fmt.Errorf("below minStars (%d < %d)", payload.Stargazers, cfg.Filters.MinStars)
	}
	if cfg.Filters.SkipArchived && payload.Archived {
		return theme.Entry{}, fmt.Errorf("repository archived")
	}
	if cfg.Filters.SkipDisabled && payload.Disabled {
		return theme.Entry{}, fmt.Errorf("repository disabled")
	}
	if !whitelisted && isLikelyDotfilesRepository(payload.FullName, payload.Topics, payload.Description, dh) {
		return theme.Entry{}, fmt.Errorf("repository appears to be dotfiles")
	}

	ref := payload.DefaultBr
	if ref == "" {
		ref = "HEAD"
	}
	treeItems, err := client.Tree(ctx, repo, ref)
	if err != nil {
		return theme.Entry{}, err
	}
	colors := theme.ExtractColorschemes(treeItems)
	entry, err := theme.BuildEntry(*payload, colors)
	if err != nil {
		return theme.Entry{}, err
	}

	readme, rerr := client.Readme(ctx, repo)
	if rerr == nil && readme != nil {
		if uerr := cache.UpsertReadme(repo, *readme); uerr != nil {
			log.Printf("failed to cache readme for %s: %v", repo, uerr)
		}
	}
	return entry, nil
}

// Sync ports src/sync/indexer.ts runOnce. Signature fixed by the stage
// contract. store.Cache expectations (per InfraPort's landed contract):
// ShouldRefresh(repo, updatedAt, staleAfterDays), ReadRepo -> *CacheRow with
// Payload map[string]any, UpsertRepo(repo, updatedAt, payload any, parseErr
// *string), ListPayloads() ([]theme.Entry, error), UpsertReadme, Close.
func Sync(ctx context.Context, cfg config.Config, force bool, client gh.Client, cache *store.Cache) (SyncStats, error) {
	stats := SyncStats{}
	dh := resolveDotfilesHeuristics(cfg)

	discovered, err := discoverRepositories(ctx, client, cfg)
	if err != nil {
		return stats, err
	}
	stats.Discovered = len(discovered)
	scheduled := selectRepositoriesForRun(discovered, cfg.Processing.MaxReposPerRun)
	stats.Scheduled = len(scheduled)

	log.Printf("run plan discovered=%d scheduled=%d batchSize=%d batchPauseMs=%d requestDelayMs=%d force=%t",
		stats.Discovered, stats.Scheduled, cfg.Processing.Batch.Size, cfg.Processing.Batch.PauseMs,
		cfg.GitHub.RateLimit.DelayMs, force)

	var entriesMu sync.Mutex
	entriesByRepo := map[string]theme.Entry{}
	whitelistedRepos := map[string]bool{}
	excludedRepos := map[string]bool{}
	for _, r := range cfg.Discovery.ExcludeRepos {
		if n := safeRepo(r); n != "" {
			excludedRepos[n] = true
		}
	}
	for repo, info := range discovered {
		if info.whitelisted {
			whitelistedRepos[repo] = true
		}
	}

	persisted, err := cache.ListPayloads()
	if err != nil {
		return stats, err
	}
	if force {
		log.Print("Force flag set - clearing all cached data")
	}
	for _, payload := range persisted {
		repo := payload.Repo
		if repo == "" || excludedRepos[repo] {
			continue
		}
		isWhitelisted := whitelistedRepos[repo]
		meetsMinStars := payload.Stars >= cfg.Filters.MinStars
		if !isWhitelisted && isLikelyDotfilesRepository(repo, payload.Topics, strPtr(payload.Description), dh) {
			continue
		}
		if isWhitelisted || meetsMinStars {
			entriesByRepo[repo] = payload
		}
	}
	log.Printf("loaded payloads from state count=%d", len(persisted))

	batchGroups := chunkStrings(scheduled, cfg.Processing.Batch.Size)
	totalBatches := len(batchGroups)

	for batchIndex, batch := range batchGroups {
		stats.Batches++
		log.Printf("processing batch=%d/%d size=%d concurrency=%d",
			batchIndex+1, totalBatches, len(batch), cfg.Processing.Concurrency)

		g, gctx := errgroup.WithContext(ctx)
		g.SetLimit(maxInt(1, minInt(cfg.Processing.Concurrency, len(batch))))
		for _, repo := range batch {
			repo := repo
			info := discovered[repo]
			g.Go(func() error {
				if gctx.Err() != nil {
					return nil
				}

				if !force {
					refresh, err := cache.ShouldRefresh(repo, info.updatedAt, cfg.Filters.StaleAfterDays)
					if err == nil && !refresh {
						row, rerr := cache.ReadRepo(repo)
						if rerr == nil && row != nil {
							if _, hasRepo := row.Payload["repo"]; hasRepo {
								b, _ := json.Marshal(row.Payload)
								var entry theme.Entry
								if json.Unmarshal(b, &entry) == nil {
									entriesMu.Lock()
									if info.whitelisted || entry.Stars >= cfg.Filters.MinStars {
										entriesByRepo[repo] = entry
										stats.Cached++
									}
									entriesMu.Unlock()
								}
							}
						}
						return nil
					}
				}

				entry, err := buildEntryForRepo(gctx, client, cfg, dh, repo, cache, info.whitelisted)
				if err != nil {
					msg := err.Error()
					_ = cache.UpsertRepo(repo, info.updatedAt, map[string]any{"repo": repo}, &msg)
					entriesMu.Lock()
					stats.Errors++
					entriesMu.Unlock()
					log.Printf("repo processing failed repo=%s error=%s", repo, msg)
					return nil
				}
				_ = cache.UpsertRepo(repo, entry.UpdatedAt, entry, nil)
				entriesMu.Lock()
				entriesByRepo[repo] = entry
				stats.Fetched++
				entriesMu.Unlock()
				return nil
			})
		}
		if err := g.Wait(); err != nil {
			return stats, err
		}

		// Batch checkpoint: apply overrides, sort, validate, write index+manifest.
		entriesMu.Lock()
		entries := make([]theme.Entry, 0, len(entriesByRepo))
		for _, e := range entriesByRepo {
			entries = append(entries, e)
		}
		entriesMu.Unlock()

		overrides, excluded, err := LoadOverrides(cfg.Overrides)
		if err != nil {
			return stats, err
		}
		merged, err := ApplyOverrides(entries, overrides, excluded)
		if err != nil {
			return stats, err
		}
		sortedEntries := sortEntries(merged, cfg.Sort.By, cfg.Sort.Order)

		validEntries := make([]theme.Entry, 0, len(sortedEntries))
		for _, e := range sortedEntries {
			if e.Name != "" && e.Colorscheme != "" { // ThemeEntrySchema: name/colorscheme min(1)
				validEntries = append(validEntries, e)
			}
		}

		if err := writeJSON(cfg.Output.Index, validEntries); err != nil {
			return stats, err
		}
		if _, err := buildManifest(cfg.Output.Manifest, cfg.Output.Index, len(validEntries)); err != nil {
			return stats, err
		}
		stats.Written = len(validEntries)
		log.Printf("batch checkpoint written batch=%d/%d entries=%d", batchIndex+1, totalBatches, len(validEntries))

		if cfg.Processing.Batch.PauseMs > 0 && batchIndex < totalBatches-1 {
			select {
			case <-ctx.Done():
				return stats, ctx.Err()
			case <-time.After(time.Duration(cfg.Processing.Batch.PauseMs) * time.Millisecond):
			}
		}
	}

	log.Printf("run complete discovered=%d scheduled=%d batches=%d fetched=%d cached=%d errors=%d written=%d",
		stats.Discovered, stats.Scheduled, stats.Batches, stats.Fetched, stats.Cached, stats.Errors, stats.Written)
	return stats, nil
}

func chunkStrings(items []string, size int) [][]string {
	if size < 1 {
		size = 1
	}
	var chunks [][]string
	for i := 0; i < len(items); i += size {
		end := i + size
		if end > len(items) {
			end = len(items)
		}
		chunks = append(chunks, items[i:end])
	}
	return chunks
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
