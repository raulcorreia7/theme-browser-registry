import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ThemeMode } from "@/lib/types";
import type { ThemeWithMeta } from "./themes";

export interface BundleOptions {
  input: string;
  output: string;
  count: number;
}

export interface BundleResult {
  selected: number;
  darkCount: number;
  lightCount: number;
  outputPath: string;
}

export interface BundleMetrics {
  available: number;
  valid: number;
  withVariants: number;
  builtin: number;
  duplicates: number;
  avgStars: number;
}

interface ScoredTheme {
  theme: ThemeWithMeta;
  score: number;
  modes: Set<ThemeMode>;
}

export function getThemeModes(theme: ThemeWithMeta): Set<ThemeMode> {
  const modes = new Set<ThemeMode>();

  if (theme.meta?.mode) {
    modes.add(theme.meta.mode);
  }

  const variants = theme.variants;
  if (variants) {
    for (const variant of variants) {
      if (variant.mode) {
        modes.add(variant.mode);
      }
    }
  }

  return modes;
}

export function scoreTheme(theme: ThemeWithMeta): number {
  let score = theme.stars || 0;
  const modes = getThemeModes(theme);

  if (modes.has("dark") && modes.has("light")) {
    score *= 1.5;
  } else if (modes.has("dark")) {
    score *= 1.2;
  }

  if (theme.variants && theme.variants.length > 0) {
    score *= 1.1;
  }

  return score;
}

export function selectThemesWithHeuristics(
  themes: ThemeWithMeta[],
  targetCount: number,
): { selected: ThemeWithMeta[]; darkCount: number; lightCount: number; duplicates: number } {
  const themesByName = new Map<string, ThemeWithMeta>();
  let duplicates = 0;

  for (const theme of themes) {
    const existing = themesByName.get(theme.name);
    if (existing) {
      duplicates++;
      if ((theme.stars || 0) > (existing.stars || 0)) {
        themesByName.set(theme.name, theme);
      }
    } else {
      themesByName.set(theme.name, theme);
    }
  }

  const scoredThemes: ScoredTheme[] = Array.from(themesByName.values()).map((theme) => ({
    theme,
    score: scoreTheme(theme),
    modes: getThemeModes(theme),
  }));

  scoredThemes.sort((a, b) => b.score - a.score);

  const selected: ThemeWithMeta[] = [];
  const selectedNames = new Set<string>();
  let darkCount = 0;
  let lightCount = 0;

  const minDark = Math.floor(targetCount * 0.4);
  const minLight = Math.floor(targetCount * 0.2);

  for (const { theme, modes } of scoredThemes) {
    if (selected.length >= targetCount) break;
    if (selectedNames.has(theme.name)) continue;

    const hasDark = modes.has("dark");
    const hasLight = modes.has("light");

    const needsDark = darkCount < minDark && hasDark;
    const needsLight = lightCount < minLight && hasLight;

    if (
      needsDark ||
      needsLight ||
      selected.length <
        targetCount - Math.max(0, minDark - darkCount) - Math.max(0, minLight - lightCount)
    ) {
      selected.push(theme);
      selectedNames.add(theme.name);
      if (hasDark) darkCount++;
      if (hasLight) lightCount++;
    }
  }

  for (const { theme } of scoredThemes) {
    if (selected.length >= targetCount) break;
    if (selectedNames.has(theme.name)) continue;

    selected.push(theme);
    selectedNames.add(theme.name);
    if (getThemeModes(theme).has("dark")) darkCount++;
    if (getThemeModes(theme).has("light")) lightCount++;
  }

  selected.sort((a, b) => a.name.localeCompare(b.name));

  return { selected, darkCount, lightCount, duplicates };
}

export function run(options: BundleOptions): BundleResult {
  const { input, output, count } = options;

  if (!existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const raw = readFileSync(input, "utf-8");
  const allThemes: ThemeWithMeta[] = JSON.parse(raw);

  const validThemes = allThemes.filter((t) => t.name && t.repo && t.colorscheme);

  const { selected, darkCount, lightCount } = selectThemesWithHeuristics(validThemes, count);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(selected, null, 2) + "\n", "utf-8");

  return {
    selected: selected.length,
    darkCount,
    lightCount,
    outputPath: output,
  };
}
