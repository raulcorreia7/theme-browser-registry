import { readFileSync, existsSync } from "node:fs";

export interface Config {
  topics: string[];
  include_repos: string[];
  output_path: string;
  manifest_path: string;
  overrides_path: string;
  state_db_path: string;
  per_page: number;
  max_pages_per_topic: number;
  request_delay_ms: number;
  retry_limit: number;
  batch_size: number;
  batch_pause_ms: number;
  max_repos_per_run: number;
  scan_interval_seconds: number;
  stale_after_days: number;
  min_stars: number;
  skip_archived: boolean;
  skip_disabled: boolean;
  sort_by: "stars" | "updated_at" | "name";
  sort_order: "asc" | "desc";
  log_level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  publish_enabled: boolean;
  publish_remote: string;
  publish_branch: string;
  publish_commit_message: string;
}

export const DEFAULT_CONFIG: Config = {
  topics: ["neovim-colorscheme", "nvim-theme", "vim-colorscheme"],
  include_repos: [],
  output_path: "themes.json",
  manifest_path: "artifacts/latest.json",
  overrides_path: "overrides.json",
  state_db_path: ".state/indexer.db",
  per_page: 100,
  max_pages_per_topic: 5,
  request_delay_ms: 250,
  retry_limit: 3,
  batch_size: 50,
  batch_pause_ms: 0,
  max_repos_per_run: 0,
  scan_interval_seconds: 1800,
  stale_after_days: 14,
  min_stars: 0,
  skip_archived: true,
  skip_disabled: true,
  sort_by: "stars",
  sort_order: "desc",
  log_level: "INFO",
  publish_enabled: false,
  publish_remote: "origin",
  publish_branch: "master",
  publish_commit_message: "chore(registry): publish latest index artifacts",
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

function validateSortBy(value: string): Config["sort_by"] {
  if (value === "stars" || value === "updated_at" || value === "name") return value;
  return DEFAULT_CONFIG.sort_by;
}

function validateSortOrder(value: string): Config["sort_order"] {
  if (value === "asc" || value === "desc") return value;
  return DEFAULT_CONFIG.sort_order;
}

function validateLogLevel(value: string): Config["log_level"] {
  const upper = value.toUpperCase();
  if (upper === "DEBUG" || upper === "INFO" || upper === "WARNING" || upper === "ERROR") {
    return upper;
  }
  return DEFAULT_CONFIG.log_level;
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

  const sortBy = validateSortBy(asStr(raw["sort_by"], DEFAULT_CONFIG.sort_by));
  const sortOrder = validateSortOrder(asStr(raw["sort_order"], DEFAULT_CONFIG.sort_order));
  const logLevel = validateLogLevel(asStr(raw["log_level"], DEFAULT_CONFIG.log_level));
  const topics = asStrList(raw["topics"]);
  const includeRepos = asStrList(raw["include_repos"]);

  return {
    topics: topics.length > 0 ? topics : DEFAULT_CONFIG.topics,
    include_repos: includeRepos,
    output_path: asStr(raw["output_path"], DEFAULT_CONFIG.output_path),
    manifest_path: asStr(raw["manifest_path"], DEFAULT_CONFIG.manifest_path),
    overrides_path: asStr(raw["overrides_path"], DEFAULT_CONFIG.overrides_path),
    state_db_path: asStr(raw["state_db_path"], DEFAULT_CONFIG.state_db_path),
    per_page: asInt(raw["per_page"], DEFAULT_CONFIG.per_page, 1, 100),
    max_pages_per_topic: asInt(
      raw["max_pages_per_topic"],
      DEFAULT_CONFIG.max_pages_per_topic,
      0,
      50
    ),
    request_delay_ms: asInt(raw["request_delay_ms"], DEFAULT_CONFIG.request_delay_ms, 0),
    retry_limit: asInt(raw["retry_limit"], DEFAULT_CONFIG.retry_limit, 1, 10),
    batch_size: asInt(raw["batch_size"], DEFAULT_CONFIG.batch_size, 1),
    batch_pause_ms: asInt(raw["batch_pause_ms"], DEFAULT_CONFIG.batch_pause_ms, 0),
    max_repos_per_run: asInt(raw["max_repos_per_run"], DEFAULT_CONFIG.max_repos_per_run, 0),
    scan_interval_seconds: asInt(
      raw["scan_interval_seconds"],
      DEFAULT_CONFIG.scan_interval_seconds,
      60
    ),
    stale_after_days: asInt(raw["stale_after_days"], DEFAULT_CONFIG.stale_after_days, 1),
    min_stars: asInt(raw["min_stars"], DEFAULT_CONFIG.min_stars, 0),
    skip_archived: asBool(raw["skip_archived"], DEFAULT_CONFIG.skip_archived),
    skip_disabled: asBool(raw["skip_disabled"], DEFAULT_CONFIG.skip_disabled),
    sort_by: sortBy,
    sort_order: sortOrder,
    log_level: logLevel,
    publish_enabled: asBool(raw["publish_enabled"], DEFAULT_CONFIG.publish_enabled),
    publish_remote: asStr(raw["publish_remote"], DEFAULT_CONFIG.publish_remote),
    publish_branch: asStr(raw["publish_branch"], DEFAULT_CONFIG.publish_branch),
    publish_commit_message: asStr(
      raw["publish_commit_message"],
      DEFAULT_CONFIG.publish_commit_message
    ),
  };
}
