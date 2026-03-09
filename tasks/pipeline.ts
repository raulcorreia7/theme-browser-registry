#!/usr/bin/env tsx
/**
 * pipeline.ts - Full registry pipeline runner with local testing overrides
 *
 * Runs:
 *   sync -> detect -> merge -> build -> top50 -> bundle -> manifest -> validate
 */
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import consola from "consola";
import { loadConfig } from "@/lib/config";
import { PipelineCliOptionsSchema, normalizeCliArgv, type PipelineCliOptions } from "@/lib/cli";
import type { ThemeEntry, ThemeMode } from "@/lib/types";
import { REGISTRY_VERSION } from "@/lib/version";
import { run as runSync } from "@/sync";
import { run as runDetection, applyDetectionPatch, saveSources, type DetectOptions } from "@/detect";
import { run as runMerge } from "@/merge";
import { run as runBuild } from "@/build";
import { run as runBundle } from "@/build/bundle";
import { run as runValidate } from "@/validate";
import { ensureDir, readJson, writeJson } from "@/lib/io";
import { GitHubClient } from "@/sync/github";
import { RepoCache } from "@/db/sqlite";

type ThemeVariant = { mode?: ThemeMode };
type ThemeRow = { name: string; stars?: number; mode?: ThemeMode; variants?: ThemeVariant[] };
type SourcesFile = { overrides: ThemeEntry[]; builtin?: ThemeEntry[] };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

loadEnv({ path: resolve(ROOT, ".env") });

const program = new Command()
  .name("pipeline")
  .description("Run full registry pipeline with optional local testing outputs")
  .option("-c, --config <path>", "Config file", "config/registry.json")
  .option("-i, --index <path>", "Index output", "artifacts/index.json")
  .option("-O, --themes <path>", "Themes output", "artifacts/themes.json")
  .option("-s, --sources <dir>", "Sources directory", "config/sources")
  .option("-r, --reports <dir>", "Reports directory", "reports")
  .option("-o, --overrides <path>", "Overrides output", "config/overrides.json")
  .option("-t, --top50 <path>", "Top themes output", "artifacts/themes-top-50.json")
  .option("-m, --manifest <path>", "Manifest output", "artifacts/manifest.json")
  .option(
    "-l, --local-registry <path>",
    "Bundled registry output (use local path for testing)",
    "../plugin/lua/theme-browser/data/registry.json",
  )
  .option("-n, --count <n>", "Top themes + bundle count", "50")
  .option("-f, --force", "Force sync refresh", false)
  .option("--no-cache", "Disable detect cache", false)
  .option("--no-detect-apply", "Do not apply detect patch to source files")
  .option("--testing", "Testing mode (isolated local outputs)", false)
  .option("-h, --help", "Show help")
  .parse(normalizeCliArgv(process.argv));

const rawOpts = program.opts();
if (rawOpts.help) {
  program.help();
  process.exit(0);
}

const cliOptions: PipelineCliOptions = PipelineCliOptionsSchema.parse({
  ...rawOpts,
  count: Number.parseInt(String(rawOpts.count), 10),
  localRegistry: rawOpts.localRegistry,
});

function resolvePath(pathLike: string): string {
  return resolve(ROOT, pathLike);
}

function getThemeModes(theme: ThemeRow): Set<ThemeMode> {
  const modes = new Set<ThemeMode>();

  if (theme.mode) {
    modes.add(theme.mode);
  }

  if (Array.isArray(theme.variants)) {
    for (const variant of theme.variants) {
      if (variant.mode) {
        modes.add(variant.mode);
      }
    }
  }

  return modes;
}

