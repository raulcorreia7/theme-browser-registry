import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { ThemeEntry, GitHubRepoItem, GitHubTreeItem } from "./types.js";
import { validateThemeEntry } from "./types.js";
import type { Config } from "./config.js";
import { loadConfig, DEFAULT_CONFIG } from "./config.js";
import { GitHubClient, GitHubRequestError } from "./github-client.js";
import { StateStore } from "./state.js";
import { extractColorschemes, buildEntry } from "./parser.js";
import { loadOverrides, applyOverrides } from "./merge.js";
import { logger, setLogLevel } from "./logger.js";

export interface RunStats {
  discovered: number;
  scheduled: number;
  batches: number;
  fetched: number;
  cached: number;
  errors: number;
  written: number;
}

export function safeRepo(repo: string): string {
  return repo.trim().replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
}

async function discoverRepositories(
  client: GitHubClient,
  config: Config
): Promise<Map<string, string>> {
  const discovered = new Map<string, string>();

  for (const topic of config.topics) {
    logger.info(
      `discover topic=${topic} per_page=${config.per_page} max_pages_per_topic=${config.max_pages_per_topic}`
    );
    let page = 1;
    while (true) {
      const { items, hasNext } = await client.searchRepositories(
        topic,
        page,
        config.per_page
      );
      if (items.length === 0) break;

      for (const item of items) {
        const repo = safeRepo(item.full_name);
        if (repo && !discovered.has(repo)) {
          discovered.set(repo, item.updated_at);
        }
      }

      page++;
      if (config.max_pages_per_topic > 0 && page > config.max_pages_per_topic) {
        break;
      }
      if (!hasNext) break;
    }
  }

  for (const repo of config.include_repos) {
    const normalized = safeRepo(repo);
    if (normalized && !discovered.has(normalized)) {
      discovered.set(normalized, "");
    }
  }

  logger.info(
    `discover completed topics=${config.topics.length} repos=${discovered.size}`
  );
  return discovered;
}

export function selectRepositoriesForRun(
  discovered: Map<string, string>,
  config: Config
): Array<[string, string]> {
  const sorted = Array.from(discovered.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  if (config.max_repos_per_run > 0) {
    return sorted.slice(0, config.max_repos_per_run);
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

export function sortEntries(entries: ThemeEntry[], config: Config): ThemeEntry[] {
  const reverse = config.sort_order === "desc";

  return [...entries].sort((a, b) => {
    let cmp = 0;
    if (config.sort_by === "name") {
      cmp = (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
    } else if (config.sort_by === "updated_at") {
      cmp = (a.updated_at || "").localeCompare(b.updated_at || "");
    } else {
      cmp = (a.stars || 0) - (b.stars || 0);
    }
    return reverse ? -cmp : cmp;
  });
}

export function writeJson(path: string, payload: unknown): void {
  const outPath = path;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

export function writeManifest(
  manifestPath: string,
  outputPath: string,
  entriesCount: number
): void {
  const raw = readFileSync(outputPath);
  const checksum = createHash("sha256").update(raw).digest("hex");
  const payload = {
    count: entriesCount,
    generated_at: new Date().toISOString(),
    sha256: checksum,
  };
  writeJson(manifestPath, payload);
}

async function buildEntryForRepo(
  client: GitHubClient,
  config: Config,
  repo: string
): Promise<ThemeEntry> {
  const repoPayload = await client.fetchRepository(repo);
  if (!repoPayload) {
    throw new Error("repository metadata not found");
  }

  const stars = repoPayload.stargazers_count;
  if (typeof stars === "number" && stars < config.min_stars) {
    throw new Error(`below min_stars (${stars} < ${config.min_stars})`);
  }

  if (config.skip_archived && repoPayload.archived) {
    throw new Error("repository archived");
  }

  if (config.skip_disabled && repoPayload.disabled) {
    throw new Error("repository disabled");
  }

  const ref = repoPayload.default_branch || "HEAD";
  const treeItems = await client.fetchRepositoryTree(repo, ref);
  const colors = extractColorschemes(treeItems);
  return buildEntry(repoPayload, colors);
}

export async function runOnce(config: Config): Promise<RunStats> {
  const client = new GitHubClient({
    requestDelayMs: config.request_delay_ms,
    retryLimit: config.retry_limit,
  });
  const store = new StateStore(config.state_db_path);
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
      `run plan discovered=${stats.discovered} scheduled=${stats.scheduled} batch_size=${config.batch_size} batch_pause_ms=${config.batch_pause_ms} request_delay_ms=${config.request_delay_ms}`
    );

    const entriesByRepo = new Map<string, ThemeEntry>();
    const persistedPayloads = store.listPayloads();
    for (const payload of persistedPayloads) {
      const repo = payload.repo;
      if (repo) {
        entriesByRepo.set(repo, payload);
      }
    }
    logger.debug(`loaded payloads from state count=${persistedPayloads.length}`);

    const batchGroups = chunk(scheduled, config.batch_size);
    const totalBatches = batchGroups.length;

    for (let batchIndex = 0; batchIndex < batchGroups.length; batchIndex++) {
      const batch = batchGroups[batchIndex];
      if (!batch) continue;
      stats.batches++;
      logger.info(
        `processing batch=${batchIndex + 1}/${totalBatches} size=${batch.length}`
      );

      for (const [repo, discoveredUpdatedAt] of batch) {
        if (!store.shouldRefresh(repo, discoveredUpdatedAt, config.stale_after_days)) {
          const cached = store.readRepo(repo);
          if (cached?.payload && "repo" in cached.payload) {
            entriesByRepo.set(repo, cached.payload as ThemeEntry);
            stats.cached++;
          }
          continue;
        }

        try {
          const entry = await buildEntryForRepo(client, config, repo);
          const updatedAt = entry.updated_at || "";
          store.upsertRepo(repo, updatedAt, entry, null);
          entriesByRepo.set(repo, entry);
          stats.fetched++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          store.upsertRepo(repo, discoveredUpdatedAt || "", { repo }, errorMessage);
          stats.errors++;
          logger.warn(`repo processing failed repo=${repo} error=${errorMessage}`);
        }
      }

      const entries = Array.from(entriesByRepo.values());
      const { overrides, excluded } = loadOverrides(config.overrides_path);
      const merged = applyOverrides(entries, overrides, excluded);
      const sortedEntries = sortEntries(merged, config);

      const validEntries: ThemeEntry[] = [];
      for (const entry of sortedEntries) {
        const validated = validateThemeEntry(entry);
        if (validated) {
          validEntries.push(validated);
        }
      }

      writeJson(config.output_path, validEntries);
      writeManifest(config.manifest_path, config.output_path, validEntries.length);
      stats.written = validEntries.length;
      logger.debug(
        `batch checkpoint written batch=${batchIndex + 1}/${totalBatches} entries=${validEntries.length}`
      );

      if (config.batch_pause_ms > 0 && batchIndex < totalBatches - 1) {
        const pauseSeconds = config.batch_pause_ms / 1000;
        logger.debug(`batch pause sleep=${pauseSeconds}s`);
        await new Promise((resolve) => setTimeout(resolve, config.batch_pause_ms));
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
      setTimeout(resolve, config.scan_interval_seconds * 1000)
    );
  }
}

export { Config, loadConfig, DEFAULT_CONFIG, setLogLevel };
