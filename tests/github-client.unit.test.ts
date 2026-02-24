import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubClient, GitHubRequestError } from "../src/github-client.js";

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_REQUEST_DELAY_MS = 0;
const DEFAULT_RETRY_LIMIT = 2;
const TEST_TOKEN = "test-token";
const ENV_TOKEN = "env-token";

function buildSearchUrl(topic: string, perPage: number, page: number): string {
  const params = new URLSearchParams({
    q: `topic:${topic} archived:false fork:false`,
    sort: "updated",
    order: "desc",
    per_page: String(perPage),
    page: String(page),
  });
  return `${GITHUB_API_BASE}/search/repositories?${params.toString()}`;
}

function buildRepoUrl(repo: string): string {
  return `${GITHUB_API_BASE}/repos/${repo}`;
}

function buildTreeUrl(repo: string, ref: string): string {
  return `${GITHUB_API_BASE}/repos/${repo}/git/trees/${ref}?recursive=1`;
}

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json?: unknown;
  headers?: Record<string, string>;
}

function createMockFetch(responses: Map<string, MockFetchResponse>) {
  return vi.fn(async (url: string) => {
    const response = responses.get(url);
    if (!response) {
      return {
        ok: false,
        status: 404,
        text: async () => "",
        headers: new Headers(),
      };
    }
    return {
      ok: response.ok,
      status: response.status,
      text: async () => (response.json ? JSON.stringify(response.json) : ""),
      headers: new Headers(response.headers || {}),
    };
  });
}

