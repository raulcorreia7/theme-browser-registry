#!/usr/bin/env tsx
/**
 * 06-manifest.ts - Generate manifest.json for themes artifact
 *
 * Usage: tsx tasks/06-manifest.ts [options]
 *
 * Options:
 *   -i, --input <path>   Themes file (default: artifacts/themes.json)
 *   -o, --output <path>  Manifest file (default: artifacts/manifest.json)
 *   -h, --help           Show help
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import consola from "consola";
import { normalizeCliArgv } from "@/lib/cli";
import { ensureDir } from "@/lib/io";
import { REGISTRY_VERSION } from "@/lib/version";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const program = new Command()
  .name("06-manifest")
  .description("Generate manifest.json for themes artifact")
  .option("-i, --input <path>", "Themes file", "artifacts/themes.json")
  .option("-o, --output <path>", "Manifest file", "artifacts/manifest.json")
  .option("-h, --help", "Show help")
  .parse(normalizeCliArgv(process.argv));

const opts = program.opts();
if (opts.help) {
  program.help();
  process.exit(0);
}

const inputPath = resolve(ROOT, String(opts.input));
const outputPath = resolve(ROOT, String(opts.output));
const rawThemes = readFileSync(inputPath);
const themes = JSON.parse(rawThemes.toString("utf-8")) as unknown[];
const checksum = createHash("sha256").update(rawThemes).digest("hex");

const manifest = {
  version: REGISTRY_VERSION,
  count: themes.length,
  generated_at: new Date().toISOString(),
  sha256: checksum,
};

ensureDir(dirname(outputPath));
writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

consola.success(`Generated manifest: ${outputPath}`);
consola.log(`  Version: ${manifest.version}`);
consola.log(`  Count: ${manifest.count}`);
