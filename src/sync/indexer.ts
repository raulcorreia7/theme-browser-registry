import type { ThemeEntry, GitHubRepoItem, RunStats } from "@/lib/types";
import { ThemeEntrySchema } from "@/lib/types";
import { validate } from "@/lib/validation";
import type { Config } from "@/lib/config";
import { GitHubClient } from "@/sync/github";
import { RepoCache } from "@/db/sqlite";
import { writeJson, writeManifest } from "@/db/files";
import { extractColorschemes, buildEntry } from "@/sync/parser";
import { loadOverrides, applyOverrides } from "@/merge/apply";
import { logger } from "@/lib/logger";

const RE_GIT_SUFFIX = /\.git$/;
const RE_LEADING_TRAILING_SLASHES = /^\/+|\/+$/g;

const DEFAULT_DOTFILES_TOPICS = [
  "dotfiles",
  "dotfile",
  "nvim-config",
  "neovim-config",
  "vim-config",
  "vimrc",
] as const;

const DEFAULT_DOTFILES_NAME_TOKENS = ["dotfiles", "dotfile"] as const;
const DEFAULT_DOTFILES_DESCRIPTION_TOKENS = ["dotfiles", "dotfile"] as const;

type DotfilesSignals = {
  fullName: string;
  topics: string[] | undefined;
  description: string | null | undefined;
};

type DotfilesHeuristics = {
  enabled: boolean;
  topics: Set<string>;
  nameTokens: string[];
  descriptionTokens: string[];
};

const BUILTIN_DOTFILES_HEURISTICS: DotfilesHeuristics = {
  enabled: true,
  topics: new Set(DEFAULT_DOTFILES_TOPICS.map(normalizeTopic)),
  nameTokens: [...DEFAULT_DOTFILES_NAME_TOKENS],
  descriptionTokens: [...DEFAULT_DOTFILES_DESCRIPTION_TOKENS],
};

export function safeRepo(repo: string): string {
  return repo.trim().replace(RE_GIT_SUFFIX, "").replace(RE_LEADING_TRAILING_SLASHES, "");
}

export interface DiscoveredRepo {
  updatedAt: string;
  stars: number | null;
  whitelisted: boolean;
}

