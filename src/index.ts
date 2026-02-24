#!/usr/bin/env node
import { Command } from "commander";
import { writeFileSync } from "fs";
import { runOnce, runLoop, loadConfig, setLogLevel } from "./runner.js";
import { publishArtifacts } from "./publish.js";
import { StateStore } from "./state.js";

const program = new Command();

program
  .name("theme-browser-registry")
  .description("Neovim theme registry indexer")
  .version("0.1.0");

program
  .command("index")
  .description("Index themes from GitHub (run once)")
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
  .command("watch")
  .description("Continuously index themes at configured interval")
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
  .command("publish")
  .description("Index themes and publish artifacts to git")
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

program
  .command("export")
  .description("Export database to JSON for backup or inspection")
  .option("-c, --config <path>", "Path to config file", "indexer.config.json")
  .option("-o, --output <path>", "Output file path", "artifacts/db-export.json")
  .action((options) => {
    const config = loadConfig(options.config);
    const store = new StateStore(config.state_db_path);

    try {
      const rows = store.raw
        .prepare("SELECT repo, updated_at, scanned_at, payload_json, parse_error FROM repo_cache ORDER BY repo")
        .all() as Array<{
          repo: string;
          updated_at: string;
          scanned_at: number;
          payload_json: string;
          parse_error: string | null;
        }>;

      const exportData = {
        exported_at: new Date().toISOString(),
        count: rows.length,
        entries: rows.map((row) => {
          let payload = null;
          try {
            payload = JSON.parse(row.payload_json);
          } catch {
            payload = null;
          }
          return {
            repo: row.repo,
            updated_at: row.updated_at,
            scanned_at: row.scanned_at,
            payload,
            parse_error: row.parse_error,
          };
        }),
      };

      writeFileSync(options.output, JSON.stringify(exportData, null, 2) + "\n", "utf-8");
      console.log(`Exported ${rows.length} entries to ${options.output}`);
    } finally {
      store.close();
    }
  });

program.parse();
