import { Command } from "commander";
import { syncCommand } from "./commands/sync.js";
import { watchCommand } from "./commands/watch.js";
import { publishCommand } from "./commands/publish.js";
import { exportCommand } from "./commands/export.js";

export function createCLI(): Command {
  const program = new Command();

  program
    .name("theme-registry")
    .description("Theme registry CLI for syncing, watching, and publishing themes")
    .version("1.0.0");

  program
    .command("sync")
    .description("Sync themes once")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .option("-v, --verbose", "Enable verbose logging", false)
    .action(async (options) => {
      const result = await syncCommand({
        config: options.config,
        verbose: options.verbose,
      });
      process.exit(result.exitCode);
    });

  program
    .command("watch")
    .description("Watch for theme changes continuously")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .option("-v, --verbose", "Enable verbose logging", false)
    .action(async (options) => {
      const result = await watchCommand({
        config: options.config,
        verbose: options.verbose,
      });
      process.exit(result.exitCode);
    });

  program
    .command("publish")
    .description("Sync and publish themes")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .option("-v, --verbose", "Enable verbose logging", false)
    .action(async (options) => {
      const result = await publishCommand({
        config: options.config,
        verbose: options.verbose,
      });
      process.exit(result.exitCode);
    });

  program
    .command("export")
    .description("Export theme data to JSON file")
    .requiredOption("-c, --config <path>", "Path to configuration file")
    .requiredOption("-o, --output <path>", "Output file path")
    .action(async (options) => {
      const result = await exportCommand({
        config: options.config,
        output: options.output,
      });
      process.exit(result.exitCode);
    });

  return program;
}
