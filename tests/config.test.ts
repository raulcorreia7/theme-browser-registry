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
      expect(DEFAULT_CONFIG.output_path).toBe("themes.json");
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
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("returns defaults for empty JSON file", () => {
      const path = join(testDir, "empty.json");
      writeFileSync(path, "{}");
      const config = loadConfig(path);
      expect(config).toEqual(DEFAULT_CONFIG);
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
      writeFileSync(path, JSON.stringify({ per_page: 50, retry_limit: 20 }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(50);
      expect(config.retry_limit).toBe(10);
    });

    it("clamps per_page to min 1", () => {
      const path = join(testDir, "clamp.json");
      writeFileSync(path, JSON.stringify({ per_page: 0 }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(1);
    });

    it("clamps per_page to max 100", () => {
      const path = join(testDir, "clamp-max.json");
      writeFileSync(path, JSON.stringify({ per_page: 200 }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(100);
    });

    it("handles boolean overrides", () => {
      const path = join(testDir, "bool.json");
      writeFileSync(path, JSON.stringify({ skip_archived: false, skip_disabled: false }));
      const config = loadConfig(path);
      expect(config.skip_archived).toBe(false);
      expect(config.skip_disabled).toBe(false);
    });

    it("parses topics array", () => {
      const path = join(testDir, "topics.json");
      writeFileSync(path, JSON.stringify({ topics: ["custom-topic", "another-topic"] }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(["custom-topic", "another-topic"]);
    });

    it("deduplicates topics", () => {
      const path = join(testDir, "dup-topics.json");
      writeFileSync(path, JSON.stringify({ topics: ["a", "a", "b"] }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(["a", "b"]);
    });

    it("uses default topics when array is empty", () => {
      const path = join(testDir, "empty-topics.json");
      writeFileSync(path, JSON.stringify({ topics: [] }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(DEFAULT_CONFIG.topics);
    });

    it("validates sort_by values", () => {
      const path = join(testDir, "sort.json");
      writeFileSync(path, JSON.stringify({ sort_by: "updated_at" }));
      const config = loadConfig(path);
      expect(config.sort_by).toBe("updated_at");
    });

    it("falls back to default sort_by for invalid values", () => {
      const path = join(testDir, "invalid-sort.json");
      writeFileSync(path, JSON.stringify({ sort_by: "invalid" }));
      const config = loadConfig(path);
      expect(config.sort_by).toBe("stars");
    });

    it("validates sort_order values", () => {
      const path = join(testDir, "order.json");
      writeFileSync(path, JSON.stringify({ sort_order: "asc" }));
      const config = loadConfig(path);
      expect(config.sort_order).toBe("asc");
    });

    it("falls back to default sort_order for invalid values", () => {
      const path = join(testDir, "invalid-order.json");
      writeFileSync(path, JSON.stringify({ sort_order: "invalid" }));
      const config = loadConfig(path);
      expect(config.sort_order).toBe("desc");
    });

    it("validates log_level values case-insensitively", () => {
      const path = join(testDir, "log.json");
      writeFileSync(path, JSON.stringify({ log_level: "warning" }));
      const config = loadConfig(path);
      expect(config.log_level).toBe("WARNING");
    });

    it("falls back to default log_level for invalid values", () => {
      const path = join(testDir, "invalid-log.json");
      writeFileSync(path, JSON.stringify({ log_level: "trace" }));
      const config = loadConfig(path);
      expect(config.log_level).toBe("INFO");
    });

    it("ignores non-string topics", () => {
      const path = join(testDir, "mixed-topics.json");
      writeFileSync(path, JSON.stringify({ topics: ["valid", 123, null, "also-valid"] }));
      const config = loadConfig(path);
      expect(config.topics).toEqual(["valid", "also-valid"]);
    });

    it("returns defaults for malformed JSON", () => {
      const path = join(testDir, "malformed.json");
      writeFileSync(path, "{ not valid json }");
      const config = loadConfig(path);
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("returns defaults for non-object JSON", () => {
      const path = join(testDir, "array.json");
      writeFileSync(path, JSON.stringify([1, 2, 3]));
      const config = loadConfig(path);
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("handles null asInt input", () => {
      const path = join(testDir, "null-int.json");
      writeFileSync(path, JSON.stringify({ per_page: null }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(DEFAULT_CONFIG.per_page);
    });

    it("handles boolean asInt input (uses fallback)", () => {
      const path = join(testDir, "bool-int.json");
      writeFileSync(path, JSON.stringify({ per_page: true }));
      const config = loadConfig(path);
      expect(config.per_page).toBe(DEFAULT_CONFIG.per_page);
    });

    it("strips whitespace from string values", () => {
      const path = join(testDir, "whitespace.json");
      writeFileSync(path, JSON.stringify({ output_path: "  spaced.json  " }));
      const config = loadConfig(path);
      expect(config.output_path).toBe("spaced.json");
    });

    it("rejects empty strings (uses fallback)", () => {
      const path = join(testDir, "empty-string.json");
      writeFileSync(path, JSON.stringify({ output_path: "   " }));
      const config = loadConfig(path);
      expect(config.output_path).toBe(DEFAULT_CONFIG.output_path);
    });
  });
});
