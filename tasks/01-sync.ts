#!/usr/bin/env tsx
/**
 * 01-sync.ts - Sync themes from GitHub to index.json
 *
 * Usage: tsx tasks/01-sync.ts [options]
 *
 * Options:
 *   -c, --config <path>   Config file (required)
 *   -v, --verbose         Enable verbose logging
 *   -f, --force           Force refresh all repos
 *   -h, --help            Show help
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { run as runSync } from "@/sync";
import { loadConfig } from "@/lib/config";
import { SyncCliOptionsSchema, type SyncCliOptions } from "@/lib/cli";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const program = new Command()
  .name("01-sync")
  .description("Sync themes from GitHub to index.json")
  .requiredOption("-c, --config <path>", "Path to configuration file")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("-f, --force", "Force refresh all repos", false)
  .option("-h, --help", "Show help")
  .parse(process.argv);

const rawOpts = program.opts();
if (rawOpts.help) {
  program.help();
  process.exit(0);
}

const cliOptions = SyncCliOptionsSchema.parse({
  ...rawOpts,
  config: resolve(ROOT, rawOpts.config),
});

async function main() {
  const cfg = await loadConfig(cliOptions.config);
  
  const result = await runSync({
    config: cfg,
    force: cliOptions.force,
  });

  consola.success(`Synced ${result.written} themes`);
  consola.log(`  Discovered: ${result.discovered}`);
  consola.log(`  Fetched: ${result.fetched}`);
  consola.log(`  Cached: ${result.cached}`);
  consola.log(`  Errors: ${result.errors}`);

  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  consola.error(err.message);
  process.exit(1);
});
