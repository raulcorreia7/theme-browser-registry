import type { Logger } from "pino";
import { pino } from "pino";
import type { GitHubRepoItem, GitHubTreeItem } from "./types.js";

const BASE_URL = "https://api.github.com";
const USER_AGENT = "theme-browser-registry-indexer/2.0";
const API_VERSION = "2022-11-28";
const REQUEST_TIMEOUT_MS = 30000;
const MAX_BACKOFF_SECONDS = 60;

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

interface SearchResponse {
  items: GitHubRepoItem[];
}

interface TreeResponse {
  tree: GitHubTreeItem[];
}

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly requestDelayMs: number;
  private readonly retryLimit: number;
  private readonly logger: Logger;
  private nextRequestTime: number = 0;

  constructor(options: GitHubClientOptions) {
    this.baseUrl = BASE_URL;
    this.token = options.token ?? process.env.GITHUB_TOKEN?.trim() ?? "";
    this.requestDelayMs = options.requestDelayMs;
    this.retryLimit = options.retryLimit;
    this.logger = options.logger ?? pino({ level: "info" });
  }

  async searchRepositories(
    topic: string,
    page: number,
    perPage: number
  ): Promise<{ items: GitHubRepoItem[]; hasNext: boolean }> {
    const params = new URLSearchParams({
      q: `topic:${topic} archived:false fork:false`,
      sort: "updated",
      order: "desc",
      per_page: String(perPage),
      page: String(page),
    });

    const payload = await this.requestJson<SearchResponse>(
      `/search/repositories?${params.toString()}`
    );

    if (!payload || !Array.isArray(payload.items)) {
      return { items: [], hasNext: false };
    }

    const items = payload.items.filter(
      (item): item is GitHubRepoItem =>
        item != null && typeof item === "object" && typeof item.full_name === "string"
    );

    return { items, hasNext: items.length === perPage };
  }

  async fetchRepository(repo: string): Promise<GitHubRepoItem | null> {
    const payload = await this.requestJson<GitHubRepoItem>(`/repos/${repo}`);
    if (payload && typeof payload === "object" && "full_name" in payload) {
      return payload;
    }
    return null;
  }

  async fetchRepositoryTree(repo: string, ref: string): Promise<GitHubTreeItem[]> {
    const payload = await this.requestJson<TreeResponse>(
      `/repos/${repo}/git/trees/${ref}?recursive=1`
    );

    if (!payload || !Array.isArray(payload.tree)) {
      return [];
    }

    return payload.tree.filter(
      (item): item is GitHubTreeItem =>
        item != null && typeof item === "object" && typeof item.path === "string"
    );
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForRateLimit(): Promise<void> {
    const now = performance.now();
    if (now < this.nextRequestTime) {
      await this.sleep(this.nextRequestTime - now);
    }
  }

  private markRequest(): void {
    this.nextRequestTime = performance.now() + this.requestDelayMs;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": API_VERSION,
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private parseHeaderInt(value: string | null): number | null {
    if (value == null) return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private resolveRetrySleep(response: Response, headers: Headers): number | null {
    const retryAfter = this.parseHeaderInt(headers.get("Retry-After"));
    if (retryAfter != null && retryAfter > 0) {
      return retryAfter;
    }

    const remaining = headers.get("X-RateLimit-Remaining");
    const resetAt = this.parseHeaderInt(headers.get("X-RateLimit-Reset"));
    if (remaining === "0" && resetAt != null) {
      return Math.max(1, resetAt - Math.floor(Date.now() / 1000) + 1);
    }

    return null;
  }

  private async requestJson<T>(path: string): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= this.retryLimit; attempt++) {
      await this.waitForRateLimit();

      this.logger.debug({ attempt, url }, "github request");

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        this.markRequest();

        if (response.status === 404) {
          this.logger.debug({ url }, "github not found");
          return null;
        }

        if (response.status === 401) {
          throw new GitHubRequestError("github authorization failed; check GITHUB_TOKEN");
        }

        if (response.ok) {
          const text = await response.text();
          if (!text) return null;
          return JSON.parse(text) as T;
        }

        const retrySleep = this.resolveRetrySleep(response, response.headers);
        if (retrySleep != null && attempt < this.retryLimit) {
          this.logger.warn(
            { status: response.status, sleep: retrySleep, url },
            "github throttled"
          );
          await this.sleep(retrySleep * 1000);
          continue;
        }

        lastError = `HTTP ${response.status} for ${url}`;
      } catch (error) {
        this.markRequest();

        if (error instanceof GitHubRequestError) {
          throw error;
        }

        if (error instanceof SyntaxError) {
          lastError = `JSON parse error for ${url}: ${error.message}`;
        } else if (error instanceof Error) {
          lastError = error.message;
          this.logger.warn({ url, error: lastError }, "github request failed");
        } else {
          lastError = String(error);
        }
      }

      if (attempt < this.retryLimit) {
        const backoff = Math.min(MAX_BACKOFF_SECONDS, Math.pow(2, attempt - 1));
        this.logger.debug(
          { backoff, attempt, maxAttempts: this.retryLimit, url },
          "github retrying after backoff"
        );
        await this.sleep(backoff * 1000);
      }
    }

    throw new GitHubRequestError(lastError ?? `request failed: ${url}`);
  }
}
