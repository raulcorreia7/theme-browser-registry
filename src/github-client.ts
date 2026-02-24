import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import type { Logger } from "./logger.js";
import { logger as defaultLogger } from "./logger.js";
import type { GitHubRepoItem, GitHubTreeItem } from "./types.js";

const MyOctokit = Octokit.plugin(retry, throttling);

export class GitHubRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubRequestError";
  }
}

export interface GitHubClientOptions {
  requestDelayMs: number;
  retryLimit: number;
  logger?: Logger;
  token?: string;
}

export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly logger: Logger;
  private readonly requestDelayMs: number;
  private nextRequestTime: number = 0;

  constructor(options: GitHubClientOptions) {
    this.logger = options.logger ?? defaultLogger;
    this.requestDelayMs = options.requestDelayMs;
    const token = options.token ?? process.env.GITHUB_TOKEN?.trim() ?? "";

    this.octokit = new MyOctokit({
      auth: token || undefined,
      retry: {
        retries: options.retryLimit,
        doNotRetry: [404, 401],
      },
      throttle: {
        onRateLimit: (retryAfter, options) => {
          this.logger.warn(`Rate limit hit for ${options.method} ${options.url}`);
          if (options.request.retryCount < options.retryLimit) {
            this.logger.info(`Retrying after ${retryAfter} seconds`);
            return true;
          }
          return false;
        },
        onSecondaryRateLimit: () => {
          this.logger.warn("Secondary rate limit hit");
          return false;
        },
      },
    });
  }

  async searchRepositories(
    topic: string,
    page: number,
    perPage: number
  ): Promise<{ items: GitHubRepoItem[]; hasNext: boolean }> {
    await this.waitForRateLimit();

    try {
      const response = await this.octokit.rest.search.repos({
        q: `topic:${topic} archived:false fork:false`,
        sort: "updated",
        order: "desc",
        per_page: perPage,
        page,
      });

      this.markRequest();

      const items = response.data.items.filter(
        (item): item is GitHubRepoItem =>
          item != null && typeof item.full_name === "string"
      );

      return { items, hasNext: items.length === perPage };
    } catch (error) {
      this.markRequest();
      if (this.isNotFoundError(error)) {
        return { items: [], hasNext: false };
      }
      throw this.wrapError(error);
    }
  }

  async fetchRepository(repo: string): Promise<GitHubRepoItem | null> {
    await this.waitForRateLimit();

    try {
      const [owner, repoName] = repo.split("/");
      const response = await this.octokit.rest.repos.get({
        owner,
        repo: repoName,
      });

      this.markRequest();
      return response.data as GitHubRepoItem;
    } catch (error) {
      this.markRequest();
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw this.wrapError(error);
    }
  }

  async fetchRepositoryTree(repo: string, ref: string): Promise<GitHubTreeItem[]> {
    await this.waitForRateLimit();

    try {
      const [owner, repoName] = repo.split("/");
      const response = await this.octokit.rest.git.getTree({
        owner,
        repo: repoName,
        tree_sha: ref,
        recursive: "true",
      });

      this.markRequest();
      return response.data.tree.filter(
        (item): item is GitHubTreeItem => typeof item.path === "string"
      );
    } catch (error) {
      this.markRequest();
      if (this.isNotFoundError(error)) {
        return [];
      }
      throw this.wrapError(error);
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = performance.now();
    if (now < this.nextRequestTime) {
      await new Promise((resolve) => setTimeout(resolve, this.nextRequestTime - now));
    }
  }

  private markRequest(): void {
    this.nextRequestTime = performance.now() + this.requestDelayMs;
  }

  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === "object" && "status" in error) {
      return (error as { status: number }).status === 404;
    }
    return false;
  }

  private wrapError(error: unknown): GitHubRequestError {
    if (error instanceof Error) {
      return new GitHubRequestError(error.message);
    }
    return new GitHubRequestError(String(error));
  }
}
