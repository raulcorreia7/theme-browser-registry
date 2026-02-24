#!/usr/bin/env node
import { config } from "dotenv";
config();

import { Command } from "commander";
import { syncCommand, watchCommand, publishCommand, exportCommand } from "./commands/index.js";

const program = new Command();

program
  .name("theme-browser-registry")
  .description("Neovim theme registry indexer")
  .version("0.1.0");

program
  .command("sync")
  .description("Sync themes from GitHub")
  .option("-c, --config <path>", "Config file path", "indexer.config.json")
  .option("-v, --verbose", "Enable debug logging", false)
  .action(async (options) => {
    const result = await syncCommand(options);
    if (result.message) {
      console.error(result.message);
    }
    process.exit(result.exitCode);
  });

program
  .command("watch")
  .description("Sync themes continuously")
  .option("-c, --config <path>", "Config file path", "indexer.config.json")
  .option("-v, --verbose", "Enable debug logging", false)
  .action(async (options) => {
    await watchCommand(options);
  });

program
  .command("publish")
  .description("Sync and publish to git")
  .option("-c, --config <path>", "Config file path", "indexer.config.json")
  .option("-v, --verbose", "Enable debug logging", false)
  .action(async (options) => {
    const result = await publishCommand(options);
    if (result.message) {
      console.error(result.message);
    }
    process.exit(result.exitCode);
  });

program
  .command("export")
  .description("Export database to JSON")
  .option("-c, --config <path>", "Config file path", "indexer.config.json")
  .option("-o, --output <path>", "Output file path", "artifacts/db-export.json")
  .action(async (options) => {
    const result = await exportCommand(options);
    if (result.message) {
      console.log(result.message);
    }
    process.exit(result.exitCode);
  });

program.parse();