function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function normalizeTokenList(values: string[] | undefined, fallback: readonly string[]): string[] {
  const source = Array.isArray(values) ? values : [...fallback];
  const normalized = new Set<string>();

  for (const raw of source) {
    const value = raw.trim().toLowerCase();
    if (value) {
      normalized.add(value);
    }
  }

  return Array.from(normalized);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveDotfilesHeuristics(config: Config): DotfilesHeuristics {
  const dotfiles = config.filters.dotfiles;

  return {
    enabled: dotfiles.enabled,
    topics: new Set(
      normalizeTokenList(dotfiles.topics, DEFAULT_DOTFILES_TOPICS).map(normalizeTopic),
    ),
    nameTokens: normalizeTokenList(dotfiles.nameTokens, DEFAULT_DOTFILES_NAME_TOKENS),
    descriptionTokens: normalizeTokenList(
      dotfiles.descriptionTokens,
      DEFAULT_DOTFILES_DESCRIPTION_TOKENS,
    ),
  };
}

function repoNameFromFullName(fullName: string): string {
  const parts = fullName.split("/");
  return parts[1] ?? fullName;
}

function hasDotfilesTopic(topics: string[] | undefined, heuristics: DotfilesHeuristics): boolean {
  if (!topics || topics.length === 0) return false;

  for (const topic of topics) {
    const normalized = normalizeTopic(topic);
    if (heuristics.topics.has(normalized)) {
      return true;
    }
  }

  return false;
}

function hasDotfilesName(fullName: string, heuristics: DotfilesHeuristics): boolean {
  const repoName = repoNameFromFullName(fullName).toLowerCase();

  for (const token of heuristics.nameTokens) {
    const re = new RegExp(`(^|[-_.])${escapeRegex(token)}($|[-_.])`, "i");
    if (re.test(repoName)) {
      return true;
    }
  }

  return false;
}

function hasDotfilesDescription(
  description: string | null | undefined,
  heuristics: DotfilesHeuristics,
): boolean {
  if (typeof description !== "string" || description === "") {
    return false;
  }

  const lowerDescription = description.toLowerCase();
  for (const token of heuristics.descriptionTokens) {
    if (lowerDescription.includes(token)) {
      return true;
    }
  }

  return false;
}

export function isLikelyDotfilesRepository(
  signals: DotfilesSignals,
  heuristics: DotfilesHeuristics = BUILTIN_DOTFILES_HEURISTICS,
): boolean {
  if (!heuristics.enabled) {
    return false;
  }

  if (!signals.fullName) return false;

  if (hasDotfilesName(signals.fullName, heuristics)) {
    return true;
  }

  if (hasDotfilesTopic(signals.topics, heuristics)) {
    return true;
  }

  if (hasDotfilesDescription(signals.description, heuristics)) {
    return true;
  }

  return false;
}

function isLikelyDotfilesEntry(entry: ThemeEntry, heuristics: DotfilesHeuristics): boolean {
  if (!entry.repo) return false;
  return isLikelyDotfilesRepository(
    {
      fullName: entry.repo,
      topics: entry.topics,
      description: entry.description,
    },
    heuristics,
  );
}

async function discoverRepositories(
  client: GitHubClient,
  config: Config,
): Promise<Map<string, DiscoveredRepo>> {
  const discovered = new Map<string, DiscoveredRepo>();
  const mutex = { lock: false };
  const includeSet = new Set(config.discovery.includeRepos.map((r) => safeRepo(r)));
  const dotfilesHeuristics = resolveDotfilesHeuristics(config);
  let dotfilesSkipped = 0;

  async function discoverTopic(topic: string): Promise<void> {
    logger.info(
      `discover topic=${topic} perPage=${config.discovery.pagination.perPage} maxPagesPerTopic=${config.discovery.pagination.maxPagesPerTopic} minStars=${config.filters.minStars}`,
    );

    const pages: Array<{ items: GitHubRepoItem[]; hasNext: boolean }> = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const result = await client.searchRepositories(
        topic,
        page,
        config.discovery.pagination.perPage,
        config.filters.minStars,
      );
      pages.push(result);
      page++;
      hasNext =
        result.hasNext &&
        (config.discovery.pagination.maxPagesPerTopic === 0 ||
          page <= config.discovery.pagination.maxPagesPerTopic);
      if (result.items.length === 0) break;
    }

    for (const result of pages) {
      for (const item of result.items) {
        const repo = safeRepo(item.full_name);
        if (repo) {
          while (mutex.lock) await new Promise((r) => setTimeout(r, 1));
          mutex.lock = true;
          if (!discovered.has(repo)) {
            const isWhitelisted = includeSet.has(repo);
            const stars = item.stargazers_count ?? null;
            const meetsMinStars = stars !== null && stars >= config.filters.minStars;

            if (
              !isWhitelisted &&
              isLikelyDotfilesRepository(
                {
                  fullName: item.full_name,
                  topics: item.topics,
                  description: item.description,
                },
                dotfilesHeuristics,
              )
            ) {
              dotfilesSkipped++;
            } else if (isWhitelisted || meetsMinStars) {
              discovered.set(repo, {
                updatedAt: item.updated_at,
                stars,
                whitelisted: isWhitelisted,
              });
            }
          }
          mutex.lock = false;
        }
      }
    }
  }

  await Promise.all(config.discovery.topics.map((topic) => discoverTopic(topic)));

  for (const repo of config.discovery.includeRepos) {
    const normalized = safeRepo(repo);
    if (normalized && !discovered.has(normalized)) {
      discovered.set(normalized, {
        updatedAt: "",
        stars: null,
        whitelisted: true,
      });
    }
  }

  const excludeRepos = (config.discovery as { excludeRepos?: string[] }).excludeRepos ?? [];
  for (const repo of excludeRepos) {
    const normalized = safeRepo(repo);
    if (normalized) {
      discovered.delete(normalized);
    }
  }

  const whitelistedCount = Array.from(discovered.values()).filter((d) => d.whitelisted).length;
  logger.info(
    `discover completed topics=${config.discovery.topics.length} repos=${discovered.size} whitelisted=${whitelistedCount} excluded=${excludeRepos.length} dotfilesSkipped=${dotfilesSkipped}`,
  );
  return discovered;
}

