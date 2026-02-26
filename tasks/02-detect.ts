#!/usr/bin/env tsx
/**
 * 02-detect.ts - Detect theme loading strategies
 *
 * Usage: tsx tasks/02-detect.ts [options]
 *
 * Options:
 *   -i, --index <path>       Index file (default: artifacts/index.json)
 *   -s, --sources <dir>      Sources directory (default: sources)
 *   -o, --output <dir>       Output directory (default: reports)
 *   -n, --sample <n>         Process first N repos only
 *   -r, --repo <owner/repo>  Process single repo
 *   -t, --theme <name>       Process by theme name
 *   -a, --apply              Apply changes to sources
 *   --no-cache               Disable cache
 *   -v, --verbose            Show detailed output
 *   -h, --help               Show help
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { DetectCliOptionsSchema, type DetectCliOptions } from "@/lib/cli";
import { run as runDetection, applyDetectionPatch, saveSources, type DetectOptions } from "@/detect";
import type { ThemeEntry } from "@/lib/types";
import { GitHubClient } from "@/sync/github";
import { RepoCache } from "@/db/sqlite";
import { readJson, writeJson, ensureDir } from "@/lib/io";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const program = new Command()
  .name("02-detect")
  .description("Detect theme loading strategies")
  .option("-i, --index <path>", "Index file", "artifacts/index.json")
  .option("-s, --sources <dir>", "Sources directory", "sources")
  .option("-o, --output <dir>", "Output directory", "reports")
  .option("-n, --sample <n>", "Process first N repos")
  .option("-r, --repo <owner/repo>", "Process single repo")
  .option("-t, --theme <name>", "Process by theme name")
  .option("-a, --apply", "Apply changes to sources", false)
  .option("--no-cache", "Disable cache", false)
  .option("-v, --verbose", "Show detailed output", false)
  .option("-h, --help", "Show help")
  .parse(process.argv);

const rawOpts = program.opts();
if (rawOpts.help) {
  program.help();
  process.exit(0);
}

const cliOptions: DetectCliOptions = DetectCliOptionsSchema.parse({
  verbose: rawOpts.verbose ?? false,
  help: rawOpts.help ?? false,
  index: rawOpts.index,
  sources: rawOpts.sources,
  output: rawOpts.output,
  dbCache: rawOpts.dbCache,
  apply: rawOpts.apply ?? false,
  sample: rawOpts.sample ? parseInt(rawOpts.sample, 10) : undefined,
  repo: rawOpts.repo,
  theme: rawOpts.theme,
  noCache: rawOpts.noCache ?? false,
});

async function main() {
  const options: DetectOptions = {
    sourcesDir: resolve(ROOT, cliOptions.sources),
    outputDir: resolve(ROOT, cliOptions.output),
    indexFile: resolve(ROOT, cliOptions.index),
    cacheDir: resolve(ROOT, ".cache/theme-verifier"),
    apply: cliOptions.apply,
    noCache: cliOptions.noCache,
  };

  if (cliOptions.sample !== undefined) options.sample = cliOptions.sample;
  if (cliOptions.repo !== undefined) options.repo = cliOptions.repo;
  if (cliOptions.theme !== undefined) options.theme = cliOptions.theme;

  ensureDir(options.cacheDir);
  ensureDir(options.outputDir);

  consola.info("Loading theme data...");

  const github = new GitHubClient({
    requestDelayMs: 250,
    retryLimit: 3,
  });

  const cache = cliOptions.noCache ? null : new RepoCache(resolve(ROOT, cliOptions.dbCache));

  const { rows, patch, variantReport } = await runDetection(options, { github, cache });

  writeJson(resolve(options.outputDir, "detection.json"), rows);
  writeJson(resolve(options.outputDir, "variant-coverage.json"), variantReport);

  const matches = rows.filter((r) => r.status === "match").length;
  const mismatches = rows.filter((r) => r.status === "mismatch").length;
  const missingMeta = rows.filter((r) => r.status === "missing-meta").length;
  const errors = rows.filter((r) => r.status === "error").length;

  consola.success("Detection complete");
  consola.log(`  Matches: ${matches}`);
  consola.log(`  Mismatches: ${mismatches}`);
  consola.log(`  Missing meta: ${missingMeta}`);
  consola.log(`  Errors: ${errors}`);
  consola.log(`  To apply: ${patch.length} repos`);

  if (cliOptions.apply && patch.length > 0) {
    consola.info(`Applying ${patch.length} strategy updates...`);

    const themes = readJson<ThemeEntry[]>(options.indexFile);
    const overridesPath = resolve(options.sourcesDir, "overrides.json");

    type SourcesFile = { overrides: ThemeEntry[]; builtin?: ThemeEntry[] };
    let sources: SourcesFile;
    try {
      sources = readJson<SourcesFile>(overridesPath);
    } catch {
      sources = { overrides: [] };
    }

    const updated = applyDetectionPatch(sources, patch, themes);
    saveSources(options.sourcesDir, updated);

    consola.success(`Updated ${options.sourcesDir}`);
  } else if (patch.length > 0) {
    consola.info("Run with --apply to update sources");
  }

  consola.log(`  Report: ${options.outputDir}/detection.json`);
  consola.log(`  Variant report: ${options.outputDir}/variant-coverage.json`);
}

main().catch((err) => {
  consola.error(err.message);
  process.exit(1);
});
