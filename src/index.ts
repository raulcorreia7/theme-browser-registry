#!/usr/bin/env node
import { Command } from "commander";
import { runOnce, runLoop, loadConfig, setLogLevel } from "./runner.js";
import { publishArtifacts } from "./publish.js";

const program = new Command();

program
  .name("theme-browser-registry")
  .description("Neovim theme registry indexer")
  .version("0.1.0");

program
  .command("run-once")
  .description("Run the indexer once")
  .option("-c, --config <path>", "Path to config file", "indexer.config.json")
  .option("-v, --verbose", "Enable debug logging", false)
  .action(async (options) => {
    if (options.verbose) {
      setLogLevel("DEBUG");
    }
    const config = loadConfig(options.config);
    const stats = await runOnce(config);
    console.log(JSON.stringify(stats, null, 2));
    process.exit(stats.errors > 0 ? 1 : 0);
  });

program
  .command("run-loop")
  .description("Run the indexer in a continuous loop")
  .option("-c, --config <path>", "Path to config file", "indexer.config.json")
  .option("-v, --verbose", "Enable debug logging", false)
  .action(async (options) => {
    if (options.verbose) {
      setLogLevel("DEBUG");
    }
    const config = loadConfig(options.config);
    await runLoop(config);
  });

program
  .command("run-once-publish")
  .description("Run the indexer once and publish artifacts")
  .option("-c, --config <path>", "Path to config file", "indexer.config.json")
  .option("-v, --verbose", "Enable debug logging", false)
  .action(async (options) => {
    if (options.verbose) {
      setLogLevel("DEBUG");
    }
    const config = loadConfig(options.config);
    const stats = await runOnce(config);
    console.log(JSON.stringify(stats, null, 2));

    if (stats.errors > 0) {
      console.error("Indexer completed with errors, skipping publish");
      process.exit(1);
    }

    if (!config.publish_enabled) {
      console.error("Publishing disabled in config");
      process.exit(0);
    }

    try {
      const result = publishArtifacts(
        [config.output_path, config.manifest_path],
        {
          message: config.publish_commit_message,
          remote: config.publish_remote,
          branch: config.publish_branch,
        },
        process.cwd()
      );

      if (result.published) {
        console.error(`Published: ${result.reason}`);
        process.exit(0);
      } else {
        console.error(`Not published: ${result.reason}`);
        process.exit(0);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Publish failed: ${message}`);
      process.exit(2);
    }
  });

program.parse();
