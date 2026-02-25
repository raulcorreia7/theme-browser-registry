import type { GitHubRepoItem, GitHubTreeItem, ThemeEntry, ThemeMode, ThemeVariant } from "../types/schemas.js";

const COLORS_FILE_PATTERN = /^colors\/([^/]+)\.(vim|lua)$/;

const DARK_MODE_PATTERNS = [
  /dark$/,
  /night$/,
  /moon$/,
  /storm$/,
  /mocha$/,
  /frappe$/,
  /macchiato$/,
  /deep$/,
  /black$/,
  /shadow$/,
  /midnight$/,
  /abyss$/,
];

const LIGHT_MODE_PATTERNS = [
  /light$/,
  /day$/,
  /sun$/,
  /latte$/,
  /bright$/,
  /white$/,
  /paper$/,
  /cream$/,
  /morning$/,
];

const SUFFIXES_TO_STRIP = [
  ".nvim",
  ".vim",
  ".lua",
  "-nvim",
  "_nvim",
  "-vim",
  "_vim",
  "-colorscheme",
];

/**
 * Sanitizes a repository name by removing common theme-related suffixes.
 * @param repoName - The repository name to sanitize
 * @returns The sanitized name
 */
function sanitizeRepoName(repoName: string): string {
  let candidate = repoName.toLowerCase().trim();
  for (const suffix of SUFFIXES_TO_STRIP) {
    if (candidate.endsWith(suffix) && candidate.length > suffix.length) {
      candidate = candidate.slice(0, -suffix.length);
    }
  }
  candidate = candidate.replace(/^[-_]+|[-_]+$/g, "");
  return candidate;
}

/**
 * Normalizes a full repository name (owner/repo) to a theme name.
 * Strips common suffixes and falls back to owner name if the repo name is invalid.
 * @param fullRepo - Repository name in "owner/repo" format or just "repo"
 * @returns The normalized theme name
 */
export function normalizeThemeName(fullRepo: string): string {
  const slashIndex = fullRepo.indexOf("/");
  const owner = slashIndex >= 0 ? fullRepo.slice(0, slashIndex) : "";
  const repoName = slashIndex >= 0 ? fullRepo.slice(slashIndex + 1) : fullRepo;

  const cleanedRepo = sanitizeRepoName(repoName);
  const invalidNames = new Set(["", "nvim", "vim", "neovim", "theme", "colorscheme"]);

  if (invalidNames.has(cleanedRepo)) {
    const fallback = sanitizeRepoName(owner);
    if (fallback) {
      return fallback;
    }
  }

  return cleanedRepo || sanitizeRepoName(owner) || "theme";
}

/**
 * Extracts colorscheme names from GitHub tree items.
 * Looks for files in the colors/ directory with .vim or .lua extensions.
 * @param treeItems - Array of tree items from a GitHub repository
 * @returns Sorted array of unique colorscheme names
 */
export function extractColorschemes(treeItems: GitHubTreeItem[]): string[] {
  const colors = new Set<string>();

  for (const item of treeItems) {
    if (item.type !== "blob") {
      continue;
    }

    const match = item.path.match(COLORS_FILE_PATTERN);
    if (!match || !match[1]) {
      continue;
    }

    const colorscheme = match[1].trim();
    if (colorscheme) {
      colors.add(colorscheme);
    }
  }

  return Array.from(colors).sort();
}

/**
 * Picks the base colorscheme from a list based on theme name matching.
 * Prefers colorschemes that match the theme name or have no separators.
 * @param themeName - The normalized theme name
 * @param colors - Array of available colorscheme names
 * @returns The selected base colorscheme name
 */
function detectVariantMode(variantName: string): ThemeMode | undefined {
  const lower = variantName.toLowerCase();

  for (const pattern of LIGHT_MODE_PATTERNS) {
    if (pattern.test(lower)) {
      return "light";
    }
  }

  for (const pattern of DARK_MODE_PATTERNS) {
    if (pattern.test(lower)) {
      return "dark";
    }
  }

  return undefined;
}

function pickBaseColorscheme(themeName: string, colors: string[]): string {
  if (colors.length === 0) {
    return themeName;
  }

  const preferred = new Set([
    themeName,
    themeName.replace(/-/g, "_"),
    themeName.replace(/_/g, "-"),
  ]);

  for (const candidate of colors) {
    if (preferred.has(candidate)) {
      return candidate;
    }
  }

  for (const candidate of colors) {
    if (!candidate.includes("-") && !candidate.includes("_")) {
      return candidate;
    }
  }

  return colors[0]!;
}

/**
 * Builds a ThemeEntry from repository metadata and colorschemes.
 * @param repoPayload - Repository metadata from GitHub API
 * @param colorschemes - Array of colorscheme names found in the repository
 * @returns A complete ThemeEntry object
 * @throws Error if the repository payload is invalid
 */
export function buildEntry(repoPayload: GitHubRepoItem, colorschemes: string[]): ThemeEntry {
  const fullName = repoPayload.full_name;
  if (!fullName || !fullName.includes("/")) {
    throw new Error("invalid repository payload");
  }

  const themeName = normalizeThemeName(fullName);
  const baseColorscheme = pickBaseColorscheme(themeName, colorschemes);

  const variants: ThemeVariant[] = colorschemes
    .filter((c) => c !== baseColorscheme)
    .map((value) => {
      const variant: ThemeVariant = {
        name: value,
        colorscheme: value,
      };
      const mode = detectVariantMode(value);
      if (mode) {
        variant.mode = mode;
      }
      return variant;
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
