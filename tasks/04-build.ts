#!/usr/bin/env tsx
/**
 * 04-build.ts - Generate optimized themes.json for plugin
 *
 * Usage: tsx tasks/04-build.ts [options]
 *
 * Options:
 *   -c, --config <path>     Config file (default: config/registry.json)
 *   -i, --index <path>      Index file (default: artifacts/index.json)
 *   -o, --overrides <path>  Overrides file (default: config/overrides.json)
 *   -O, --output <path>     Output file (default: artifacts/themes.json)
 *   --minify                Output minified JSON
 *   -h, --help              Show help
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { BuildCliOptionsSchema, normalizeCliArgv, type BuildCliOptions } from "@/lib/cli";
import { run as runBuild } from "@/build";
import { loadConfig } from "@/lib/config";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const program = new Command()
  .name("04-build")
  .description("Generate optimized themes.json for plugin")
  .option("-c, --config <path>", "Config file", "config/registry.json")
  .option("-i, --index <path>", "Index file", "artifacts/index.json")
  .option("-o, --overrides <path>", "Overrides file", "config/overrides.json")
  .option("-O, --output <path>", "Output file", "artifacts/themes.json")
  .option("--minify", "Output minified JSON", false)
  .option("-h, --help", "Show help")
  .parse(normalizeCliArgv(process.argv));

const rawOpts = program.opts();
if (rawOpts.help) {
  program.help();
  process.exit(0);
}

const cliOptions: BuildCliOptions = BuildCliOptionsSchema.parse(rawOpts);

consola.info(`Reading ${resolve(ROOT, cliOptions.index)}`);
const configPath = resolve(ROOT, cliOptions.config);
const configData = loadConfig(configPath);

const result = runBuild({
  index: resolve(ROOT, cliOptions.index),
  overrides: resolve(ROOT, cliOptions.overrides),
  output: resolve(ROOT, cliOptions.output),
  minify: cliOptions.minify,
  preferredRepos: configData.discovery.includeRepos,
});

consola.success(`Generated ${result.themes} themes (${result.variants} variants) → ${result.outputPath}`);
consola.log(`  Size: ${(result.size / 1024).toFixed(1)} KB`);
