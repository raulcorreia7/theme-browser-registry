export * from "@/sync/indexer";
export * from "@/sync/parser";
export * from "@/sync/github";

import type { Config } from "@/lib/config";
import { runOnce } from "@/sync/indexer";
import { GitHubClient } from "@/sync/github";
import { RepoCache } from "@/db/sqlite";

export interface SyncOptions {
  config: Config;
  force?: boolean;
}

export interface SyncResult {
  discovered: number;
  scheduled: number;
  fetched: number;
  cached: number;
  errors: number;
  written: number;
}

export async function run(options: SyncOptions): Promise<SyncResult> {
  const stats = await runOnce(options.config, options.force ?? false);
  return {
    discovered: stats.discovered,
    scheduled: stats.scheduled,
    fetched: stats.fetched,
    cached: stats.cached,
    errors: stats.errors,
    written: stats.written,
  };
}

export interface SyncDeps {
  client: GitHubClient;
  cache: RepoCache;
}

export interface SyncContext {
  config: Config;
  deps: SyncDeps;
}
