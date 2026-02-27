#!/usr/bin/env tsx
/**
 * 07-top-themes.ts - Generate top N themes artifact
 *
 * Usage: tsx tasks/07-top-themes.ts [options]
 *
 * Options:
 *   -i, --input <path>   Themes file (default: artifacts/themes.json)
 *   -o, --output <path>  Output file (default: artifacts/themes-top-50.json)
 *   -c, --count <n>      Number of themes to include (default: 50)
 *   -h, --help           Show help
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { ensureDir } from "@/lib/io";

type ThemeMode = "dark" | "light";

type ThemeVariant = {
  mode?: ThemeMode;
};

type ThemeRow = {
  name: string;
  stars?: number;
  mode?: ThemeMode;
  variants?: ThemeVariant[];
};

function getModes(theme: ThemeRow): Set<ThemeMode> {
  const modes = new Set<ThemeMode>();

  if (theme.mode === "dark" || theme.mode === "light") {
    modes.add(theme.mode);
  }

  if (Array.isArray(theme.variants)) {
    for (const variant of theme.variants) {
      if (variant.mode === "dark" || variant.mode === "light") {
        modes.add(variant.mode);
      }
    }
  }

  return modes;
}

function scoreTheme(theme: ThemeRow): number {
  let score = theme.stars ?? 0;
  const modes = getModes(theme);

  if (modes.has("dark") && modes.has("light")) {
    score *= 1.5;
  } else if (modes.has("dark")) {
    score *= 1.2;
  }

  if (Array.isArray(theme.variants) && theme.variants.length > 0) {
    score *= 1.1;
  }

  return score;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const program = new Command()
  .name("07-top-themes")
  .description("Generate top N themes artifact")
  .option("-i, --input <path>", "Themes file", "artifacts/themes.json")
  .option("-o, --output <path>", "Output file", "artifacts/themes-top-50.json")
  .option("-c, --count <n>", "Number of themes", "50")
  .option("-h, --help", "Show help")
  .parse(process.argv);

const opts = program.opts();
if (opts.help) {
  program.help();
  process.exit(0);
}

const count = Number.parseInt(String(opts.count), 10);
if (!Number.isInteger(count) || count <= 0) {
  throw new Error("--count must be a positive integer");
}

const inputPath = resolve(ROOT, String(opts.input));
const outputPath = resolve(ROOT, String(opts.output));

const themes = JSON.parse(readFileSync(inputPath, "utf-8")) as ThemeRow[];

const ranked = themes
  .filter((theme) => typeof theme.stars === "number")
  .map((theme) => ({ theme, score: scoreTheme(theme) }))
  .sort((a, b) => b.score - a.score || (b.theme.stars ?? 0) - (a.theme.stars ?? 0))
  .slice(0, count)
  .map((row) => row.theme);

ranked.sort((a, b) => a.name.localeCompare(b.name));

ensureDir(dirname(outputPath));
writeFileSync(outputPath, JSON.stringify(ranked, null, 2) + "\n", "utf-8");

consola.success(`Generated top themes file: ${outputPath}`);
consola.log(`  Count: ${ranked.length}`);
