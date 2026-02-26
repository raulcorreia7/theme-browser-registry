#!/usr/bin/env tsx
/**
 * validate-registry.ts - Validate themes.json registry completeness
 *
 * Usage: tsx tasks/validate/registry.ts
 *
 * Checks:
 * - Total themes >= 40
 * - Strategy distribution (at least 5 of each: colorscheme, setup, load, file)
 * - Mode coverage (dark/light)
 * - Missing required fields (name, repo, colorscheme)
 * - Variants have mode field
 * - File strategy themes have corresponding .lua files in themes/ directory
 *
 * Exit code 0 if all pass, 1 if incomplete
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThemeEntry, LoadStrategy, ThemeMode } from "@/lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const THEMES_PATH = resolve(ROOT, "artifacts/themes.json");
const LUA_THEMES_DIR = resolve(ROOT, "themes");

interface StrategyCounts {
  colorscheme: number;
  setup: number;
  load: number;
  file: number;
}

interface ModeCounts {
  dark: number;
  light: number;
}

interface IncompleteTheme {
  name: string;
  missing: string;
}

function getStrategy(theme: ThemeEntry): LoadStrategy {
  if (theme.meta?.strategy?.type) return theme.meta.strategy.type;
  if (theme.variants?.[0]?.meta?.strategy?.type) return theme.variants[0].meta.strategy.type;
  return "colorscheme";
}

function getLuaFiles(): Set<string> {
  if (!existsSync(LUA_THEMES_DIR)) return new Set();
  return new Set(
    readdirSync(LUA_THEMES_DIR)
      .filter((f) => f.endsWith(".lua"))
      .map((f) => basename(f, ".lua"))
  );
}

function validate(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const incompleteThemes: IncompleteTheme[] = [];

  if (!existsSync(THEMES_PATH)) {
    console.error(`# Registry Validation Report\n\n**FATAL**: themes.json not found at \`${THEMES_PATH}\`\n`);
    process.exit(1);
  }

  const raw = readFileSync(THEMES_PATH, "utf-8");
  const themes: ThemeEntry[] = JSON.parse(raw);
  const luaFiles = getLuaFiles();

  const totalThemes = themes.length;
  if (totalThemes < 40) {
    errors.push(`Total themes (${totalThemes}) is less than 40`);
  }

  const strategyCounts: StrategyCounts = { colorscheme: 0, setup: 0, load: 0, file: 0 };
  const modeCounts: ModeCounts = { dark: 0, light: 0 };
  let missingModeVariants = 0;

  for (const theme of themes) {
    const strategy = getStrategy(theme);
    if (strategy in strategyCounts) {
      strategyCounts[strategy as keyof StrategyCounts]++;
    }

    const requiredFields: string[] = ["name", "colorscheme"];
    if (!theme.builtin) {
      requiredFields.push("repo");
    }
    const missing = requiredFields.filter((f) => !theme[f as keyof ThemeEntry]);
    if (missing.length > 0) {
      incompleteThemes.push({
        name: theme.name || "UNKNOWN",
        missing: missing.join(", "),
      });
    }

    if (theme.variants && theme.variants.length > 0) {
      for (const v of theme.variants) {
        if (v.mode) {
          modeCounts[v.mode]++;
        } else {
          missingModeVariants++;
        }
      }
    } else if (theme.mode) {
      modeCounts[theme.mode]++;
    }

    if (strategy === "file") {
      const themeName = theme.name;
      if (!luaFiles.has(themeName)) {
        errors.push(`File strategy theme "${themeName}" missing themes/${themeName}.lua`);
      }
    }
  }

  const requiredStrategies: (keyof StrategyCounts)[] = ["colorscheme", "setup", "load"];
  for (const s of requiredStrategies) {
    if (strategyCounts[s] < 5) {
      errors.push(`Strategy "${s}" has only ${strategyCounts[s]} themes (need at least 5)`);
    }
  }

  if (strategyCounts.file === 0) {
    warnings.push("No file strategy themes (optional)");
  }

  if (modeCounts.dark === 0) {
    errors.push("No dark mode themes found");
  }
  if (modeCounts.light === 0) {
    warnings.push("No light mode themes found");
  }

  if (missingModeVariants > 0) {
    warnings.push(`${missingModeVariants} variants missing mode field`);
  }

  console.log("# Registry Validation Report\n");
  console.log("## Summary\n");
  console.log("| Metric | Value | Status |");
  console.log("|--------|-------|--------|");
  console.log(`| Total Themes | ${totalThemes} | ${totalThemes >= 40 ? "PASS" : "FAIL"} |`);
  console.log(`| Dark Mode Variants | ${modeCounts.dark} | ${modeCounts.dark > 0 ? "PASS" : "FAIL"} |`);
  console.log(`| Light Mode Variants | ${modeCounts.light} | ${modeCounts.light > 0 ? "PASS" : "WARN"} |`);
  console.log(`| Lua Loader Files | ${luaFiles.size} | PASS |`);
  console.log(`| Incomplete Themes | ${incompleteThemes.length} | ${incompleteThemes.length === 0 ? "PASS" : "FAIL"} |`);

  console.log("\n## Strategy Distribution\n");
  console.log("| Strategy | Count | Status |");
  console.log("|----------|-------|--------|");
  for (const s of requiredStrategies) {
    const count = strategyCounts[s];
    const status = count >= 5 ? "PASS" : "FAIL";
    console.log(`| ${s} | ${count} | ${status} |`);
  }

  if (incompleteThemes.length > 0) {
    console.log("\n## Incomplete Themes\n");
    console.log("| Theme | Missing Fields |");
    console.log("|-------|---------------|");
    for (const t of incompleteThemes) {
      console.log(`| ${t.name} | ${t.missing} |`);
    }
  }

  if (errors.length > 0 || warnings.length > 0) {
    console.log("\n## Issues\n");
    for (const e of errors) console.log(`- FAIL: ${e}`);
    for (const w of warnings) console.log(`- WARN: ${w}`);
  }

  console.log("\n---\n");

  if (errors.length > 0) {
    console.log(`**Result**: FAILED (${errors.length} errors)\n`);
    process.exit(1);
  } else {
    console.log("**Result**: PASSED\n");
    process.exit(0);
  }
}

validate();
