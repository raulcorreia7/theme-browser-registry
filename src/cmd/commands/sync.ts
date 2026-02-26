import { runOnce } from "@/sync/indexer";
import { loadConfig } from "@/lib/config";
import { setLogLevel, LogLevels, logger } from "@/lib/logger";
import type { RunStats } from "@/lib/types";
import { type CommandResult, success, failure } from "@/cmd/commands/types";

export interface SyncOptions {
  readonly config: string;
  readonly verbose: boolean;
  readonly force?: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);

  if (options.verbose) {
    setLogLevel(LogLevels.debug);
  }

  const stats: RunStats = await runOnce(config, options.force ?? false);
  console.log(JSON.stringify(stats, null, 2));

  if (stats.written === 0) {
    return failure("No themes written", 1);
  }

  if (stats.errors > 0) {
    logger.info(`${stats.errors} repos skipped due to errors`);
  }

  return success(`Synced ${stats.written} themes`);
}
