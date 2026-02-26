import { runLoop } from "@/sync/indexer";
import { loadConfig } from "@/lib/config";
import { setLogLevel, LogLevels } from "@/lib/logger";
import type { CommandResult } from "@/cmd/commands/types";
import { success } from "@/cmd/commands/types";

export interface WatchOptions {
  readonly config: string;
  readonly verbose: boolean;
}

export async function watchCommand(options: WatchOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);

  if (options.verbose) {
    setLogLevel(LogLevels.debug);
  }

  await runLoop(config);
  return success();
}
