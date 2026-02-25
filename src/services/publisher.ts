import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../utils/logger.js";

export interface PublishResult {
  published: boolean;
  reason: string;
}

function runGit(args: string[], cwd: string): string {
  try {
    const result = execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`git ${args[0]} failed: ${error.message}`);
    }
    throw error;
  }
}

function hasChanges(paths: string[], cwd: string): boolean {
  const args = ["status", "--porcelain", "--", ...paths];
  const output = runGit(args, cwd);
  return output.trim().length > 0;
}

function getRepoRoot(cwd: string): string {
  return runGit(["rev-parse", "--show-toplevel"], cwd);
}

function getCurrentBranch(cwd: string): string {
  return runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

function hasRemoteBranch(remote: string, branch: string, cwd: string): boolean {
  try {
    runGit(["rev-parse", `refs/remotes/${remote}/${branch}`], cwd);
    return true;
  } catch {
    return false;
  }
}

function ensureGitConfigured(cwd: string): void {
  try {
    runGit(["config", "user.name"], cwd);
  } catch {
    runGit(["config", "user.name", "registry-bot"], cwd);
  }

  try {
    runGit(["config", "user.email"], cwd);
  } catch {
    runGit(["config", "user.email", "bot@theme-browser.local"], cwd);
  }
}

export function publishArtifacts(
  artifactPaths: string[],
  options: {
    message: string;
    remote: string;
    branch: string;
  },
  cwd: string
): PublishResult {
  const { message, remote, branch } = options;

  const repoRoot = getRepoRoot(cwd);
  const normalizedPaths = artifactPaths.map((p) => resolve(cwd, p));

  for (const path of normalizedPaths) {
    if (!existsSync(path)) {
      return { published: false, reason: `artifact not found: ${path}` };
    }
  }

  if (!hasChanges(normalizedPaths, repoRoot)) {
    logger.info("No artifact changes to publish");
    return { published: false, reason: "no_changes" };
  }

  ensureGitConfigured(repoRoot);

  const currentBranch = getCurrentBranch(repoRoot);
  if (currentBranch !== branch) {
    logger.info(`Switching to branch ${branch}`);
    runGit(["checkout", branch], repoRoot);
  }

  const args = ["add", "--", ...normalizedPaths];
  runGit(args, repoRoot);
  logger.debug("Staged artifact files");

  runGit(["commit", "-m", message], repoRoot);
  logger.info(`Committed: ${message}`);

  if (!hasRemoteBranch(remote, branch, repoRoot)) {
    logger.warn(`Remote branch ${remote}/${branch} not found, skipping push`);
    return { published: true, reason: "committed_no_remote" };
  }

  runGit(["push", remote, branch], repoRoot);
  logger.info(`Pushed to ${remote}/${branch}`);

  return { published: true, reason: "pushed" };
}
