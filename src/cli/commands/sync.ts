import { runOnce, loadConfig, setLogLevel, type RunStats } from "../../services/indexer.js";
import type { CommandResult } from "./types.js";
import { success, failure } from "./types.js";

export interface SyncOptions {
  readonly config: string;
  readonly verbose: boolean;
  readonly force?: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);

  if (options.verbose) {
    setLogLevel("DEBUG");
  }

  const stats: RunStats = await runOnce(config, options.force ?? false);
  console.log(JSON.stringify(stats, null, 2));

  if (stats.written === 0) {
    return failure("No themes written", 1);
  }

  if (stats.errors > 0) {
    console.log(`Note: ${stats.errors} repos skipped due to errors`);
  }

  return success(`Synced ${stats.written} themes`);
}
