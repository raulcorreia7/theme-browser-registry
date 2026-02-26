import type { ThemeEntry, GitHubRepoItem, RunStats } from "../types/schemas.js";
import { ThemeEntrySchema } from "../types/schemas.js";
import { validate } from "../types/validation.js";
import type { Config } from "../utils/config.js";
import { loadConfig, DEFAULT_CONFIG } from "../utils/config.js";
import { GitHubClient } from "../providers/github.js";
import { RepoCache } from "../providers/cache.js";
import { writeJson, writeManifest } from "../providers/files.js";
import { extractColorschemes, buildEntry } from "./parser.js";
import { loadOverrides, applyOverrides } from "./merger.js";
import { logger, setLogLevel } from "../utils/logger.js";

export type { RunStats } from "../types/schemas.js";

export function safeRepo(repo: string): string {
  return repo.trim().replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
}

export interface DiscoveredRepo {
  updatedAt: string;
  stars: number | null;
  whitelisted: boolean;
}

async function discoverRepositories(
  client: GitHubClient,
  config: Config
): Promise<Map<string, DiscoveredRepo>> {
  const discovered = new Map<string, DiscoveredRepo>();
  const mutex = { lock: false };
  const includeSet = new Set(config.discovery.includeRepos.map((r) => safeRepo(r)));

  async function discoverTopic(topic: string): Promise<void> {
    logger.info(
      `discover topic=${topic} perPage=${config.discovery.pagination.perPage} maxPagesPerTopic=${config.discovery.pagination.maxPagesPerTopic} minStars=${config.filters.minStars}`
    );

    const pages: Array<{ items: GitHubRepoItem[]; hasNext: boolean }> = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const result = await client.searchRepositories(
        topic,
        page,
        config.discovery.pagination.perPage,
        config.filters.minStars
      );
      pages.push(result);
      page++;
      hasNext = result.hasNext && (config.discovery.pagination.maxPagesPerTopic === 0 || page <= config.discovery.pagination.maxPagesPerTopic);
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
            
            if (isWhitelisted || meetsMinStars) {
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

  const excludeRepos = (config.discovery as any).excludeRepos ?? [];
  for (const repo of excludeRepos) {
    const normalized = safeRepo(repo);
    if (normalized) {
      discovered.delete(normalized);
    }
  }

  const whitelistedCount = Array.from(discovered.values()).filter((d) => d.whitelisted).length;
  logger.info(
    `discover completed topics=${config.discovery.topics.length} repos=${discovered.size} whitelisted=${whitelistedCount} excluded=${excludeRepos.length}`
  );
  return discovered;
}

export function selectRepositoriesForRun(
  discovered: Map<string, DiscoveredRepo>,
  config: Config
): Array<[string, DiscoveredRepo]> {
  const sorted = Array.from(discovered.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
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
  store: RepoCache,
  entriesByRepo: Map<string, ThemeEntry>,
  stats: RunStats,
  force = false
): Promise<void> {
  const queue = [...batch];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const [repo, discoveredInfo] = item;

      if (!force && !(await store.shouldRefresh(repo, discoveredInfo.updatedAt, config.filters.staleAfterDays))) {
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
        const entry = await buildEntryForRepo(client, config, repo, store, discoveredInfo.whitelisted);
        const updatedAt = entry.updated_at || "";
        await store.upsertRepo(repo, updatedAt, entry, null);
        entriesByRepo.set(repo, entry);
        stats.fetched++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
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
  repo: string,
  store: RepoCache,
  whitelisted: boolean = false
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
    const discovered = await discoverRepositories(client, config);
    stats.discovered = discovered.size;
    const scheduled = selectRepositoriesForRun(discovered, config);
    stats.scheduled = scheduled.length;

    logger.info(
      `run plan discovered=${stats.discovered} scheduled=${stats.scheduled} batchSize=${config.processing.batch.size} batchPauseMs=${config.processing.batch.pauseMs} requestDelayMs=${config.github.rateLimit.delayMs} force=${force}`
    );

    const entriesByRepo = new Map<string, ThemeEntry>();
    const whitelistedRepos = new Set<string>();
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
        const isWhitelisted = whitelistedRepos.has(repo);
        const meetsMinStars =
          payload.stars !== undefined &&
          payload.stars !== null &&
          payload.stars >= config.filters.minStars;
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
        `processing batch=${batchIndex + 1}/${totalBatches} size=${batch.length} concurrency=${config.processing.concurrency}`
      );

      await processBatchParallel(batch, client, config, store, entriesByRepo, stats, force);

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
        `batch checkpoint written batch=${batchIndex + 1}/${totalBatches} entries=${validEntries.length}`
      );

      if (config.processing.batch.pauseMs > 0 && batchIndex < totalBatches - 1) {
        const pauseSeconds = config.processing.batch.pauseMs / 1000;
        logger.debug(`batch pause sleep=${pauseSeconds}s`);
        await new Promise((resolve) => setTimeout(resolve, config.processing.batch.pauseMs));
      }
    }

    logger.info(
      `run complete discovered=${stats.discovered} scheduled=${stats.scheduled} batches=${stats.batches} fetched=${stats.fetched} cached=${stats.cached} errors=${stats.errors} written=${stats.written}`
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
    await new Promise((resolve) =>
      setTimeout(resolve, config.runtime.scanIntervalSeconds * 1000)
    );
  }
}

export { Config, loadConfig, DEFAULT_CONFIG, setLogLevel };