describe("github-client", () => {
  let client: GitHubClient;
  let mockFetch: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    mockFetch = createMockFetch(new Map());
    global.fetch = mockFetch;
    client = new GitHubClient({
      requestDelayMs: DEFAULT_REQUEST_DELAY_MS,
      retryLimit: DEFAULT_RETRY_LIMIT,
      token: TEST_TOKEN,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses provided token", () => {
      const c = new GitHubClient({ requestDelayMs: 100, retryLimit: 3, token: "my-token" });
      expect(c).toBeDefined();
    });

    it("falls back to GITHUB_TOKEN env var", () => {
      process.env.GITHUB_TOKEN = ENV_TOKEN;
      const c = new GitHubClient({ requestDelayMs: 100, retryLimit: 3 });
      expect(c).toBeDefined();
      delete process.env.GITHUB_TOKEN;
    });

    it("uses empty string when no token provided", () => {
      delete process.env.GITHUB_TOKEN;
      const c = new GitHubClient({ requestDelayMs: 100, retryLimit: 3 });
      expect(c).toBeDefined();
    });
  });

  describe("searchRepositories", () => {
    const TOPIC_NEOVIM = "neovim";
    const PAGE_ONE = 1;
    const PER_PAGE_TWO = 2;
    const PER_PAGE_TEN = 10;
    const PER_PAGE_HUNDRED = 100;

    it("returns items and hasNext flag", async () => {
      mockFetch = createMockFetch(new Map([
        [buildSearchUrl(TOPIC_NEOVIM, PER_PAGE_TWO, PAGE_ONE), {
          ok: true,
          status: 200,
          json: {
            items: [
              { id: 1, full_name: "owner/repo1", stargazers_count: 100 },
              { id: 2, full_name: "owner/repo2", stargazers_count: 50 },
            ],
          },
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.searchRepositories(TOPIC_NEOVIM, PAGE_ONE, PER_PAGE_TWO);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].full_name).toBe("owner/repo1");
      expect(result.hasNext).toBe(true);
    });

    it("sets hasNext false when items < perPage", async () => {
      mockFetch = createMockFetch(new Map([
        [buildSearchUrl(TOPIC_NEOVIM, PER_PAGE_TEN, PAGE_ONE), {
          ok: true,
          status: 200,
          json: {
            items: [{ id: 1, full_name: "owner/repo1" }],
          },
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.searchRepositories(TOPIC_NEOVIM, PAGE_ONE, PER_PAGE_TEN);
      expect(result.hasNext).toBe(false);
    });

    it("returns empty array for null/invalid response", async () => {
      mockFetch = createMockFetch(new Map([
        [buildSearchUrl(TOPIC_NEOVIM, PER_PAGE_HUNDRED, PAGE_ONE), {
          ok: true,
          status: 200,
          json: null,
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.searchRepositories(TOPIC_NEOVIM, PAGE_ONE, PER_PAGE_HUNDRED);
      expect(result.items).toEqual([]);
      expect(result.hasNext).toBe(false);
    });

    it("filters invalid items from response", async () => {
      mockFetch = createMockFetch(new Map([
        [buildSearchUrl(TOPIC_NEOVIM, PER_PAGE_HUNDRED, PAGE_ONE), {
          ok: true,
          status: 200,
          json: {
            items: [
              { id: 1, full_name: "valid/repo" },
              null,
              { id: 2 },
              { full_name: "also/valid" },
            ],
          },
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.searchRepositories(TOPIC_NEOVIM, PAGE_ONE, PER_PAGE_HUNDRED);
      expect(result.items).toHaveLength(2);
    });
  });

  describe("fetchRepository", () => {
    const REPO_TOKYONIGHT = "folke/tokyonight.nvim";
    const REPO_NONEXISTENT = "nonexistent/repo";
    const REPO_OWNER = "owner/repo";

    it("returns repository data", async () => {
      mockFetch = createMockFetch(new Map([
        [buildRepoUrl(REPO_TOKYONIGHT), {
          ok: true,
          status: 200,
          json: {
            id: 1,
            full_name: REPO_TOKYONIGHT,
            stargazers_count: 5000,
            description: "A nice theme",
          },
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.fetchRepository(REPO_TOKYONIGHT);
      expect(result).not.toBeNull();
      expect(result?.full_name).toBe(REPO_TOKYONIGHT);
    });

    it("returns null for 404", async () => {
      mockFetch = createMockFetch(new Map([
        [buildRepoUrl(REPO_NONEXISTENT), {
          ok: false,
          status: 404,
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.fetchRepository(REPO_NONEXISTENT);
      expect(result).toBeNull();
    });

    it("returns null for invalid response", async () => {
      mockFetch = createMockFetch(new Map([
        [buildRepoUrl(REPO_OWNER), {
          ok: true,
          status: 200,
          json: { id: 1 },
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.fetchRepository(REPO_OWNER);
      expect(result).toBeNull();
    });
  });

  describe("fetchRepositoryTree", () => {
    const REPO_OWNER = "owner/repo";
    const REF_MAIN = "main";

    it("returns tree items", async () => {
      mockFetch = createMockFetch(new Map([
        [buildTreeUrl(REPO_OWNER, REF_MAIN), {
          ok: true,
          status: 200,
          json: {
            tree: [
              { path: "colors/theme.vim", mode: "100644", type: "blob", sha: "abc" },
              { path: "lua/theme/init.lua", mode: "100644", type: "blob", sha: "def" },
            ],
          },
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.fetchRepositoryTree(REPO_OWNER, REF_MAIN);
      expect(result).toHaveLength(2);
      expect(result[0].path).toBe("colors/theme.vim");
    });

    it("returns empty array for null response", async () => {
      mockFetch = createMockFetch(new Map([
        [buildTreeUrl(REPO_OWNER, REF_MAIN), {
          ok: true,
          status: 200,
          json: null,
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.fetchRepositoryTree(REPO_OWNER, REF_MAIN);
      expect(result).toEqual([]);
    });

    it("filters invalid tree items", async () => {
      mockFetch = createMockFetch(new Map([
        [buildTreeUrl(REPO_OWNER, REF_MAIN), {
          ok: true,
          status: 200,
          json: {
            tree: [
              { path: "valid.vim", mode: "100644", type: "blob", sha: "abc" },
              null,
              { mode: "100644", type: "blob" },
            ],
          },
        }],
      ]));
      global.fetch = mockFetch;

      const result = await client.fetchRepositoryTree(REPO_OWNER, REF_MAIN);
      expect(result).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    const REPO_OWNER = "owner/repo";

    it("throws GitHubRequestError for 401", async () => {
      mockFetch = createMockFetch(new Map([
        [buildRepoUrl(REPO_OWNER), {
          ok: false,
          status: 401,
        }],
      ]));
      global.fetch = mockFetch;

      await expect(client.fetchRepository(REPO_OWNER)).rejects.toThrow(GitHubRequestError);
      await expect(client.fetchRepository(REPO_OWNER)).rejects.toThrow("authorization failed");
    });

    it("throws after max retries on persistent failure", async () => {
      const failClient = new GitHubClient({
        requestDelayMs: 0,
        retryLimit: 1,
        token: TEST_TOKEN,
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "",
        headers: new Headers(),
      });

      await expect(failClient.fetchRepository(REPO_OWNER)).rejects.toThrow();
    });
  });
});
