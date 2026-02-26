import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  chunk,
  sortEntries,
  selectRepositoriesForRun,
  safeRepo,
} from "@/sync/indexer";
import { writeJson, writeManifest } from "@/db/files";
import type { ThemeEntry } from "@/lib/types";

const SHA256_HEX_LENGTH = 64;
const TEST_TIMESTAMP = Date.now();

const SORT_CONFIG_STARS_DESC = { sort: { by: "stars" as const, order: "desc" as const } };
const SORT_CONFIG_STARS_ASC = { sort: { by: "stars" as const, order: "asc" as const } };
const SORT_CONFIG_NAME_ASC = { sort: { by: "name" as const, order: "asc" as const } };
const SORT_CONFIG_UPDATED_DESC = { sort: { by: "updated_at" as const, order: "desc" as const } };

const SELECT_CONFIG_UNLIMITED = { processing: { maxReposPerRun: 0 } };
const SELECT_CONFIG_LIMIT_TWO = { processing: { maxReposPerRun: 2 } };

function createTestDir(): string {
  const dir = join(tmpdir(), `runner-test-${TEST_TIMESTAMP}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createThemeEntry(overrides: Partial<ThemeEntry> = {}): ThemeEntry {
  return {
    name: "test-theme",
    repo: "owner/test-theme",
    colorscheme: "test-theme",
    stars: 0,
    ...overrides,
  };
}

describe("runner utilities", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("safeRepo", () => {
    it("trims whitespace", () => {
      expect(safeRepo("  owner/repo  ")).toBe("owner/repo");
    });

    it("removes .git suffix", () => {
      expect(safeRepo("owner/repo.git")).toBe("owner/repo");
    });

    it("removes leading/trailing slashes", () => {
      expect(safeRepo("/owner/repo/")).toBe("owner/repo");
    });

    it("handles multiple transformations", () => {
      expect(safeRepo("  /owner/repo.git/  ")).toBe("owner/repo.git");
    });

    it("returns empty string for whitespace-only input", () => {
      expect(safeRepo("   ")).toBe("");
    });
  });

  describe("chunk", () => {
    const CHUNK_SIZE_TWO = 2;
    const CHUNK_SIZE_FIVE = 5;
    const CHUNK_SIZE_ONE = 1;

    it("splits array into chunks of specified size", () => {
      const items = [1, 2, 3, 4, 5];
      expect(chunk(items, CHUNK_SIZE_TWO)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("returns single chunk when size >= length", () => {
      expect(chunk([1, 2, 3], CHUNK_SIZE_FIVE)).toEqual([[1, 2, 3]]);
    });

    it("returns empty array for empty input", () => {
      expect(chunk([], CHUNK_SIZE_TWO)).toEqual([]);
    });

    it("handles size of 1", () => {
      expect(chunk([1, 2, 3], CHUNK_SIZE_ONE)).toEqual([[1], [2], [3]]);
    });
  });

  describe("sortEntries", () => {
    const ENTRY_ZEBRA = createThemeEntry({ name: "zebra", stars: 10, updated_at: "2024-01-01" });
    const ENTRY_ALPHA = createThemeEntry({ name: "alpha", stars: 100, updated_at: "2024-03-01" });
    const ENTRY_MIDDLE = createThemeEntry({ name: "middle", stars: 50, updated_at: "2024-02-01" });
    const entries = [ENTRY_ZEBRA, ENTRY_ALPHA, ENTRY_MIDDLE];

    it("sorts by stars descending by default", () => {
      const sorted = sortEntries(entries, SORT_CONFIG_STARS_DESC);
      expect(sorted.map((e) => e.name)).toEqual(["alpha", "middle", "zebra"]);
    });

    it("sorts by stars ascending", () => {
      const sorted = sortEntries(entries, SORT_CONFIG_STARS_ASC);
      expect(sorted.map((e) => e.name)).toEqual(["zebra", "middle", "alpha"]);
    });

    it("sorts by name", () => {
      const sorted = sortEntries(entries, SORT_CONFIG_NAME_ASC);
      expect(sorted.map((e) => e.name)).toEqual(["alpha", "middle", "zebra"]);
    });

    it("sorts by updated_at", () => {
      const sorted = sortEntries(entries, SORT_CONFIG_UPDATED_DESC);
      expect(sorted.map((e) => e.name)).toEqual(["alpha", "middle", "zebra"]);
    });

    it("handles missing values gracefully", () => {
      const ENTRY_SPARSE_A = createThemeEntry({ name: "a", stars: undefined, updated_at: "" });
      const ENTRY_SPARSE_B = createThemeEntry({ name: "b", stars: 10, updated_at: "2024-01-01" });
      const sparseEntries = [ENTRY_SPARSE_A, ENTRY_SPARSE_B];
      const sorted = sortEntries(sparseEntries, SORT_CONFIG_STARS_DESC);
      expect(sorted).toHaveLength(2);
    });

    it("does not mutate original array", () => {
      const original = [...entries];
      sortEntries(entries, SORT_CONFIG_STARS_DESC);
      expect(entries).toEqual(original);
    });
  });

  describe("selectRepositoriesForRun", () => {
    const REPO_ZEBRA = "zebra/repo";
    const REPO_ALPHA = "alpha/repo";
    const REPO_A = "a/repo";
    const REPO_B = "b/repo";
    const REPO_C = "c/repo";

    it("returns all repos sorted alphabetically", () => {
      const discovered = new Map([
        [REPO_ZEBRA, "2024-01-01"],
        [REPO_ALPHA, "2024-01-02"],
      ]);
      const result = selectRepositoriesForRun(discovered, SELECT_CONFIG_UNLIMITED);
      expect(result.map((r) => r[0])).toEqual([REPO_ALPHA, REPO_ZEBRA]);
    });

    it("limits repos when max_repos_per_run set", () => {
      const discovered = new Map([
        [REPO_A, ""],
        [REPO_B, ""],
        [REPO_C, ""],
      ]);
      const result = selectRepositoriesForRun(discovered, SELECT_CONFIG_LIMIT_TWO);
      expect(result).toHaveLength(2);
    });

    it("returns empty array for empty input", () => {
      expect(selectRepositoriesForRun(new Map(), SELECT_CONFIG_UNLIMITED)).toEqual([]);
    });
  });

  describe("writeJson", () => {
    const TEST_FILENAME = "test.json";

    it("writes JSON with newline", () => {
      const path = join(testDir, TEST_FILENAME);
      writeJson(path, { foo: "bar" });
      const content = readFileSync(path, "utf-8");
      expect(content).toBe('{\n  "foo": "bar"\n}\n');
    });

    it("creates parent directories", () => {
      const path = join(testDir, "nested/deep/test.json");
      writeJson(path, { test: true });
      expect(existsSync(path)).toBe(true);
    });
  });

  describe("writeManifest", () => {
    const THEMES_FILENAME = "themes.json";
    const MANIFEST_FILENAME = "manifest.json";
    const EXPECTED_COUNT = 5;

    it("writes manifest with checksum", () => {
      const outputPath = join(testDir, THEMES_FILENAME);
      const manifestPath = join(testDir, MANIFEST_FILENAME);
      writeFileSync(outputPath, '{"themes":[]}');

      writeManifest(manifestPath, outputPath, EXPECTED_COUNT);

      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.count).toBe(EXPECTED_COUNT);
      expect(manifest.sha256).toBeDefined();
      expect(manifest.sha256).toHaveLength(SHA256_HEX_LENGTH);
      expect(manifest.generated_at).toBeDefined();
    });
  });
});