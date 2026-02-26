#!/usr/bin/env tsx
/**
 * 04-build.ts - Generate optimized themes.json for plugin
 *
 * Usage: tsx tasks/04-build.ts [options]
 *
 * Options:
 *   -i, --index <path>      Index file (default: artifacts/index.json)
 *   -o, --overrides <path>  Overrides file (default: overrides.json)
 *   -O, --output <path>     Output file (default: artifacts/themes.json)
 *   --minify                Output minified JSON
 *   -h, --help              Show help
 */
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import consola from "consola";
import type { ThemeEntry, ThemeMode, ThemeStrategy } from "@/lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CONFIG = {
  THEME_NAME_MIN_LENGTH: 2,
  THEME_NAME_MAX_LENGTH: 64,
  JSON_INDENT: 2,
} as const;

const LIGHT_SUBSTRINGS = ["-light", "-day", "-latte", "-dawn", "-morning", "light-", "day-", "dawn-", "_light", "_day", "-snow", "-operandi", "-lumi"] as const;
const DARK_SUBSTRINGS = ["-dark", "-night", "-moon", "-storm", "-mocha", "-dragon", "-wave", "dark-", "night-", "_dark", "_night", "-dusk", "-vivendi", "-ember", "-fog", "-moss"] as const;

const RE_VALID_NAME = /^[a-zA-Z0-9_-]+$/;
const DOT_CHAR_CODE = 46;

interface OutputVariant {
  name: string;
  colorscheme?: string;
  mode?: ThemeMode;
  strategy?: string;
  module?: string;
}

interface OutputTheme {
  name: string;
  colorscheme?: string;
  repo?: string;
  stars?: number;
  mode?: ThemeMode;
  builtin?: boolean;
  strategy?: string;
  module?: string;
  variants?: OutputVariant[];
}

interface CliArgs {
  index: string;
  overrides: string;
  output: string;
  minify: boolean;
}

interface DuplicateInfo {
  name: string;
  kept?: string;
  replaced?: string;
  with?: string;
  reason: string;
}

function containsAny(text: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (text.includes(pattern)) return true;
  }
  return false;
}

function isValidThemeName(name: string | undefined): boolean {
  if (!name || typeof name !== "string") return false;
  if (name.length < CONFIG.THEME_NAME_MIN_LENGTH || name.length > CONFIG.THEME_NAME_MAX_LENGTH) return false;
  if (name.charCodeAt(0) === DOT_CHAR_CODE) return false;
  return RE_VALID_NAME.test(name);
}

