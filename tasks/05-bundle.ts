#!/usr/bin/env tsx
/**
 * 05-bundle.ts - Copy top themes to plugin for offline use
 *
 * Filters the top N themes by stars with mode coverage heuristics:
 * - Ensures mix of dark/light themes
 * - Prioritizes popular themes (by stars)
 * - Limits to 50 themes for plugin bundle size
 *
 * Usage: tsx tasks/05-bundle.ts [options]
 *
 * Options:
 *   -i, --input <path>    Input themes.json (default: artifacts/themes.json)
 *   -o, --output <path>   Output registry.json (default: ../plugin/lua/theme-browser/data/registry.json)
 *   -n, --count <n>       Number of themes to include (default: 50)
 *   -h, --help            Show help
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import consola from "consola";
import type { ThemeEntry, ThemeMode } from "@/lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

interface CliArgs {
  input: string;
  output: string;
  count: number;
}

interface ScoredTheme {
  theme: ThemeEntry;
  score: number;
  modes: Set<ThemeMode>;
}

interface DuplicateInfo {
  name: string;
  kept: string | undefined;
  skipped: string | undefined;
  keptStars: number;
  skippedStars: number;
}

interface SelectionResult {
  selected: ThemeEntry[];
  darkCount: number;
  lightCount: number;
  duplicates: number;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i", default: "artifacts/themes.json" },
      output: { type: "string", short: "o", default: "../plugin/lua/theme-browser/data/registry.json" },
      count: { type: "string", short: "n", default: "50" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
05-bundle - Copy top themes to plugin for offline use

Usage:
  05-bundle [options]

Options:
  -i, --input <path>    Input themes.json (default: artifacts/themes.json)
  -o, --output <path>   Output registry.json (default: ../plugin/lua/theme-browser/data/registry.json)
  -n, --count <n>       Number of themes to include (default: 50)
  -h, --help            Show help

Mode Heuristics:
  - Prioritizes themes with both dark and light variants
  - Ensures at least 40% dark and 20% light mode coverage
  - Falls back to popularity (stars) if mode constraints can't be met
`);
    process.exit(0);
  }

  const count = parseInt(values.count, 10);
  if (isNaN(count) || count < 1 || count > 200) {
    console.error("Error: --count must be between 1 and 200");
    process.exit(1);
  }

  return {
    input: resolve(ROOT, values.input),
    output: resolve(ROOT, values.output),
    count,
  };
}

function getThemeModes(theme: ThemeEntry): Set<ThemeMode> {
  const modes = new Set<ThemeMode>();

  if (theme.mode) {
    modes.add(theme.mode);
  }

  if (theme.variants) {
    for (const variant of theme.variants) {
      if (variant.mode) {
        modes.add(variant.mode);
      }
    }
  }

  return modes;
}

function scoreTheme(theme: ThemeEntry): number {
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

function selectThemesWithHeuristics(themes: ThemeEntry[], targetCount: number): SelectionResult {
  const themesByName = new Map<string, ThemeEntry>();
  const duplicates: DuplicateInfo[] = [];

  for (const theme of themes) {
    const existing = themesByName.get(theme.name);
    if (existing) {
      duplicates.push({
        name: theme.name,
        kept: existing.repo,
        skipped: theme.repo,
        keptStars: existing.stars || 0,
        skippedStars: theme.stars || 0,
      });
      if ((theme.stars || 0) > (existing.stars || 0)) {
        themesByName.set(theme.name, theme);
      }
    } else {
      themesByName.set(theme.name, theme);
    }
  }

  if (duplicates.length > 0) {
    consola.log(`  Resolved ${duplicates.length} duplicate theme names (kept highest stars)`);
    for (const dup of duplicates.slice(0, 5)) {
      consola.log(`    ${dup.name}: kept ${dup.kept} (${dup.keptStars}⭐) over ${dup.skipped} (${dup.skippedStars}⭐)`);
    }
    if (duplicates.length > 5) {
      consola.log(`    ... and ${duplicates.length - 5} more`);
    }
  }

  const scoredThemes: ScoredTheme[] = Array.from(themesByName.values()).map((theme) => ({
    theme,
    score: scoreTheme(theme),
    modes: getThemeModes(theme),
  }));

  scoredThemes.sort((a, b) => b.score - a.score);

  const selected: ThemeEntry[] = [];
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

    if (needsDark || needsLight || selected.length < targetCount - Math.max(0, minDark - darkCount) - Math.max(0, minLight - lightCount)) {
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

  return { selected, darkCount, lightCount, duplicates: duplicates.length };
}

function bundle(): void {
  const { input, output, count } = parseCliArgs();

  if (!existsSync(input)) {
    consola.error(`Input file not found: ${input}`);
    consola.error("Run 'make build' first to generate themes.json");
    process.exit(1);
  }

  consola.info(`Reading ${input}`);

  const raw = readFileSync(input, "utf-8");
  const allThemes: ThemeEntry[] = JSON.parse(raw);

  consola.log(`  Total themes available: ${allThemes.length}`);

  const validThemes = allThemes.filter((t) => t.name && t.repo && t.colorscheme);

  consola.log(`  Valid themes: ${validThemes.length}`);

  const { selected, darkCount, lightCount, duplicates } = selectThemesWithHeuristics(validThemes, count);

  const withVariants = selected.filter((t) => t.variants && t.variants.length > 0).length;
  const builtinCount = selected.filter((t) => t.builtin).length;
  const totalStars = selected.reduce((sum, t) => sum + (t.stars || 0), 0);
  const avgStars = Math.round(totalStars / selected.length);

  consola.log(`  Selected: ${selected.length} themes`);
  consola.log(`  Dark mode: ${darkCount}, Light mode: ${lightCount}`);
  consola.log(`  With variants: ${withVariants}`);
  consola.log(`  Builtin: ${builtinCount}`);
  consola.log(`  Duplicates resolved: ${duplicates}`);
  consola.log(`  Avg stars: ${avgStars.toLocaleString()}`);

  writeFileSync(output, JSON.stringify(selected, null, 2) + "\n", "utf-8");

  consola.success(`Bundled ${selected.length} themes → ${output}`);
}

bundle();
