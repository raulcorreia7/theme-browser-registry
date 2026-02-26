#!/usr/bin/env tsx
/**
 * validate-registry.ts - Validate themes.json registry completeness
 *
 * Usage: tsx tasks/validate/registry.ts [options]
 *
 * Options:
 *   -i, --input <path>     Themes.json path (default: artifacts/themes.json)
 *   -d, --themes-dir <dir> Lua themes directory (default: themes)
 *   -h, --help             Show help
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { ValidateCliOptionsSchema, type ValidateCliOptions } from "@/lib/cli";
import { run as runValidate } from "@/validate";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const program = new Command()
  .name("validate-registry")
  .description("Validate themes.json registry completeness")
  .option("-i, --input <path>", "Themes.json path", "artifacts/themes.json")
  .option("-d, --themes-dir <dir>", "Lua themes directory", "themes")
  .option("-h, --help", "Show help")
  .parse(process.argv);

const rawOpts = program.opts();
if (rawOpts.help) {
  program.help();
  process.exit(0);
}

const cliOptions: ValidateCliOptions = ValidateCliOptionsSchema.parse(rawOpts);

const result = runValidate({
  input: resolve(ROOT, cliOptions.themesPath),
  themesDir: resolve(ROOT, cliOptions.themesDir),
});

consola.log("# Registry Validation Report\n");
consola.log("## Summary\n");
consola.log("| Metric | Value | Status |");
consola.log("|--------|-------|--------|");
consola.log(`| Total Themes | ${result.metrics.totalThemes} | ${result.metrics.totalThemes >= 40 ? "PASS" : "FAIL"} |`);
consola.log(`| Dark Mode Variants | ${result.metrics.darkModeVariants} | ${result.metrics.darkModeVariants > 0 ? "PASS" : "FAIL"} |`);
consola.log(`| Light Mode Variants | ${result.metrics.lightModeVariants} | ${result.metrics.lightModeVariants > 0 ? "PASS" : "WARN"} |`);
consola.log(`| Lua Loader Files | ${result.metrics.luaFiles} | PASS |`);
consola.log(`| Incomplete Themes | ${result.metrics.incompleteThemes} | ${result.metrics.incompleteThemes === 0 ? "PASS" : "FAIL"} |`);

consola.log("\n## Strategy Distribution\n");
consola.log("| Strategy | Count |");
consola.log("|----------|-------|");
for (const [strategy, count] of Object.entries(result.metrics.strategyCounts)) {
  consola.log(`| ${strategy} | ${count} |`);
}

if (result.errors.length > 0 || result.warnings.length > 0) {
  consola.log("\n## Issues\n");
  for (const e of result.errors) consola.fail(e);
  for (const w of result.warnings) consola.warn(w);
}

consola.log("\n---\n");

if (result.passed) {
  consola.success("Validation PASSED");
  process.exit(0);
} else {
  consola.fail(`Validation FAILED (${result.errors.length} errors)`);
  process.exit(1);
}
