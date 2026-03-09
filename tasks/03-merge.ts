#!/usr/bin/env tsx
/**
 * 03-merge.ts - Merge source files into config/overrides.json
 *
 * Usage: tsx tasks/03-merge.ts [options]
 *
 * Options:
 *   -s, --sources <dir>   Sources directory (default: config/sources)
 *   -o, --output <path>   Output file (default: config/overrides.json)
 *   -h, --help            Show help
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { MergeCliOptionsSchema, normalizeCliArgv, type MergeCliOptions } from "@/lib/cli";
import { run as runMerge } from "@/merge";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const program = new Command()
  .name("03-merge")
  .description("Merge source files into config/overrides.json")
  .option("-s, --sources <dir>", "Sources directory", "config/sources")
  .option("-o, --output <path>", "Output file", "config/overrides.json")
  .option("-h, --help", "Show help")
  .parse(normalizeCliArgv(process.argv));

const rawOpts = program.opts();
if (rawOpts.help) {
  program.help();
  process.exit(0);
}

const cliOptions: MergeCliOptions = MergeCliOptionsSchema.parse(rawOpts);

const result = runMerge({
  sourcesDir: resolve(ROOT, cliOptions.sources),
  outputPath: resolve(ROOT, cliOptions.output),
});

consola.success(`Merged ${result.themes} themes + ${result.builtin} builtin → ${result.outputPath}`);
