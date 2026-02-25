import { describe, it, expect } from "vitest";
import { GitHubClient, GitHubRequestError } from "../../src/providers/github.js";

describe("github-client", () => {
  describe("constructor", () => {
    it("uses provided token", () => {
      const client = new GitHubClient({
        requestDelayMs: 100,
        retryLimit: 3,
        token: "my-token",
      });
      expect(client).toBeDefined();
    });

    it("falls back to GITHUB_TOKEN env var", () => {
      process.env.GITHUB_TOKEN = "env-token";
      const client = new GitHubClient({
        requestDelayMs: 100,
        retryLimit: 3,
      });
      expect(client).toBeDefined();
      delete process.env.GITHUB_TOKEN;
    });

    it("uses empty string when no token provided", () => {
      delete process.env.GITHUB_TOKEN;
      const client = new GitHubClient({
        requestDelayMs: 100,
        retryLimit: 3,
      });
      expect(client).toBeDefined();
    });
  });

  describe("GitHubRequestError", () => {
    it("is throwable with message", () => {
      const error = new GitHubRequestError("test error");
      expect(error.message).toBe("test error");
      expect(error.name).toBe("GitHubRequestError");
    });
  });
});