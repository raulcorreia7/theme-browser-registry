import { readFileSync, existsSync } from "node:fs";

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

export interface Config
  extends DiscoveryConfig,
    OutputConfig,
    FetchConfig,
    FilterConfig,
    SortConfig,
    RuntimeConfig,
    PublishConfig {}

export const DEFAULT_DISCOVERY: DiscoveryConfig = {
  topics: ["neovim-colorscheme", "nvim-theme", "vim-colorscheme"],
  include_repos: [],
  per_page: 100,
  max_pages_per_topic: 5,
};

export const DEFAULT_OUTPUT: OutputConfig = {
  output_path: "artifacts/themes.json",
  manifest_path: "artifacts/manifest.json",
  overrides_path: "overrides.json",
  state_db_path: ".state/indexer.db",
};

export const DEFAULT_FETCH: FetchConfig = {
  request_delay_ms: 250,
  retry_limit: 3,
  batch_size: 50,
  batch_pause_ms: 0,
  concurrency: 5,
};

export const DEFAULT_FILTER: FilterConfig = {
  min_stars: 0,
  skip_archived: true,
  skip_disabled: true,
  stale_after_days: 14,
};

export const DEFAULT_SORT: SortConfig = {
  sort_by: "stars",
  sort_order: "desc",
};

export const DEFAULT_RUNTIME: RuntimeConfig = {
  scan_interval_seconds: 1800,
  max_repos_per_run: 0,
  log_level: "INFO",
};

export const DEFAULT_PUBLISH: PublishConfig = {
  publish_enabled: false,
  publish_remote: "origin",
  publish_branch: "master",
  publish_commit_message: "chore(registry): publish latest index artifacts",
};

export const DEFAULT_CONFIG: Config = {
  ...DEFAULT_DISCOVERY,
  ...DEFAULT_OUTPUT,
  ...DEFAULT_FETCH,
  ...DEFAULT_FILTER,
  ...DEFAULT_SORT,
  ...DEFAULT_RUNTIME,
  ...DEFAULT_PUBLISH,
};

type RawConfig = Record<string, unknown>;

function asInt(value: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof value === "boolean") return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  let result = value;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asStr(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return fallback;
}

function asStrList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (normalized === "" || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function parseDiscovery(raw: RawConfig): DiscoveryConfig {
  const topics = asStrList(raw["topics"]);
  return {
    topics: topics.length > 0 ? topics : DEFAULT_DISCOVERY.topics,
    include_repos: asStrList(raw["include_repos"]),
    per_page: asInt(raw["per_page"], DEFAULT_DISCOVERY.per_page, 1, 100),
    max_pages_per_topic: asInt(
      raw["max_pages_per_topic"],
      DEFAULT_DISCOVERY.max_pages_per_topic,
      0,
      50
    ),
  };
}

function parseOutput(raw: RawConfig): OutputConfig {
  return {
    output_path: asStr(raw["output_path"], DEFAULT_OUTPUT.output_path),
    manifest_path: asStr(raw["manifest_path"], DEFAULT_OUTPUT.manifest_path),
    overrides_path: asStr(raw["overrides_path"], DEFAULT_OUTPUT.overrides_path),
    state_db_path: asStr(raw["state_db_path"], DEFAULT_OUTPUT.state_db_path),
  };
}

function parseFetch(raw: RawConfig): FetchConfig {
  return {
    request_delay_ms: asInt(raw["request_delay_ms"], DEFAULT_FETCH.request_delay_ms, 0),
    retry_limit: asInt(raw["retry_limit"], DEFAULT_FETCH.retry_limit, 1, 10),
    batch_size: asInt(raw["batch_size"], DEFAULT_FETCH.batch_size, 1),
    batch_pause_ms: asInt(raw["batch_pause_ms"], DEFAULT_FETCH.batch_pause_ms, 0),
    concurrency: asInt(raw["concurrency"], DEFAULT_FETCH.concurrency, 1, 20),
  };
}

function parseFilter(raw: RawConfig): FilterConfig {
  return {
    min_stars: asInt(raw["min_stars"], DEFAULT_FILTER.min_stars, 0),
    skip_archived: asBool(raw["skip_archived"], DEFAULT_FILTER.skip_archived),
    skip_disabled: asBool(raw["skip_disabled"], DEFAULT_FILTER.skip_disabled),
    stale_after_days: asInt(raw["stale_after_days"], DEFAULT_FILTER.stale_after_days, 1),
  };
}

function parseSort(raw: RawConfig): SortConfig {
  const sortBy = asStr(raw["sort_by"], DEFAULT_SORT.sort_by);
  const sortOrder = asStr(raw["sort_order"], DEFAULT_SORT.sort_order);
  return {
    sort_by:
      sortBy === "stars" || sortBy === "updated_at" || sortBy === "name"
        ? sortBy
        : DEFAULT_SORT.sort_by,
    sort_order: sortOrder === "asc" || sortOrder === "desc" ? sortOrder : DEFAULT_SORT.sort_order,
  };
}

function parseRuntime(raw: RawConfig): RuntimeConfig {
  const logLevel = asStr(raw["log_level"], DEFAULT_RUNTIME.log_level).toUpperCase();
  return {
    scan_interval_seconds: asInt(
      raw["scan_interval_seconds"],
      DEFAULT_RUNTIME.scan_interval_seconds,
      60
    ),
    max_repos_per_run: asInt(raw["max_repos_per_run"], DEFAULT_RUNTIME.max_repos_per_run, 0),
    log_level:
      logLevel === "DEBUG" || logLevel === "INFO" || logLevel === "WARNING" || logLevel === "ERROR"
        ? (logLevel as RuntimeConfig["log_level"])
        : DEFAULT_RUNTIME.log_level,
  };
}

function parsePublish(raw: RawConfig): PublishConfig {
  return {
    publish_enabled: asBool(raw["publish_enabled"], DEFAULT_PUBLISH.publish_enabled),
    publish_remote: asStr(raw["publish_remote"], DEFAULT_PUBLISH.publish_remote),
    publish_branch: asStr(raw["publish_branch"], DEFAULT_PUBLISH.publish_branch),
    publish_commit_message: asStr(
      raw["publish_commit_message"],
      DEFAULT_PUBLISH.publish_commit_message
    ),
  };
}

export function loadConfig(path: string): Config {
  let raw: RawConfig = {};
  if (existsSync(path)) {
    try {
      const content = readFileSync(path, { encoding: "utf-8" });
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        raw = parsed as RawConfig;
      }
    } catch {
      raw = {};
    }
  }

  return {
    ...parseDiscovery(raw),
    ...parseOutput(raw),
    ...parseFetch(raw),
    ...parseFilter(raw),
    ...parseSort(raw),
    ...parseRuntime(raw),
    ...parsePublish(raw),
  };
}
