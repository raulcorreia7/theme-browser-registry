import { runOnce, loadConfig, setLogLevel, type RunStats } from "../runner.js";
import type { CommandResult } from "./types.js";
import { success, failure } from "./types.js";

export interface SyncOptions {
  readonly config: string;
  readonly verbose: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);

  if (options.verbose) {
    setLogLevel("DEBUG");
  }

  const stats: RunStats = await runOnce(config);
  console.log(JSON.stringify(stats, null, 2));

  if (stats.errors > 0) {
    return failure(`Sync completed with ${stats.errors} errors`, 1);
  }

  return success(`Synced ${stats.written} themes`);
}
