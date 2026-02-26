import { runOnce } from "@/sync/indexer";
import { loadConfig } from "@/lib/config";
import { setLogLevel, LogLevels } from "@/lib/logger";
import type { RunStats } from "@/lib/types";
import { publishArtifacts } from "@/push/git";
import type { CommandResult } from "@/cmd/commands/types";
import { success, failure } from "@/cmd/commands/types";

export interface PublishOptions {
  readonly config: string;
  readonly verbose: boolean;
}

export async function publishCommand(options: PublishOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);

  if (options.verbose) {
    setLogLevel(LogLevels.debug);
  }

  const stats: RunStats = await runOnce(config);
  console.log(JSON.stringify(stats, null, 2));

  if (stats.errors > 0) {
    return failure("Sync completed with errors, skipping publish", 1);
  }

  if (!config.publish.enabled) {
    return failure("Publishing disabled in config", 0);
  }

  try {
    const result = publishArtifacts(
      [config.output.index, config.output.manifest],
      {
        message: config.publish.git.message,
        remote: config.publish.git.remote,
        branch: config.publish.git.branch,
      },
      process.cwd(),
    );

    if (result.published) {
      return success(`Published: ${result.reason}`);
    }
    return success(`Not published: ${result.reason}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(`Publish failed: ${message}`, 2);
  }
}
