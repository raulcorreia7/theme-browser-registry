import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, DEFAULT_CONFIG } from "@/lib/config";

describe("config", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("DEFAULT_CONFIG", () => {
    it("has expected default values", () => {
      expect(DEFAULT_CONFIG.version).toBe("2.0.0");
      expect(DEFAULT_CONFIG.discovery.topics).toEqual([
        "neovim-colorscheme",
        "nvim-theme",
        "vim-colorscheme",
      ]);
      expect(DEFAULT_CONFIG.discovery.includeRepos).toEqual([]);
      expect(DEFAULT_CONFIG.discovery.pagination.perPage).toBe(100);
      expect(DEFAULT_CONFIG.discovery.pagination.maxPagesPerTopic).toBe(5);
      expect(DEFAULT_CONFIG.github.rateLimit.delayMs).toBe(250);
      expect(DEFAULT_CONFIG.github.rateLimit.retryLimit).toBe(3);
      expect(DEFAULT_CONFIG.processing.batch.size).toBe(50);
      expect(DEFAULT_CONFIG.processing.concurrency).toBe(5);
      expect(DEFAULT_CONFIG.filters.minStars).toBe(0);
      expect(DEFAULT_CONFIG.filters.skipArchived).toBe(true);
      expect(DEFAULT_CONFIG.filters.skipDisabled).toBe(true);
      expect(DEFAULT_CONFIG.filters.dotfiles.enabled).toBe(true);
      expect(DEFAULT_CONFIG.filters.dotfiles.topics).toContain("dotfiles");
      expect(DEFAULT_CONFIG.filters.dotfiles.nameTokens).toContain("dotfiles");
      expect(DEFAULT_CONFIG.filters.dotfiles.descriptionTokens).toContain("dotfiles");
      expect(DEFAULT_CONFIG.output.themes).toBe("artifacts/themes.json");
      expect(DEFAULT_CONFIG.output.manifest).toBe("artifacts/manifest.json");
      expect(DEFAULT_CONFIG.output.cache).toBe(".state/indexer.db");
      expect(DEFAULT_CONFIG.overrides).toBe("overrides.json");
      expect(DEFAULT_CONFIG.runtime.logLevel).toBe("INFO");
      expect(DEFAULT_CONFIG.sort.by).toBe("stars");
      expect(DEFAULT_CONFIG.sort.order).toBe("desc");
      expect(DEFAULT_CONFIG.publish.enabled).toBe(false);
      expect(DEFAULT_CONFIG.publish.git.remote).toBe("origin");
      expect(DEFAULT_CONFIG.publish.git.branch).toBe("master");
    });
  });

  describe("loadConfig", () => {
    it("returns defaults when file does not exist", () => {
      const config = loadConfig(join(testDir, "nonexistent.json"));
      expect(config.output.themes).toBe(DEFAULT_CONFIG.output.themes);
      expect(config.discovery.pagination.perPage).toBe(DEFAULT_CONFIG.discovery.pagination.perPage);
    });

    it("returns defaults for empty JSON file", () => {
      const path = join(testDir, "empty.json");
      writeFileSync(path, "{}");
      const config = loadConfig(path);
      expect(config.output.themes).toBe(DEFAULT_CONFIG.output.themes);
    });

    it("overrides nested string values", () => {
      const path = join(testDir, "override.json");
      writeFileSync(
        path,
        JSON.stringify({
          output: { themes: "custom.json" },
          runtime: { logLevel: "debug" },
        }),
      );
      const config = loadConfig(path);
      expect(config.output.themes).toBe("custom.json");
      expect(config.runtime.logLevel).toBe("DEBUG");
    });

    it("overrides nested numeric values with validation", () => {
      const path = join(testDir, "numeric.json");
      writeFileSync(
        path,
        JSON.stringify({
          discovery: { pagination: { perPage: 50 } },
          github: { rateLimit: { retryLimit: 5 } },
        }),
      );
      const config = loadConfig(path);
      expect(config.discovery.pagination.perPage).toBe(50);
      expect(config.github.rateLimit.retryLimit).toBe(5);
    });

    it("clamps perPage to valid range", () => {
      const path = join(testDir, "clamp-high.json");
      writeFileSync(path, JSON.stringify({ discovery: { pagination: { perPage: 999 } } }));
      const config = loadConfig(path);
      expect(config.discovery.pagination.perPage).toBe(100);
    });

    it("uses default for negative values below minimum", () => {
      const path = join(testDir, "negative.json");
      writeFileSync(path, JSON.stringify({ filters: { minStars: -5 } }));
      const config = loadConfig(path);
      expect(config.filters.minStars).toBe(DEFAULT_CONFIG.filters.minStars);
    });

    it("overrides boolean values", () => {
      const path = join(testDir, "bool.json");
      writeFileSync(path, JSON.stringify({ filters: { skipArchived: false } }));
      const config = loadConfig(path);
      expect(config.filters.skipArchived).toBe(false);
    });

    it("overrides dotfiles filtering options", () => {
      const path = join(testDir, "dotfiles.json");
      writeFileSync(
        path,
        JSON.stringify({
          filters: {
            dotfiles: {
              enabled: false,
              topics: ["custom-dotfiles-topic"],
              nameTokens: ["my-dotfiles"],
              descriptionTokens: ["personal config"],
            },
          },
        }),
      );
      const config = loadConfig(path);
      expect(config.filters.dotfiles.enabled).toBe(false);
      expect(config.filters.dotfiles.topics).toEqual(["custom-dotfiles-topic"]);
      expect(config.filters.dotfiles.nameTokens).toEqual(["my-dotfiles"]);
      expect(config.filters.dotfiles.descriptionTokens).toEqual(["personal config"]);
    });

    it("overrides arrays", () => {
      const path = join(testDir, "array.json");
      writeFileSync(
        path,
        JSON.stringify({
          discovery: {
            topics: ["custom-topic"],
            includeRepos: ["owner/repo"],
          },
        }),
      );
      const config = loadConfig(path);
      expect(config.discovery.topics).toEqual(["custom-topic"]);
      expect(config.discovery.includeRepos).toEqual(["owner/repo"]);
    });

    it("validates sort enum", () => {
      const path = join(testDir, "sort.json");
      writeFileSync(path, JSON.stringify({ sort: { by: "invalid" } }));
      const config = loadConfig(path);
      expect(config.sort.by).toBe("stars");
    });

    it("validates logLevel enum (case insensitive)", () => {
      const path = join(testDir, "level.json");
      writeFileSync(path, JSON.stringify({ runtime: { logLevel: "debug" } }));
      const config = loadConfig(path);
      expect(config.runtime.logLevel).toBe("DEBUG");
    });

    it("merges partial config with defaults", () => {
      const path = join(testDir, "partial.json");
      writeFileSync(path, JSON.stringify({ discovery: { pagination: { perPage: 25 } } }));
      const config = loadConfig(path);
      expect(config.discovery.pagination.perPage).toBe(25);
      expect(config.github.rateLimit.retryLimit).toBe(DEFAULT_CONFIG.github.rateLimit.retryLimit);
      expect(config.filters.skipArchived).toBe(DEFAULT_CONFIG.filters.skipArchived);
    });

    it("handles malformed JSON gracefully", () => {
      const path = join(testDir, "malformed.json");
      writeFileSync(path, "{ not json }");
      const config = loadConfig(path);
      expect(config.output.themes).toBe(DEFAULT_CONFIG.output.themes);
    });

    it("handles non-object JSON gracefully", () => {
      const path = join(testDir, "array.json");
      writeFileSync(path, JSON.stringify([1, 2, 3]));
      const config = loadConfig(path);
      expect(config.output.themes).toBe(DEFAULT_CONFIG.output.themes);
    });

    it("handles null JSON gracefully", () => {
      const path = join(testDir, "null.json");
      writeFileSync(path, "null");
      const config = loadConfig(path);
      expect(config.output.themes).toBe(DEFAULT_CONFIG.output.themes);
    });

    it("uses default for values exceeding maximum", () => {
      const path = join(testDir, "concurrency.json");
      writeFileSync(path, JSON.stringify({ processing: { concurrency: 100 } }));
      const config = loadConfig(path);
      expect(config.processing.concurrency).toBe(DEFAULT_CONFIG.processing.concurrency);
    });
  });
});
