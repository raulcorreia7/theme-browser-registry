import type {
  GitHubRepoItem,
  GitHubTreeItem,
  ThemeEntry,
  ThemeMode,
  ThemeVariant,
} from "@/lib/types";

const RE_COLORS_FILE = /^colors\/([^/]+)\.(vim|lua)$/;
const RE_TRIM_DASHES = /^[-_]+|[-_]+$/g;

const DARK_MODE_SUFFIXES = [
  "dark",
  "night",
  "moon",
  "storm",
  "mocha",
  "frappe",
  "macchiato",
  "deep",
  "black",
  "shadow",
  "midnight",
  "abyss",
] as const;
const LIGHT_MODE_SUFFIXES = [
  "light",
  "day",
  "sun",
  "latte",
  "bright",
  "white",
  "paper",
  "cream",
  "morning",
] as const;

const SUFFIXES_TO_STRIP = [
  ".nvim",
  ".vim",
  ".lua",
  "-nvim",
  "_nvim",
  "-vim",
  "_vim",
  "-colorscheme",
] as const;

const INVALID_THEME_NAMES = new Set(["", "nvim", "vim", "neovim", "theme", "colorscheme"]);

const DEFAULT_FALLBACK_NAME = "theme";

function hasSuffix(name: string, suffixes: readonly string[]): boolean {
  for (const suffix of suffixes) {
    if (name.endsWith(suffix)) return true;
  }
  return false;
}

function sanitizeRepoName(repoName: string): string {
  let candidate = repoName.toLowerCase().trim();
  for (const suffix of SUFFIXES_TO_STRIP) {
    if (candidate.endsWith(suffix) && candidate.length > suffix.length) {
      candidate = candidate.slice(0, -suffix.length);
    }
  }
  return candidate.replace(RE_TRIM_DASHES, "");
}

export function normalizeThemeName(fullRepo: string): string {
  const slashIndex = fullRepo.indexOf("/");
  const owner = slashIndex >= 0 ? fullRepo.slice(0, slashIndex) : "";
  const repoName = slashIndex >= 0 ? fullRepo.slice(slashIndex + 1) : fullRepo;

  const cleanedRepo = sanitizeRepoName(repoName);

  if (INVALID_THEME_NAMES.has(cleanedRepo)) {
    const fallback = sanitizeRepoName(owner);
    if (fallback) return fallback;
  }

  return cleanedRepo || sanitizeRepoName(owner) || DEFAULT_FALLBACK_NAME;
}

export function extractColorschemes(treeItems: GitHubTreeItem[]): string[] {
  const colors = new Set<string>();

  for (const item of treeItems) {
    if (item.type !== "blob") continue;

    const match = item.path.match(RE_COLORS_FILE);
    if (!match?.[1]) continue;

    const colorscheme = match[1].trim();
    if (colorscheme) colors.add(colorscheme);
  }

  return Array.from(colors).sort();
}

function detectVariantMode(variantName: string): ThemeMode | undefined {
  const lower = variantName.toLowerCase();

  if (hasSuffix(lower, LIGHT_MODE_SUFFIXES)) return "light";
  if (hasSuffix(lower, DARK_MODE_SUFFIXES)) return "dark";

  return undefined;
}

function pickBaseColorscheme(themeName: string, colors: string[]): string {
  if (colors.length === 0) return themeName;

  const preferred = new Set([
    themeName,
    themeName.replace(/-/g, "_"),
    themeName.replace(/_/g, "-"),
  ]);

  for (const candidate of colors) {
    if (preferred.has(candidate)) return candidate;
  }

  for (const candidate of colors) {
    if (!candidate.includes("-") && !candidate.includes("_")) return candidate;
  }

  return colors[0]!;
}

export function buildEntry(repoPayload: GitHubRepoItem, colorschemes: string[]): ThemeEntry {
  const fullName = repoPayload.full_name;
  if (!fullName?.includes("/")) {
    throw new Error("invalid repository payload");
  }

  const themeName = normalizeThemeName(fullName);
  const baseColorscheme = pickBaseColorscheme(themeName, colorschemes);

  const variants: ThemeVariant[] = colorschemes
    .filter((c) => c !== baseColorscheme)
    .map((value): ThemeVariant => {
      const mode = detectVariantMode(value);
      return mode ? { name: value, colorscheme: value, mode } : { name: value, colorscheme: value };
    });

  const topics = Array.isArray(repoPayload.topics)
    ? repoPayload.topics.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];

  const entry: ThemeEntry = {
    name: themeName,
    repo: fullName,
    colorscheme: baseColorscheme,
    description: repoPayload.description ?? "",
    stars: repoPayload.stargazers_count ?? 0,
    topics,
    updated_at: repoPayload.updated_at ?? "",
    archived: repoPayload.archived ?? false,
    disabled: repoPayload.disabled ?? false,
  };

  if (variants.length > 0) {
    entry.variants = variants;
  }

  return entry;
}
