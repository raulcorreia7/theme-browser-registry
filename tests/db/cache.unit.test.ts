import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { RepoCache } from "@/db/sqlite";
import type { ThemeEntry } from "@/lib/types";

function makeEntry(overrides: Partial<ThemeEntry> = {}): ThemeEntry {
  return {
    name: "test-theme",
    repo: "owner/test-theme",
    colorscheme: "test",
    ...overrides,
  };
}

describe("RepoCache", () => {
  let testDir: string;
  let dbPath: string;
  let cache: RepoCache;

  beforeEach(() => {
    testDir = join(tmpdir(), `cache-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    dbPath = join(testDir, "test.db");
    cache = new RepoCache(dbPath);
  });

  afterEach(async () => {
    await cache.close();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("creates database file", () => {
      expect(existsSync(dbPath)).toBe(true);
    });

    it("creates repo_cache table", async () => {
      const entry = await cache.readRepo("nonexistent");
      expect(entry).toBeNull();
    });
  });

  describe("upsertRepo and readRepo", () => {
    it("stores and retrieves an entry", async () => {
      const payload = makeEntry();
      await cache.upsertRepo("owner/theme", "2024-01-01", payload);

      const result = await cache.readRepo("owner/theme");
      expect(result).not.toBeNull();
      expect(result?.repo).toBe("owner/theme");
      expect(result?.updated_at).toBe("2024-01-01");
      expect(result?.payload).toEqual(payload);
      expect(result?.parse_error).toBeNull();
    });

    it("updates existing entry", async () => {
      const payload1 = makeEntry({ name: "theme-v1" });
      const payload2 = makeEntry({ name: "theme-v2" });

      await cache.upsertRepo("owner/theme", "2024-01-01", payload1);
      await cache.upsertRepo("owner/theme", "2024-01-02", payload2);

      const result = await cache.readRepo("owner/theme");
      expect(result?.updated_at).toBe("2024-01-02");
      expect(result?.payload).toEqual(payload2);
    });

    it("stores parse_error", async () => {
      await cache.upsertRepo("owner/bad", "2024-01-01", { repo: "owner/bad" }, "parse failed");

      const result = await cache.readRepo("owner/bad");
      expect(result?.parse_error).toBe("parse failed");
    });

    it("returns null for non-existent repo", async () => {
      const result = await cache.readRepo("owner/nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("shouldRefresh", () => {
    it("returns true for new repo", async () => {
      const result = await cache.shouldRefresh("owner/new", "2024-01-01", 7);
      expect(result).toBe(true);
    });

    it("returns false for fresh entry", async () => {
      const payload = makeEntry();
      await cache.upsertRepo("owner/fresh", "2024-01-01", payload);

      const result = await cache.shouldRefresh("owner/fresh", "2024-01-01", 7);
      expect(result).toBe(false);
    });

    it("returns true when updated_at differs", async () => {
      const payload = makeEntry();
      await cache.upsertRepo("owner/changed", "2024-01-01", payload);

      const result = await cache.shouldRefresh("owner/changed", "2024-01-02", 7);
      expect(result).toBe(true);
    });

    it("returns true for stale entry", async () => {
      const payload = makeEntry();
      await cache.upsertRepo("owner/stale", "2024-01-01", payload);

      const result = await cache.shouldRefresh("owner/stale", "2024-01-01", -1);
      expect(result).toBe(true);
    });

    it("returns true when parse_error exists", async () => {
      await cache.upsertRepo("owner/error", "2024-01-01", { repo: "owner/error" }, "failed");

      const result = await cache.shouldRefresh("owner/error", "2024-01-01", 7);
      expect(result).toBe(true);
    });
  });

  describe("listPayloads", () => {
    it("returns all valid payloads", async () => {
      const entry1 = makeEntry({ repo: "owner/theme1" });
      const entry2 = makeEntry({ repo: "owner/theme2" });

      await cache.upsertRepo("owner/theme1", "2024-01-01", entry1);
      await cache.upsertRepo("owner/theme2", "2024-01-02", entry2);

      const payloads = await cache.listPayloads();
      expect(payloads).toHaveLength(2);
      expect(payloads.map((p) => p.repo)).toContain("owner/theme1");
      expect(payloads.map((p) => p.repo)).toContain("owner/theme2");
    });

    it("excludes entries with parse_error", async () => {
      const good = makeEntry({ repo: "owner/good" });
      await cache.upsertRepo("owner/good", "2024-01-01", good);
      await cache.upsertRepo("owner/bad", "2024-01-01", { repo: "owner/bad" }, "error");

      const payloads = await cache.listPayloads();
      expect(payloads).toHaveLength(1);
      expect(payloads[0]?.repo).toBe("owner/good");
    });

    it("returns empty array when no entries", async () => {
      const payloads = await cache.listPayloads();
      expect(payloads).toEqual([]);
    });
  });
});