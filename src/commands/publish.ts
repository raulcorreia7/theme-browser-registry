import { runOnce, loadConfig, setLogLevel, type RunStats } from "../runner.js";
import { publishArtifacts } from "../publish.js";
import type { CommandResult } from "./types.js";
import { success, failure } from "./types.js";

export interface PublishOptions {
  readonly config: string;
  readonly verbose: boolean;
}

export async function publishCommand(options: PublishOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);

  if (options.verbose) {
    setLogLevel("DEBUG");
  }

  const stats: RunStats = await runOnce(config);
  console.log(JSON.stringify(stats, null, 2));

  if (stats.errors > 0) {
    return failure("Sync completed with errors, skipping publish", 1);
  }

  if (!config.publish_enabled) {
    return failure("Publishing disabled in config", 0);
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
      return success(`Published: ${result.reason}`);
    }
    return success(`Not published: ${result.reason}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(`Publish failed: ${message}`, 2);
  }
}
