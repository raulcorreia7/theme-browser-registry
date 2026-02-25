import { runLoop, loadConfig, setLogLevel } from "../../services/indexer.js";
import type { CommandResult } from "./types.js";
import { success } from "./types.js";

export interface WatchOptions {
  readonly config: string;
  readonly verbose: boolean;
}

export async function watchCommand(options: WatchOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);

  if (options.verbose) {
    setLogLevel("DEBUG");
  }

  await runLoop(config);
  return success();
}
