import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, DEFAULT_CONFIG, type Config } from "../src/config.js";

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
      expect(DEFAULT_CONFIG.topics).toEqual(["neovim-colorscheme", "nvim-theme", "vim-colorscheme"]);
      expect(DEFAULT_CONFIG.include_repos).toEqual([]);
      expect(DEFAULT_CONFIG.output_path).toBe("artifacts/themes.json");
      expect(DEFAULT_CONFIG.manifest_path).toBe("artifacts/manifest.json");
      expect(DEFAULT_CONFIG.per_page).toBe(100);
      expect(DEFAULT_CONFIG.max_pages_per_topic).toBe(5);
      expect(DEFAULT_CONFIG.retry_limit).toBe(3);
      expect(DEFAULT_CONFIG.skip_archived).toBe(true);
      expect(DEFAULT_CONFIG.skip_disabled).toBe(true);
      expect(DEFAULT_CONFIG.sort_by).toBe("stars");
      expect(DEFAULT_CONFIG.sort_order).toBe("desc");
      expect(DEFAULT_CONFIG.log_level).toBe("INFO");
    });
  });

  describe("loadConfig", () => {
    it("returns defaults when file does not exist", () => {
      const config = loadConfig(join(testDir, "nonexistent.json"));
      expect(config.output_path).toBe(DEFAULT_CONFIG.output_path);
      expect(config.per_page).toBe(DEFAULT_CONFIG.per_page);
    });

    it("returns defaults for empty JSON file", () => {
      const path = join(testDir, "empty.json");
      writeFileSync(path, "{}");
      const config = loadConfig(path);
      expect(config.output_path).toBe(DEFAULT_CONFIG.output_path);
    });

    it("overrides string values", () => {
      const path = join(testDir, "override.json");
      writeFileSync(path, JSON.stringify({ output_path: "custom.json", log_level: "debug" }));
      const config = loadConfig(path);
      expect(config.output_path).toBe("custom.json");
      expect(config.log_level).toBe("DEBUG");
    });

    it("overrides numeric values with clamping", () => {
      const path = join(testDir, "numeric.json");
      writeFileSync(
        path,
        JSON.stringify({
          per_page: 50,
          max_pages_per_topic: 0,
          retry_limit: 5,
        })
      );
      const config = loadConfig(path);
      expect(config.per_page).toBe(50);
      expect(config.max_pages_per_topic).toBe(0);
      expect(config.retry_limit).toBe(5);
    });

    it("clamps per_page to valid range", () => {
      const path = join(testDir, "clamp-high.json");
      writeFileSync(path, JSON.stringify({ per_page: 999 }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(100);
    });

    it("clamps negative values", () => {
      const path = join(testDir, "clamp-negative.json");
      writeFileSync(path, JSON.stringify({ per_page: -5 }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(1);
    });

    it("overrides boolean values", () => {
      const path = join(testDir, "bool.json");
      writeFileSync(path, JSON.stringify({ skip_archived: false }));
      const config = loadConfig(path);
      expect(config.skip_archived).toBe(false);
    });

    it("overrides arrays", () => {
      const path = join(testDir, "array.json");
      writeFileSync(
        path,
        JSON.stringify({
          topics: ["custom-topic"],
          include_repos: ["owner/repo"],
        })
      );
      const config = loadConfig(path);
      expect(config.topics).toEqual(["custom-topic"]);
      expect(config.include_repos).toEqual(["owner/repo"]);
    });

    it("deduplicates array entries", () => {
      const path = join(testDir, "dedup.json");
      writeFileSync(path, JSON.stringify({ topics: ["a", "b", "a"] }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(["a", "b"]);
    });

    it("strips whitespace from array entries", () => {
      const path = join(testDir, "whitespace.json");
      writeFileSync(path, JSON.stringify({ topics: ["  a  ", "b"] }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(["a", "b"]);
    });

    it("uses defaults for non-array values for array fields", () => {
      const path = join(testDir, "ignore.json");
      writeFileSync(path, JSON.stringify({ topics: "not-an-array" }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(DEFAULT_CONFIG.topics);
    });

    it("uses default topics when empty array provided", () => {
      const path = join(testDir, "empty-topics.json");
      writeFileSync(path, JSON.stringify({ topics: [] }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(DEFAULT_CONFIG.topics);
    });

    it("validates sort_by enum", () => {
      const path = join(testDir, "sort.json");
      writeFileSync(path, JSON.stringify({ sort_by: "invalid" }));
      const config = loadConfig(path);
      expect(config.sort_by).toBe("stars");
    });

    it("validates sort_order enum", () => {
      const path = join(testDir, "order.json");
      writeFileSync(path, JSON.stringify({ sort_order: "invalid" }));
      const config = loadConfig(path);
      expect(config.sort_order).toBe("desc");
    });

    it("validates log_level enum (case insensitive)", () => {
      const path = join(testDir, "level.json");
      writeFileSync(path, JSON.stringify({ log_level: "debug" }));
      const config = loadConfig(path);
      expect(config.log_level).toBe("DEBUG");
    });

    it("falls back to default log_level for invalid value", () => {
      const path = join(testDir, "bad-level.json");
      writeFileSync(path, JSON.stringify({ log_level: "invalid" }));
      const config = loadConfig(path);
      expect(config.log_level).toBe("INFO");
    });

    it("merges partial config with defaults", () => {
      const path = join(testDir, "partial.json");
      writeFileSync(path, JSON.stringify({ per_page: 25 }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(25);
      expect(config.retry_limit).toBe(DEFAULT_CONFIG.retry_limit);
      expect(config.skip_archived).toBe(DEFAULT_CONFIG.skip_archived);
    });

    it("handles malformed JSON gracefully", () => {
      const path = join(testDir, "malformed.json");
      writeFileSync(path, "{ not json }");
      const config = loadConfig(path);
      expect(config.output_path).toBe(DEFAULT_CONFIG.output_path);
    });

    it("handles non-object JSON gracefully", () => {
      const path = join(testDir, "array.json");
      writeFileSync(path, JSON.stringify([1, 2, 3]));
      const config = loadConfig(path);
      expect(config.output_path).toBe(DEFAULT_CONFIG.output_path);
    });

    it("handles null JSON gracefully", () => {
      const path = join(testDir, "null.json");
      writeFileSync(path, "null");
      const config = loadConfig(path);
      expect(config.output_path).toBe(DEFAULT_CONFIG.output_path);
    });

    it("clamps concurrency to valid range", () => {
      const path = join(testDir, "concurrency.json");
      writeFileSync(path, JSON.stringify({ concurrency: 100 }));
      const config = loadConfig(path);
      expect(config.concurrency).toBe(20);
    });

    it("clamps concurrency minimum", () => {
      const path = join(testDir, "concurrency-min.json");
      writeFileSync(path, JSON.stringify({ concurrency: 0 }));
      const config = loadConfig(path);
      expect(config.concurrency).toBe(1);
    });
  });
});
