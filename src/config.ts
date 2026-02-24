import { existsSync, readFileSync } from "node:fs";
import { defu } from "defu";

export interface DiscoveryConfig {
  topics: string[];
  include_repos: string[];
  per_page: number;
  max_pages_per_topic: number;
}

export interface OutputConfig {
  output_path: string;
  manifest_path: string;
  overrides_path: string;
  state_db_path: string;
}

export interface FetchConfig {
  request_delay_ms: number;
  retry_limit: number;
  batch_size: number;
  batch_pause_ms: number;
  concurrency: number;
}

export interface FilterConfig {
  min_stars: number;
  skip_archived: boolean;
  skip_disabled: boolean;
  stale_after_days: number;
}

export interface SortConfig {
  sort_by: "stars" | "updated_at" | "name";
  sort_order: "asc" | "desc";
}

export interface RuntimeConfig {
  scan_interval_seconds: number;
  max_repos_per_run: number;
  log_level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
}

export interface PublishConfig {
  publish_enabled: boolean;
  publish_remote: string;
  publish_branch: string;
  publish_commit_message: string;
}

export type Config = DiscoveryConfig &
  OutputConfig &
  FetchConfig &
  FilterConfig &
  SortConfig &
  RuntimeConfig &
  PublishConfig;

const DEFAULTS: Config = {
  topics: ["neovim-colorscheme", "nvim-theme", "vim-colorscheme"],
  include_repos: [],
  output_path: "artifacts/themes.json",
  manifest_path: "artifacts/manifest.json",
  overrides_path: "overrides.json",
  state_db_path: ".state/indexer.db",
  per_page: 100,
  max_pages_per_topic: 5,
  request_delay_ms: 250,
  retry_limit: 3,
  batch_size: 50,
  batch_pause_ms: 0,
  concurrency: 5,
  min_stars: 0,
  skip_archived: true,
  skip_disabled: true,
  stale_after_days: 14,
  sort_by: "stars",
  sort_order: "desc",
  scan_interval_seconds: 1800,
  max_repos_per_run: 0,
  log_level: "INFO",
  publish_enabled: false,
  publish_remote: "origin",
  publish_branch: "master",
  publish_commit_message: "chore(registry): publish latest index artifacts",
};