function inferModeFromColorscheme(colorscheme: string | undefined): ThemeMode | null {
  if (!colorscheme || typeof colorscheme !== "string") return null;
  const name = colorscheme.toLowerCase();
  if (containsAny(name, LIGHT_SUBSTRINGS)) return "light";
  if (containsAny(name, DARK_SUBSTRINGS)) return "dark";
  return null;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      index: { type: "string", short: "i", default: "artifacts/index.json" },
      overrides: { type: "string", short: "o", default: "overrides.json" },
      output: { type: "string", short: "O", default: "artifacts/themes.json" },
      minify: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
04-build - Generate optimized themes.json

Usage:
  04-build [options]

Options:
  -i, --index <path>      Index file (default: artifacts/index.json)
  -o, --overrides <path>  Overrides file (default: overrides.json)
  -O, --output <path>     Output file (default: artifacts/themes.json)
  --minify                Output minified JSON
  -h, --help              Show help
`);
    process.exit(0);
  }

  return {
    index: resolve(ROOT, values.index),
    overrides: resolve(ROOT, values.overrides),
    output: resolve(ROOT, values.output),
    minify: values.minify,
  };
}

interface BuiltinLoadResult {
  builtin: ThemeEntry[];
  variantHints: Map<string, Record<string, ThemeMode>>;
}

function loadBuiltinThemes(overridesPath: string): BuiltinLoadResult {
  if (!existsSync(overridesPath)) {
    return { builtin: [], variantHints: new Map() };
  }

  const raw = readFileSync(overridesPath, "utf-8");
  const data = JSON.parse(raw) as { builtin?: ThemeEntry[] };

  const variantHints = new Map<string, Record<string, ThemeMode>>();
  const hintsPath = resolve(dirname(overridesPath), "sources/hints.json");

  if (existsSync(hintsPath)) {
    try {
      const hintsRaw = readFileSync(hintsPath, "utf-8");
      const hintsData = JSON.parse(hintsRaw) as {
        hints?: Array<{ repo?: string; variantModes?: Record<string, ThemeMode> }>;
      };
      if (Array.isArray(hintsData.hints)) {
        for (const hint of hintsData.hints) {
          if (hint.repo && hint.variantModes) {
            variantHints.set(hint.repo, hint.variantModes);
          }
        }
      }
    } catch (err) {
      consola.warn(`Could not load variant hints: ${(err as Error).message}`);
    }
  }

  const builtin = Array.isArray(data.builtin)
    ? data.builtin.filter((t) => t && t.name && t.builtin === true)
    : [];

  return { builtin, variantHints };
}

interface OverridesMaps {
  byRepo: Map<string, ThemeEntry>;
  byName: Map<string, ThemeEntry>;
}

function loadOverrides(overridesPath: string): OverridesMaps {
  if (!existsSync(overridesPath)) {
    return { byRepo: new Map(), byName: new Map() };
  }

  const raw = readFileSync(overridesPath, "utf-8");
  const data = JSON.parse(raw) as { overrides?: ThemeEntry[] };

  if (!Array.isArray(data.overrides)) {
    return { byRepo: new Map(), byName: new Map() };
  }

  const byRepo = new Map(data.overrides.map((o) => [o.repo, o]));
  const byName = new Map(data.overrides.map((o) => [o.name, o]));

  return { byRepo, byName };
}

function isNeovimTheme(repo: string | undefined): boolean {
  return Boolean(repo && (repo.includes(".nvim") || repo.includes("neovim")));
}

function buildOptimizedEntry(
  theme: ThemeEntry,
  override: ThemeEntry | undefined,
  variantHints: Map<string, Record<string, ThemeMode>>
): OutputTheme {
  const entry: OutputTheme = {
    name: theme.name,
    colorscheme: theme.colorscheme,
  };

  if (theme.repo) entry.repo = theme.repo;
  if (theme.stars) entry.stars = theme.stars;
  if (theme.mode) entry.mode = theme.mode;
  if (theme.builtin) entry.builtin = true;

  const strategy: ThemeStrategy | undefined = override?.meta?.strategy ?? theme.meta?.strategy;
  if (strategy?.type) {
    entry.strategy = strategy.type;
    if (strategy.module) entry.module = strategy.module;
  }

  if (theme.variants && theme.variants.length > 0) {
    const hintsForRepo = theme.repo ? variantHints.get(theme.repo) : null;

    entry.variants = theme.variants.map((v): OutputVariant => {
      const variant: OutputVariant = {
        name: v.name,
        colorscheme: v.colorscheme,
      };

      if (hintsForRepo && hintsForRepo[v.name]) {
        variant.mode = hintsForRepo[v.name];
      } else if (v.mode) {
        variant.mode = v.mode;
      } else {
        const inferred = inferModeFromColorscheme(v.colorscheme ?? v.name);
        if (inferred) variant.mode = inferred;
      }

      if (v.meta?.strategy?.type) {
        variant.strategy = v.meta.strategy.type;
        if (v.meta.strategy.module) variant.module = v.meta.strategy.module;
      }

      return variant;
    });
  }

  return entry;
}

function generate(): void {
  const { index, overrides, output, minify } = parseCliArgs();

  consola.info(`Reading ${index}`);

  const raw = readFileSync(index, "utf-8");
  const themes: ThemeEntry[] = JSON.parse(raw);

  const { byRepo: overridesMap, byName: overridesByName } = loadOverrides(overrides);
  const { builtin: builtinThemes, variantHints } = loadBuiltinThemes(overrides);

  const themesByName = new Map<string, ThemeEntry>();
  const duplicates: DuplicateInfo[] = [];
  let skippedInvalid = 0;

  for (const theme of themes) {
    if (!theme.name) continue;

    const nameLower = theme.name.toLowerCase();

    if (!isValidThemeName(theme.name)) {
      skippedInvalid++;
      continue;
    }

    const existing = themesByName.get(nameLower);
    if (existing) {
      const existingIsNeovim = isNeovimTheme(existing.repo);
      const newIsNeovim = isNeovimTheme(theme.repo);
      const existingStars = existing.stars ?? 0;
      const newStars = theme.stars ?? 0;
      const existingVariants = existing.variants?.length ?? 0;
      const newVariants = theme.variants?.length ?? 0;

      let newIsBetter = false;
      let reason = "";

      if (newIsNeovim && !existingIsNeovim) {
        newIsBetter = true;
        reason = "Neovim theme preferred";
      } else if (!newIsNeovim && existingIsNeovim) {
        newIsBetter = false;
        reason = "Neovim theme preferred";
      } else if (newStars > existingStars) {
        newIsBetter = true;
        reason = `${newStars} > ${existingStars} stars`;
      } else if (newStars < existingStars) {
        newIsBetter = false;
        reason = `${existingStars} > ${newStars} stars`;
      } else if (newVariants > existingVariants) {
        newIsBetter = true;
        reason = `${newVariants} > ${existingVariants} variants`;
      } else {
        newIsBetter = false;
        reason = `${existingVariants} > ${newVariants} variants`;
      }

      if (newIsBetter) {
        duplicates.push({ name: theme.name, replaced: existing.repo, with: theme.repo, reason });
        themesByName.set(nameLower, theme);
      } else {
        duplicates.push({ name: theme.name, kept: existing.repo, reason });
      }
    } else {
      themesByName.set(nameLower, theme);
    }
  }

  const curated: OutputTheme[] = [];

  for (const theme of themesByName.values()) {
    const override = theme.repo ? overridesMap.get(theme.repo) : overridesByName.get(theme.name);
    const entry = buildOptimizedEntry(theme, override, variantHints);
    curated.push(entry);
  }

  for (const builtin of builtinThemes) {
    const nameLower = builtin.name.toLowerCase();
    if (themesByName.has(nameLower)) continue;

    const entry: OutputTheme = {
      name: builtin.name,
      colorscheme: builtin.colorscheme,
      builtin: true,
    };

    if (builtin.stars !== undefined) entry.stars = builtin.stars;
    if (builtin.mode) entry.mode = builtin.mode;
    if (builtin.meta?.strategy?.type) {
      entry.strategy = builtin.meta.strategy.type;
      if (builtin.meta.strategy.module) entry.module = builtin.meta.strategy.module;
    }

    curated.push(entry);
  }

  consola.log(`  ${builtinThemes.length} builtin themes`);
  if (skippedInvalid > 0) consola.log(`  ${skippedInvalid} skipped (invalid names)`);
  if (duplicates.length > 0) {
    consola.log(`  ${duplicates.length} duplicates resolved`);
    for (const dup of duplicates.slice(0, 5)) {
      if (dup.kept) {
        consola.log(`    ${dup.name}: kept ${dup.kept} (${dup.reason})`);
      } else {
        consola.log(`    ${dup.name}: replaced ${dup.replaced} with ${dup.with} (${dup.reason})`);
      }
    }
    if (duplicates.length > 5) {
      consola.log(`    ... and ${duplicates.length - 5} more`);
    }
  }

  mkdirSync(dirname(output), { recursive: true });

  const jsonOutput = minify
    ? JSON.stringify(curated)
    : JSON.stringify(curated, null, CONFIG.JSON_INDENT) + "\n";

  writeFileSync(output, jsonOutput, "utf-8");

  const stats = {
    themes: curated.length,
    variants: curated.reduce((sum, t) => sum + (t.variants?.length ?? 0), 0),
    size: jsonOutput.length,
  };

  consola.success(`Generated ${stats.themes} themes (${stats.variants} variants) → ${output}`);
  consola.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generate();
