import type { ThemeEntry, ThemeMode } from "@/lib/types";

const THEME_NAME = {
  MIN_LENGTH: 2,
  MAX_LENGTH: 64,
  DOT_CHAR_CODE: 46,
} as const;

const RE_VALID_NAME = /^[a-zA-Z0-9_-]+$/;

const LIGHT_SUBSTRINGS = ["-light", "-day", "-latte", "-dawn", "-morning", "light-", "day-", "dawn-", "_light", "_day", "-snow", "-operandi", "-lumi"] as const;
const DARK_SUBSTRINGS = ["-dark", "-night", "-moon", "-storm", "-mocha", "-dragon", "-wave", "dark-", "night-", "_dark", "_night", "-dusk", "-vivendi", "-ember", "-fog", "-moss"] as const;

const DEFAULT_STRATEGY = "colorscheme";

function containsAny(text: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (text.includes(pattern)) return true;
  }
  return false;
}

export function isValidThemeName(name: string | undefined): boolean {
  if (!name || typeof name !== "string") return false;
  if (name.length < THEME_NAME.MIN_LENGTH || name.length > THEME_NAME.MAX_LENGTH) return false;
  if (name.charCodeAt(0) === THEME_NAME.DOT_CHAR_CODE) return false;
  return RE_VALID_NAME.test(name);
}

export function inferModeFromColorscheme(colorscheme: string | undefined): ThemeMode | null {
  if (!colorscheme || typeof colorscheme !== "string") return null;
  const name = colorscheme.toLowerCase();

  if (containsAny(name, LIGHT_SUBSTRINGS)) return "light";
  if (containsAny(name, DARK_SUBSTRINGS)) return "dark";
  return null;
}

export type ThemeWithMeta = ThemeEntry & {
  meta?: {
    strategy?: {
      type?: string;
      module?: string;
      file?: string;
    };
    mode?: ThemeMode | undefined;
  };
  variants?: Array<{
    name: string;
    colorscheme?: string;
    mode?: ThemeMode | undefined;
    meta?: { strategy?: { type?: string } };
  }>;
};

export function getThemeStrategy(theme: ThemeWithMeta): string {
  if (theme.meta?.strategy?.type) return theme.meta.strategy.type;
  if (theme.variants?.[0]?.meta?.strategy?.type) return theme.variants[0].meta.strategy.type;
  return DEFAULT_STRATEGY;
}

function isNeovimTheme(repo: string | undefined): boolean {
  return Boolean(repo && (repo.includes(".nvim") || repo.includes("neovim")));
}

export function deduplicateThemes(themes: ThemeWithMeta[]): ThemeWithMeta[] {
  const themesByName = new Map<string, ThemeWithMeta>();

  for (const theme of themes) {
    if (!theme.name || !isValidThemeName(theme.name)) continue;

    const nameLower = theme.name.toLowerCase();
    const existing = themesByName.get(nameLower);

    if (!existing) {
      themesByName.set(nameLower, theme);
      continue;
    }

    const existingIsNeovim = isNeovimTheme(existing.repo);
    const newIsNeovim = isNeovimTheme(theme.repo);
    const existingStars = existing.stars ?? 0;
    const newStars = theme.stars ?? 0;

    const newIsBetter = (newIsNeovim && !existingIsNeovim) || (newIsNeovim === existingIsNeovim && newStars > existingStars);

    if (newIsBetter) {
      themesByName.set(nameLower, theme);
    }
  }

  return Array.from(themesByName.values());
}

export function applyInferredModes(themes: ThemeWithMeta[]): ThemeWithMeta[] {
  return themes.map(theme => {
    const baseMode = inferModeFromColorscheme(theme.colorscheme);

    const variantsWithMode = theme.variants?.map(variant => {
      if (variant.mode) return variant;
      const inferredMode = inferModeFromColorscheme(variant.colorscheme ?? variant.name);
      return inferredMode ? { ...variant, mode: inferredMode } : variant;
    });

    const inferredBaseMode = baseMode ?? theme.meta?.mode;

    return {
      ...theme,
      meta: {
        ...theme.meta,
        mode: inferredBaseMode,
      },
      variants: variantsWithMode,
    } as ThemeWithMeta;
  });
}