export function selectRepositoriesForRun(
  discovered: Map<string, DiscoveredRepo>,
  config: Config,
): Array<[string, DiscoveredRepo]> {
  const sorted = Array.from(discovered.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (config.processing.maxReposPerRun > 0) {
    return sorted.slice(0, config.processing.maxReposPerRun);
  }
  return sorted;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function processBatchParallel(
  batch: Array<[string, DiscoveredRepo]>,
  client: GitHubClient,
  config: Config,
  dotfilesHeuristics: DotfilesHeuristics,
  store: RepoCache,
  entriesByRepo: Map<string, ThemeEntry>,
  stats: RunStats,
  force = false,
): Promise<void> {
  const queue = [...batch];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const [repo, discoveredInfo] = item;

      if (
        !force &&
        !(await store.shouldRefresh(repo, discoveredInfo.updatedAt, config.filters.staleAfterDays))
      ) {
        const cached = await store.readRepo(repo);
        if (cached?.payload && "repo" in cached.payload) {
          const cachedEntry = cached.payload as ThemeEntry;
          if (
            discoveredInfo.whitelisted ||
            (cachedEntry.stars !== undefined && cachedEntry.stars >= config.filters.minStars)
          ) {
            entriesByRepo.set(repo, cachedEntry);
            stats.cached++;
          }
        }
        continue;
      }

      try {
        const entry = await buildEntryForRepo(
          client,
          config,
          dotfilesHeuristics,
          repo,
          store,
          discoveredInfo.whitelisted,
        );
        const updatedAt = entry.updated_at || "";
        await store.upsertRepo(repo, updatedAt, entry, null);
        entriesByRepo.set(repo, entry);
        stats.fetched++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await store.upsertRepo(repo, discoveredInfo.updatedAt || "", { repo }, errorMessage);
        stats.errors++;
        logger.warn(`repo processing failed repo=${repo} error=${errorMessage}`);
      }
    }
  }

  const workers = Array(Math.min(config.processing.concurrency, batch.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
}

export function sortEntries(entries: ThemeEntry[], config: Config): ThemeEntry[] {
  const reverse = config.sort.order === "desc";

  return [...entries].sort((a, b) => {
    let cmp = 0;
    if (config.sort.by === "name") {
      cmp = (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
    } else if (config.sort.by === "updated_at") {
      cmp = (a.updated_at || "").localeCompare(b.updated_at || "");
    } else {
      cmp = (a.stars || 0) - (b.stars || 0);
    }
    return reverse ? -cmp : cmp;
  });
}

async function buildEntryForRepo(
  client: GitHubClient,
  config: Config,
  dotfilesHeuristics: DotfilesHeuristics,
  repo: string,
  store: RepoCache,
  whitelisted: boolean = false,
): Promise<ThemeEntry> {
  const repoPayload = await client.fetchRepository(repo);
  if (!repoPayload) {
    throw new Error("repository metadata not found");
  }

  const stars = repoPayload.stargazers_count;
  if (!whitelisted && typeof stars === "number" && stars < config.filters.minStars) {
    throw new Error(`below minStars (${stars} < ${config.filters.minStars})`);
  }

  if (config.filters.skipArchived && repoPayload.archived) {
    throw new Error("repository archived");
  }

  if (config.filters.skipDisabled && repoPayload.disabled) {
    throw new Error("repository disabled");
  }

  if (
    !whitelisted &&
    isLikelyDotfilesRepository(
      {
        fullName: repoPayload.full_name,
        topics: repoPayload.topics,
        description: repoPayload.description,
      },
      dotfilesHeuristics,
    )
  ) {
    throw new Error("repository appears to be dotfiles");
  }

  const ref = repoPayload.default_branch || "HEAD";
  const treeItems = await client.fetchRepositoryTree(repo, ref);
  const colors = extractColorschemes(treeItems);
  const entry = buildEntry(repoPayload, colors);

  try {
    const readme = await client.fetchReadme(repo);
    if (readme) {
      await store.upsertReadme(repo, readme);
      logger.debug(`cached readme for ${repo}`);
    }
  } catch (error) {
    logger.debug(`failed to fetch readme for ${repo}: ${error}`);
  }

  return entry;
}

export async function runOnce(config: Config, force = false): Promise<RunStats> {
  const client = new GitHubClient({
    requestDelayMs: config.github.rateLimit.delayMs,
    retryLimit: config.github.rateLimit.retryLimit,
  });
  const store = new RepoCache(config.output.cache);
  const stats: RunStats = {
    discovered: 0,
    scheduled: 0,
    batches: 0,
    fetched: 0,
    cached: 0,
    errors: 0,
    written: 0,
  };

  try {
    const dotfilesHeuristics = resolveDotfilesHeuristics(config);
    const discovered = await discoverRepositories(client, config);
    stats.discovered = discovered.size;
    const scheduled = selectRepositoriesForRun(discovered, config);
    stats.scheduled = scheduled.length;

    logger.info(
      `run plan discovered=${stats.discovered} scheduled=${stats.scheduled} batchSize=${config.processing.batch.size} batchPauseMs=${config.processing.batch.pauseMs} requestDelayMs=${config.github.rateLimit.delayMs} force=${force}`,
    );

    const entriesByRepo = new Map<string, ThemeEntry>();
    const whitelistedRepos = new Set<string>();
    const excludedRepos = new Set(
      ((config.discovery as { excludeRepos?: string[] }).excludeRepos ?? [])
        .map((repo) => safeRepo(repo))
        .filter((repo): repo is string => Boolean(repo)),
    );
    for (const [repo, info] of discovered) {
      if (info.whitelisted) {
        whitelistedRepos.add(repo);
      }
    }

    const persistedPayloads = await store.listPayloads();

    if (force) {
      logger.info("Force flag set - clearing all cached data");
    }

    for (const payload of persistedPayloads) {
      const repo = payload.repo;
      if (repo) {
        if (excludedRepos.has(repo)) {
          continue;
        }

        const isWhitelisted = whitelistedRepos.has(repo);
        const meetsMinStars =
          payload.stars !== undefined &&
          payload.stars !== null &&
          payload.stars >= config.filters.minStars;
        const isDotfiles = isLikelyDotfilesEntry(payload, dotfilesHeuristics);

        if (!isWhitelisted && isDotfiles) {
          continue;
        }

        if (isWhitelisted || meetsMinStars) {
          entriesByRepo.set(repo, payload);
        }
      }
    }
    logger.debug(`loaded payloads from state count=${persistedPayloads.length}`);

    const batchGroups = chunk(scheduled, config.processing.batch.size);
    const totalBatches = batchGroups.length;

    for (let batchIndex = 0; batchIndex < batchGroups.length; batchIndex++) {
      const batch = batchGroups[batchIndex];
      if (!batch) continue;
      stats.batches++;
      logger.info(
        `processing batch=${batchIndex + 1}/${totalBatches} size=${batch.length} concurrency=${config.processing.concurrency}`,
      );

      await processBatchParallel(
        batch,
        client,
        config,
        dotfilesHeuristics,
        store,
        entriesByRepo,
        stats,
        force,
      );

      const entries = Array.from(entriesByRepo.values());
      const { overrides, excluded } = loadOverrides(config.overrides);
      const merged = applyOverrides(entries, overrides, excluded);
      const sortedEntries = sortEntries(merged, config);

      const validEntries: ThemeEntry[] = [];
      for (const entry of sortedEntries) {
        const validated = validate(ThemeEntrySchema, entry);
        if (validated) {
          validEntries.push(validated);
        }
      }

      writeJson(config.output.index, validEntries);
      writeManifest(config.output.manifest, config.output.index, validEntries.length);
      stats.written = validEntries.length;
      logger.debug(
        `batch checkpoint written batch=${batchIndex + 1}/${totalBatches} entries=${validEntries.length}`,
      );

      if (config.processing.batch.pauseMs > 0 && batchIndex < totalBatches - 1) {
        const pauseSeconds = config.processing.batch.pauseMs / 1000;
        logger.debug(`batch pause sleep=${pauseSeconds}s`);
        await new Promise((resolve) => setTimeout(resolve, config.processing.batch.pauseMs));
      }
    }

    logger.info(
      `run complete discovered=${stats.discovered} scheduled=${stats.scheduled} batches=${stats.batches} fetched=${stats.fetched} cached=${stats.cached} errors=${stats.errors} written=${stats.written}`,
    );

    return stats;
  } finally {
    store.close();
  }
}

export async function runLoop(config: Config): Promise<void> {
  while (true) {
    const started = Date.now();
    logger.info("loop iteration started");
    const stats = await runOnce(config);
    const took = Math.floor((Date.now() - started) / 1000);
    logger.info(`loop iteration finished duration=${took}s stats=${JSON.stringify(stats)}`);
    await new Promise((resolve) => setTimeout(resolve, config.runtime.scanIntervalSeconds * 1000));
  }
}
