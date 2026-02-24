import type {
  ThemeEntry,
  ThemeVariant,
  ThemeMeta,
  GitHubRepoItem,
  GitHubTreeItem,
  RepoCacheEntry,
  LoadStrategy,
  LoadAdapter,
} from "./types.js";

export function createThemeMeta(data: Partial<ThemeMeta> = {}): ThemeMeta {
  return {
    ...data,
  };
}

export function createThemeVariant(name: string, colorscheme: string, meta?: ThemeMeta): ThemeVariant {
  const variant: ThemeVariant = { name, colorscheme };
  if (meta !== undefined) {
    variant.meta = meta;
  }
  return variant;
}

export function createThemeEntry(
  name: string,
  repo: string,
  colorscheme: string,
  options: Partial<Omit<ThemeEntry, "name" | "repo" | "colorscheme">> = {}
): ThemeEntry {
  const entry: ThemeEntry = { name, repo, colorscheme };
  if (options.description !== undefined) entry.description = options.description;
  if (options.stars !== undefined) entry.stars = options.stars;
  if (options.topics !== undefined) entry.topics = options.topics;
  if (options.updated_at !== undefined) entry.updated_at = options.updated_at;
  if (options.archived !== undefined) entry.archived = options.archived;
  if (options.disabled !== undefined) entry.disabled = options.disabled;
  if (options.homepage !== undefined) entry.homepage = options.homepage;
  if (options.meta !== undefined) entry.meta = options.meta;
  if (options.variants !== undefined) entry.variants = options.variants;
  return entry;
}

export function createRepoCacheEntry(
  repo: string,
  updatedAt: string,
  scannedAt: number,
  payload: ThemeEntry | Record<string, unknown> | null,
  parseError: string | null = null
): RepoCacheEntry {
  return {
    repo,
    updated_at: updatedAt,
    scanned_at: scannedAt,
    payload,
    parse_error: parseError,
  };
}

const VALID_STRATEGIES: Set<string> = new Set(["colorscheme_only", "setup_colorscheme", "vimg_colorscheme"]);
const VALID_ADAPTERS: Set<string> = new Set(["load", "setup_load", "use"]);

export function isValidStrategy(value: unknown): value is LoadStrategy {
  return typeof value === "string" && VALID_STRATEGIES.has(value);
}

export function isValidAdapter(value: unknown): value is LoadAdapter {
  return typeof value === "string" && VALID_ADAPTERS.has(value);
}

export function isThemeMeta(value: unknown): value is ThemeMeta {
  if (value === null || typeof value !== "object") return false;
  const meta = value as Record<string, unknown>;
  if (meta["strategy"] !== undefined && !isValidStrategy(meta["strategy"])) return false;
  if (meta["adapter"] !== undefined && !isValidAdapter(meta["adapter"])) return false;
  if (meta["module"] !== undefined && typeof meta["module"] !== "string") return false;
  if (meta["opts_g"] !== undefined) {
    if (typeof meta["opts_g"] !== "object" || meta["opts_g"] === null) return false;
    const opts = meta["opts_g"] as Record<string, unknown>;
    for (const v of Object.values(opts)) {
      if (typeof v !== "string") return false;
    }
  }
  if (meta["background"] !== undefined && !["dark", "light"].includes(meta["background"] as string)) {
    return false;
  }
  return true;
}

export function isThemeVariant(value: unknown): value is ThemeVariant {
  if (value === null || typeof value !== "object") return false;
  const variant = value as Record<string, unknown>;
  if (typeof variant["name"] !== "string") return false;
  if (typeof variant["colorscheme"] !== "string") return false;
  if (variant["meta"] !== undefined && !isThemeMeta(variant["meta"])) return false;
  return true;
}

export function isThemeEntry(value: unknown): value is ThemeEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry["name"] !== "string") return false;
  if (typeof entry["repo"] !== "string") return false;
  if (typeof entry["colorscheme"] !== "string") return false;
  if (entry["description"] !== undefined && typeof entry["description"] !== "string") return false;
  if (entry["stars"] !== undefined && typeof entry["stars"] !== "number") return false;
  if (entry["topics"] !== undefined && !Array.isArray(entry["topics"])) return false;
  if (entry["updated_at"] !== undefined && typeof entry["updated_at"] !== "string") return false;
  if (entry["archived"] !== undefined && typeof entry["archived"] !== "boolean") return false;
  if (entry["disabled"] !== undefined && typeof entry["disabled"] !== "boolean") return false;
  if (entry["homepage"] !== undefined && typeof entry["homepage"] !== "string") return false;
  if (entry["meta"] !== undefined && !isThemeMeta(entry["meta"])) return false;
  if (entry["variants"] !== undefined) {
    if (!Array.isArray(entry["variants"])) return false;
    for (const v of entry["variants"]) {
      if (!isThemeVariant(v)) return false;
    }
  }
  return true;
}

export function isGitHubRepoItem(value: unknown): value is GitHubRepoItem {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item["id"] !== "number") return false;
  if (typeof item["full_name"] !== "string") return false;
  if (item["description"] !== null && typeof item["description"] !== "string") return false;
  if (typeof item["stargazers_count"] !== "number") return false;
  if (!Array.isArray(item["topics"])) return false;
  if (typeof item["updated_at"] !== "string") return false;
  if (typeof item["archived"] !== "boolean") return false;
  if (typeof item["disabled"] !== "boolean") return false;
  if (typeof item["html_url"] !== "string") return false;
  return true;
}

export function isGitHubTreeItem(value: unknown): value is GitHubTreeItem {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item["path"] !== "string") return false;
  if (typeof item["mode"] !== "string") return false;
  if (!["blob", "tree", "commit"].includes(item["type"] as string)) return false;
  if (typeof item["sha"] !== "string") return false;
  if (item["size"] !== undefined && typeof item["size"] !== "number") return false;
  if (typeof item["url"] !== "string") return false;
  return true;
}

export function isRepoCacheEntry(value: unknown): value is RepoCacheEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry["repo"] !== "string") return false;
  if (typeof entry["updated_at"] !== "string") return false;
  if (typeof entry["scanned_at"] !== "number") return false;
  if (entry["payload"] !== null && typeof entry["payload"] !== "object") return false;
  if (entry["parse_error"] !== null && typeof entry["parse_error"] !== "string") return false;
  return true;
}