const VALID_SORT_BY = ["stars", "updated_at", "name"] as const;
const VALID_SORT_ORDER = ["asc", "desc"] as const;
const VALID_LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR"] as const;

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseInt_(value: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

function parseBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function parseEnum<T extends string>(value: unknown, valid: readonly T[], fallback: T): T {
  if (typeof value === "string" && valid.includes(value as T)) return value as T;
  return fallback;
}

export function loadConfig(path: string): Config {
  let raw: Record<string, unknown> = {};

  if (existsSync(path)) {
    try {
      const content = readFileSync(path, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        raw = parsed;
      }
    } catch {
      raw = {};
    }
  }

  const user: Partial<Config> = {
    topics: parseStringArray(raw.topics),
    include_repos: parseStringArray(raw.include_repos),
    output_path: parseString(raw.output_path, DEFAULTS.output_path),
    manifest_path: parseString(raw.manifest_path, DEFAULTS.manifest_path),
    overrides_path: parseString(raw.overrides_path, DEFAULTS.overrides_path),
    state_db_path: parseString(raw.state_db_path, DEFAULTS.state_db_path),
    per_page: parseInt_(raw.per_page, DEFAULTS.per_page, 1, 100),
    max_pages_per_topic: parseInt_(raw.max_pages_per_topic, DEFAULTS.max_pages_per_topic, 0, 50),
    request_delay_ms: parseInt_(raw.request_delay_ms, DEFAULTS.request_delay_ms, 0),
    retry_limit: parseInt_(raw.retry_limit, DEFAULTS.retry_limit, 1, 10),
    batch_size: parseInt_(raw.batch_size, DEFAULTS.batch_size, 1),
    batch_pause_ms: parseInt_(raw.batch_pause_ms, DEFAULTS.batch_pause_ms, 0),
    concurrency: parseInt_(raw.concurrency, DEFAULTS.concurrency, 1, 20),
    max_repos_per_run: parseInt_(raw.max_repos_per_run, DEFAULTS.max_repos_per_run, 0),
    scan_interval_seconds: parseInt_(raw.scan_interval_seconds, DEFAULTS.scan_interval_seconds, 60),
    stale_after_days: parseInt_(raw.stale_after_days, DEFAULTS.stale_after_days, 1),
    min_stars: parseInt_(raw.min_stars, DEFAULTS.min_stars, 0),
    skip_archived: parseBool(raw.skip_archived, DEFAULTS.skip_archived),
    skip_disabled: parseBool(raw.skip_disabled, DEFAULTS.skip_disabled),
    sort_by: parseEnum(raw.sort_by, VALID_SORT_BY, DEFAULTS.sort_by),
    sort_order: parseEnum(raw.sort_order, VALID_SORT_ORDER, DEFAULTS.sort_order),
    log_level: parseEnum(
      typeof raw.log_level === "string" ? raw.log_level.toUpperCase() : raw.log_level,
      VALID_LOG_LEVELS,
      DEFAULTS.log_level
    ),
    publish_enabled: parseBool(raw.publish_enabled, DEFAULTS.publish_enabled),
    publish_remote: parseString(raw.publish_remote, DEFAULTS.publish_remote),
    publish_branch: parseString(raw.publish_branch, DEFAULTS.publish_branch),
    publish_commit_message: parseString(raw.publish_commit_message, DEFAULTS.publish_commit_message),
  };

  if (user.topics?.length === 0) {
    delete user.topics;
  }
  if (user.include_repos?.length === 0) {
    delete user.include_repos;
  }

  // Use defu but override array merge behavior (replace, not concat)
  const merged = defu(user, DEFAULTS) as Config;

  // Ensure arrays are replaced, not concatenated
  if (user.topics && user.topics.length > 0) {
    merged.topics = user.topics;
  }
  if (user.include_repos && user.include_repos.length > 0) {
    merged.include_repos = user.include_repos;
  }

  return merged;
}

export { DEFAULTS as DEFAULT_CONFIG };
export const DEFAULT_DISCOVERY = {
  topics: DEFAULTS.topics,
  include_repos: DEFAULTS.include_repos,
  per_page: DEFAULTS.per_page,
  max_pages_per_topic: DEFAULTS.max_pages_per_topic,
} satisfies DiscoveryConfig;

export const DEFAULT_OUTPUT = {
  output_path: DEFAULTS.output_path,
  manifest_path: DEFAULTS.manifest_path,
  overrides_path: DEFAULTS.overrides_path,
  state_db_path: DEFAULTS.state_db_path,
} satisfies OutputConfig;

export const DEFAULT_FETCH = {
  request_delay_ms: DEFAULTS.request_delay_ms,
  retry_limit: DEFAULTS.retry_limit,
  batch_size: DEFAULTS.batch_size,
  batch_pause_ms: DEFAULTS.batch_pause_ms,
  concurrency: DEFAULTS.concurrency,
} satisfies FetchConfig;

export const DEFAULT_FILTER = {
  min_stars: DEFAULTS.min_stars,
  skip_archived: DEFAULTS.skip_archived,
  skip_disabled: DEFAULTS.skip_disabled,
  stale_after_days: DEFAULTS.stale_after_days,
} satisfies FilterConfig;

export const DEFAULT_SORT = {
  sort_by: DEFAULTS.sort_by,
  sort_order: DEFAULTS.sort_order,
} satisfies SortConfig;

export const DEFAULT_RUNTIME = {
  scan_interval_seconds: DEFAULTS.scan_interval_seconds,
  max_repos_per_run: DEFAULTS.max_repos_per_run,
  log_level: DEFAULTS.log_level,
} satisfies RuntimeConfig;

export const DEFAULT_PUBLISH = {
  publish_enabled: DEFAULTS.publish_enabled,
  publish_remote: DEFAULTS.publish_remote,
  publish_branch: DEFAULTS.publish_branch,
  publish_commit_message: DEFAULTS.publish_commit_message,
} satisfies PublishConfig;
