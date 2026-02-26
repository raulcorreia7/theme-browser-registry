import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import type { Logger } from "../utils/logger.js";
import { logger as defaultLogger } from "../utils/logger.js";
import type { GitHubRepoItem, GitHubTreeItem } from "../types/schemas.js";

const MyOctokit = Octokit.plugin(retry, throttling);

/**
 * Error thrown when a GitHub API request fails.
 */
export class GitHubRequestError extends Error {
  /**
   * Creates a new GitHubRequestError.
   * @param message - The error message
   */
  constructor(message: string) {
    super(message);
    this.name = "GitHubRequestError";
  }
}

/**
 * Configuration options for the GitHubClient.
 */
export interface GitHubClientOptions {
  /** Delay between requests in milliseconds */
  requestDelayMs: number;
  /** Maximum number of retries for failed requests */
  retryLimit: number;
  /** Optional logger instance */
  logger?: Logger;
  /** Optional GitHub token for authentication */
  token?: string;
}

/**
 * Client for interacting with the GitHub API with rate limiting and retry support.
 */
export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly logger: Logger;
  private readonly requestDelayMs: number;
  private nextRequestTime: number = 0;

  /**
   * Creates a new GitHubClient instance.
   * @param options - Configuration options for the client
   */
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
        onRateLimit: (retryAfter, throttleOptions) => {
          this.logger.warn(`Rate limit hit for ${throttleOptions.method} ${throttleOptions.url}`);
          if (throttleOptions.request.retryCount < options.retryLimit) {
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

  /**
   * Searches for repositories by topic.
   * @param topic - The topic to search for
   * @param page - The page number to fetch
   * @param perPage - Number of results per page
   * @returns Object containing repository items and whether there are more pages
   * @throws {GitHubRequestError} When the API request fails (except 404 errors)
   */
  async searchRepositories(
    topic: string,
    page: number,
    perPage: number,
    minStars: number = 10
  ): Promise<{ items: GitHubRepoItem[]; hasNext: boolean }> {
    await this.waitForRateLimit();

    try {
      const query = `topic:${topic} archived:false fork:false stars:>=${minStars}`;
      this.logger.debug(`search query: ${query}`);
      const response = await this.octokit.rest.search.repos({
        q: query,
        sort: "updated",
        order: "desc",
        per_page: perPage,
        page,
      });

      this.markRequest();

      const items: GitHubRepoItem[] = [];
      for (const item of response.data.items) {
        if (item != null && typeof item.full_name === "string") {
          items.push({
            id: item.id ?? 0,
            full_name: item.full_name,
            description: item.description ?? null,
            stargazers_count: item.stargazers_count ?? 0,
            topics: Array.isArray(item.topics) ? item.topics.filter((t): t is string => typeof t === "string") : [],
            updated_at: item.updated_at ?? "",
            archived: item.archived ?? false,
            disabled: item.disabled ?? false,
            html_url: item.html_url ?? "",
            default_branch: item.default_branch,
          });
        }
      }

      return { items, hasNext: items.length === perPage };
    } catch (error) {
      this.markRequest();
      if (this.isNotFoundError(error)) {
        return { items: [], hasNext: false };
      }
      throw this.wrapError(error);
    }
  }

  /**
   * Fetches metadata for a specific repository.
   * @param repo - Repository name in "owner/repo" format
   * @returns Repository metadata or null if not found
   * @throws {GitHubRequestError} When the API request fails (except 404 errors)
   */
  async fetchRepository(repo: string): Promise<GitHubRepoItem | null> {
    await this.waitForRateLimit();

    try {
      const [owner, repoName] = repo.split("/");
      if (!owner || !repoName) {
        return null;
      }
      
      const response = await this.octokit.rest.repos.get({
        owner,
        repo: repoName,
      });

      this.markRequest();
      
      const data = response.data;
      return {
        id: data.id ?? 0,
        full_name: data.full_name ?? "",
        description: data.description ?? null,
        stargazers_count: data.stargazers_count ?? 0,
        topics: Array.isArray(data.topics) ? data.topics.filter((t): t is string => typeof t === "string") : [],
        updated_at: data.updated_at ?? "",
        archived: data.archived ?? false,
        disabled: data.disabled ?? false,
        html_url: data.html_url ?? "",
        default_branch: data.default_branch,
      };
    } catch (error) {
      this.markRequest();
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw this.wrapError(error);
    }
  }

  /**
   * Fetches the git tree for a repository at a specific ref.
   * @param repo - Repository name in "owner/repo" format
   * @param ref - Git ref (branch, tag, or commit SHA)
   * @returns Array of tree items representing files in the repository
   * @throws {GitHubRequestError} When the API request fails (except 404 errors)
   */
  async fetchRepositoryTree(repo: string, ref: string): Promise<GitHubTreeItem[]> {
    await this.waitForRateLimit();

    try {
      const [owner, repoName] = repo.split("/");
      if (!owner || !repoName) {
        return [];
      }
      
      const response = await this.octokit.rest.git.getTree({
        owner,
        repo: repoName,
        tree_sha: ref,
        recursive: "true",
      });

      this.markRequest();
      
      const items: GitHubTreeItem[] = [];
      for (const item of response.data.tree) {
        if (typeof item.path === "string") {
          const itemType = item.type === "blob" || item.type === "tree" || item.type === "commit" 
            ? item.type 
            : "blob";
          items.push({
            path: item.path,
            mode: item.mode ?? "100644",
            type: itemType,
            sha: item.sha ?? "",
            size: item.size ?? undefined,
            url: item.url ?? "",
          });
        }
      }
      
      return items;
    } catch (error) {
      this.markRequest();
      if (this.isNotFoundError(error)) {
        return [];
      }
      throw this.wrapError(error);
    }
  }

  /**
   * Fetches the README content for a repository.
   * @param repo - Repository name in "owner/repo" format
   * @returns README content as string, or null if not found
   * @throws {GitHubRequestError} When the API request fails (except 404 errors)
   */
  async fetchReadme(repo: string): Promise<string | null> {
    await this.waitForRateLimit();

    try {
      const [owner, repoName] = repo.split("/");
      if (!owner || !repoName) {
        return null;
      }

      const response = await this.octokit.rest.repos.getReadme({
        owner,
        repo: repoName,
      });

      this.markRequest();

      // Content is base64 encoded
      const content = response.data.content;
      if (content) {
        return Buffer.from(content, "base64").toString("utf-8");
      }
      return null;
    } catch (error) {
      this.markRequest();
      if (this.isNotFoundError(error)) {
        return null;
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