function scoreTheme(theme: ThemeRow): number {
  let score = theme.stars ?? 0;
  const modes = getThemeModes(theme);

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

function writeTopThemes(inputPath: string, outputPath: string, count: number): number {
  const themes = JSON.parse(readFileSync(inputPath, "utf-8")) as ThemeRow[];

  const ranked = themes
    .filter((theme) => typeof theme.stars === "number")
    .map((theme) => ({ theme, score: scoreTheme(theme) }))
    .sort((a, b) => b.score - a.score || (b.theme.stars ?? 0) - (a.theme.stars ?? 0))
    .slice(0, count)
    .map((row) => row.theme)
    .sort((a, b) => a.name.localeCompare(b.name));

  ensureDir(dirname(outputPath));
  writeFileSync(outputPath, JSON.stringify(ranked, null, 2) + "\n", "utf-8");
  return ranked.length;
}

function writeManifest(themesPath: string, manifestPath: string): { version: string; count: number } {
  const rawThemes = readFileSync(themesPath);
  const themes = JSON.parse(rawThemes.toString("utf-8")) as unknown[];
  const checksum = createHash("sha256").update(rawThemes).digest("hex");

  const manifest = {
    version: REGISTRY_VERSION,
    count: themes.length,
    generated_at: new Date().toISOString(),
    sha256: checksum,
  };

  ensureDir(dirname(manifestPath));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  return { version: manifest.version, count: manifest.count };
}

function loadSourcesForPatch(sourcesDir: string): SourcesFile {
  const overridesPath = resolve(sourcesDir, "../overrides.json");
  if (existsSync(overridesPath)) {
    return readJson<SourcesFile>(overridesPath);
  }

  const byStrategy = ["setup.json", "load.json", "colorscheme.json", "builtin.json"];
  const overrides: ThemeEntry[] = [];
  const builtin: ThemeEntry[] = [];

  for (const file of byStrategy) {
    const filePath = resolve(sourcesDir, file);
    if (!existsSync(filePath)) {
      continue;
    }

    const data = readJson<{ themes?: ThemeEntry[] }>(filePath);
    if (!Array.isArray(data.themes)) {
      continue;
    }

    if (file === "builtin.json") {
      builtin.push(...data.themes);
    } else {
      overrides.push(...data.themes);
    }
  }

  return { overrides, builtin };
}

async function main() {
  const outputs = {
    config: resolvePath(cliOptions.config),
    index: resolvePath(cliOptions.index),
    themes: resolvePath(cliOptions.themes),
    sources: resolvePath(cliOptions.sources),
    reports: resolvePath(cliOptions.reports),
    overrides: resolvePath(cliOptions.overrides),
    top50: resolvePath(cliOptions.top50),
    manifest: resolvePath(cliOptions.manifest),
    localRegistry: resolvePath(cliOptions.localRegistry),
  };

  if (cliOptions.testing) {
    outputs.index = resolvePath("artifacts/testing/index.json");
    outputs.themes = resolvePath("artifacts/testing/themes.json");
    outputs.top50 = resolvePath("artifacts/testing/themes-top-50.json");
    outputs.manifest = resolvePath("artifacts/testing/manifest.json");
    outputs.overrides = resolvePath("artifacts/testing/overrides.json");
    outputs.reports = resolvePath("reports/testing");
    outputs.localRegistry = resolvePath("artifacts/testing/registry.json");
  }

  const detectApply = cliOptions.testing ? false : cliOptions.detectApply;
  if (cliOptions.testing && cliOptions.detectApply) {
    consola.warn("testing mode enabled: detect patch apply disabled to avoid mutating source files");
  }

  const cfg = loadConfig(outputs.config);
  cfg.output.index = outputs.index;
  cfg.output.themes = outputs.themes;
  cfg.output.manifest = outputs.manifest;
  cfg.overrides = outputs.overrides;
  if (cliOptions.testing) {
    cfg.output.cache = resolvePath(".state/indexer.testing.db");
  }

  consola.info("Step 1/8: sync");
  const syncResult = await runSync({
    config: cfg,
    force: cliOptions.force,
  });
  consola.success(
    `Synced ${syncResult.written} themes (fetched=${syncResult.fetched}, cached=${syncResult.cached}, errors=${syncResult.errors})`,
  );

  consola.info("Step 2/8: detect");
  ensureDir(outputs.reports);
  const detectOptions: DetectOptions = {
    sourcesDir: outputs.sources,
    outputDir: outputs.reports,
    indexFile: outputs.index,
    cacheDir: resolvePath(".cache/theme-verifier"),
    apply: detectApply,
    noCache: cliOptions.noCache,
  };
  const github = new GitHubClient({
    requestDelayMs: cfg.github.rateLimit.delayMs,
    retryLimit: cfg.github.rateLimit.retryLimit,
  });
  const cache = cliOptions.noCache ? null : new RepoCache(resolvePath(".cache/registry.db"));
  const { rows, patch, variantReport } = await runDetection(detectOptions, { github, cache });
  writeJson(resolve(outputs.reports, "detection.json"), rows);
  writeJson(resolve(outputs.reports, "variant-coverage.json"), variantReport);
  consola.success(`Detect rows=${rows.length}, patch=${patch.length}`);

  if (detectApply && patch.length > 0) {
    const themes = readJson<ThemeEntry[]>(outputs.index);
    const sources = loadSourcesForPatch(outputs.sources);
    const updated = applyDetectionPatch(sources, patch, themes);
    saveSources(outputs.sources, updated);
    consola.success(`Applied detect patch to ${outputs.sources}`);
  }

  consola.info("Step 3/8: merge");
  const mergeResult = runMerge({
    sourcesDir: outputs.sources,
    outputPath: outputs.overrides,
  });
  consola.success(`Merged ${mergeResult.themes} themes + ${mergeResult.builtin} builtin`);

  consola.info("Step 4/8: build");
  const buildResult = runBuild({
    index: outputs.index,
    overrides: outputs.overrides,
    output: outputs.themes,
    preferredRepos: cfg.discovery.includeRepos,
  });
  consola.success(
    `Built themes=${buildResult.themes}, variants=${buildResult.variants}, size=${(buildResult.size / 1024).toFixed(1)}KB`,
  );

  consola.info("Step 5/8: top50");
  const topCount = writeTopThemes(outputs.themes, outputs.top50, cliOptions.count);
  consola.success(`Top themes generated: ${topCount}`);

  consola.info("Step 6/8: bundle");
  const bundleResult = runBundle({
    input: outputs.themes,
    output: outputs.localRegistry,
    count: cliOptions.count,
  });
  consola.success(
    `Bundled selected=${bundleResult.selected} dark=${bundleResult.darkCount} light=${bundleResult.lightCount}`,
  );

  consola.info("Step 7/8: manifest");
  const manifest = writeManifest(outputs.themes, outputs.manifest);
  consola.success(`Manifest version=${manifest.version} count=${manifest.count}`);

  consola.info("Step 8/8: validate");
  const validate = runValidate({ input: outputs.themes });
  if (!validate.passed) {
    for (const error of validate.errors) {
      consola.error(error);
    }
    throw new Error(`Validation failed with ${validate.errors.length} error(s)`);
  }
  consola.success("Validation passed");

  consola.success("Pipeline complete");
  consola.log(`  index: ${outputs.index}`);
  consola.log(`  themes: ${outputs.themes}`);
  consola.log(`  top50: ${outputs.top50}`);
  consola.log(`  local registry: ${outputs.localRegistry}`);
  consola.log(`  manifest: ${outputs.manifest}`);
}

main().catch((err) => {
  consola.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
