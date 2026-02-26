#!/usr/bin/env tsx
/**
 * 05-bundle.ts - Copy top themes to plugin for offline use
 *
 * Usage: tsx tasks/05-bundle.ts [options]
 *
 * Options:
 *   -i, --input <path>    Input themes.json (default: artifacts/themes.json)
 *   -o, --output <path>   Output registry.json (default: ../plugin/lua/theme-browser/data/registry.json)
 *   -n, --count <n>       Number of themes to include (default: 50)
 *   -h, --help            Show help
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { BundleCliOptionsSchema, type BundleCliOptions } from "@/lib/cli";
import { run as runBundle } from "@/build/bundle";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const program = new Command()
  .name("05-bundle")
  .description("Copy top themes to plugin for offline use")
  .option("-i, --input <path>", "Input themes.json", "artifacts/themes.json")
  .option("-o, --output <path>", "Output registry.json", "../plugin/lua/theme-browser/data/registry.json")
  .option("-n, --count <n>", "Number of themes to include", "50")
  .option("-h, --help", "Show help")
  .parse(process.argv);

const rawOpts = program.opts();
if (rawOpts.help) {
  program.help();
  process.exit(0);
}

const cliOptions: BundleCliOptions = BundleCliOptionsSchema.parse({
  ...rawOpts,
  count: parseInt(rawOpts.count, 10),
});

consola.info(`Reading ${resolve(ROOT, cliOptions.input)}`);

const result = runBundle({
  input: resolve(ROOT, cliOptions.input),
  output: resolve(ROOT, cliOptions.output),
  count: cliOptions.count,
});

consola.success(`Bundled ${result.selected} themes → ${result.outputPath}`);
consola.log(`  Dark mode: ${result.darkCount}, Light mode: ${result.lightCount}`);
