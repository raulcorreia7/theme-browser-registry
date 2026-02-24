import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { StateStore } from "../src/state.js";
import type { ThemeEntry } from "../src/types.js";

function makeEntry(overrides: Partial<ThemeEntry> = {}): ThemeEntry {
  return {
    name: "test-theme",
    repo: "owner/test-theme",
    colorscheme: "test",
    ...overrides,
  };
}

describe("StateStore", () => {
  let testDir: string;
  let dbPath: string;
  let store: StateStore;

  beforeEach(() => {
    testDir = join(tmpdir(), `state-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    dbPath = join(testDir, "test.db");
    store = new StateStore(dbPath);
  });

  afterEach(() => {
    store.close();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("creates database file", () => {
      expect(existsSync(dbPath)).toBe(true);
    });

    it("creates repo_cache table", () => {
      const entry = store.readRepo("nonexistent");
      expect(entry).toBeNull();
    });
  });

  describe("upsertRepo and readRepo", () => {
    it("stores and retrieves an entry", () => {
      const payload = makeEntry();
      store.upsertRepo("owner/theme", "2024-01-01", payload);

      const result = store.readRepo("owner/theme");
      expect(result).not.toBeNull();
      expect(result?.repo).toBe("owner/theme");
      expect(result?.updated_at).toBe("2024-01-01");
      expect(result?.payload).toEqual(payload);
      expect(result?.parse_error).toBeNull();
    });

    it("updates existing entry", () => {
      const payload1 = makeEntry({ name: "theme-v1" });
      const payload2 = makeEntry({ name: "theme-v2" });

      store.upsertRepo("owner/theme", "2024-01-01", payload1);
      store.upsertRepo("owner/theme", "2024-01-02", payload2);

      const result = store.readRepo("owner/theme");
      expect(result?.updated_at).toBe("2024-01-02");
      expect(result?.payload?.name).toBe("theme-v2");
    });

    it("stores parse error", () => {
      const payload = makeEntry();
      store.upsertRepo("owner/theme", "2024-01-01", payload, "Parse failed");

      const result = store.readRepo("owner/theme");
      expect(result?.parse_error).toBe("Parse failed");
    });

    it("returns null for nonexistent repo", () => {
      const result = store.readRepo("nonexistent/repo");
      expect(result).toBeNull();
    });
  });

  describe("shouldRefresh", () => {
    it("returns true for nonexistent repo", () => {
      expect(store.shouldRefresh("new/repo", "2024-01-01", 14)).toBe(true);
    });

    it("returns true for repo with parse error", () => {
      const payload = makeEntry();
      store.upsertRepo("owner/theme", "2024-01-01", payload, "Error");
      expect(store.shouldRefresh("owner/theme", "2024-01-01", 14)).toBe(true);
    });

    it("returns true when updated_at differs", () => {
      const payload = makeEntry();
      store.upsertRepo("owner/theme", "2024-01-01", payload);
      expect(store.shouldRefresh("owner/theme", "2024-01-02", 14)).toBe(true);
    });

    it("returns true when stale", () => {
      const payload = makeEntry();
      store.upsertRepo("owner/theme", "2024-01-01", payload);

      const oldTimestamp = Math.floor(Date.now() / 1000) - 15 * 24 * 60 * 60;
      store.close();
      store = new StateStore(dbPath);
      store.raw.prepare("UPDATE repo_cache SET scanned_at = ? WHERE repo = ?").run(oldTimestamp, "owner/theme");

      expect(store.shouldRefresh("owner/theme", "2024-01-01", 14)).toBe(true);
    });

    it("returns false when not stale", () => {
      const payload = makeEntry();
      store.upsertRepo("owner/theme", "2024-01-01", payload);
      expect(store.shouldRefresh("owner/theme", "2024-01-01", 14)).toBe(false);
    });
  });

  describe("listPayloads", () => {
    it("returns all valid payloads", () => {
      const payload1 = makeEntry({ repo: "owner/theme1" });
      const payload2 = makeEntry({ repo: "owner/theme2" });

      store.upsertRepo("owner/theme1", "2024-01-01", payload1);
      store.upsertRepo("owner/theme2", "2024-01-01", payload2);

      const payloads = store.listPayloads();
      expect(payloads).toHaveLength(2);
      expect(payloads.map((p) => p.repo).sort()).toEqual(["owner/theme1", "owner/theme2"]);
    });

    it("excludes entries with parse errors", () => {
      const payload1 = makeEntry({ repo: "owner/theme1" });
      const payload2 = makeEntry({ repo: "owner/theme2" });

      store.upsertRepo("owner/theme1", "2024-01-01", payload1);
      store.upsertRepo("owner/theme2", "2024-01-01", payload2, "Error");

      const payloads = store.listPayloads();
      expect(payloads).toHaveLength(1);
      expect(payloads[0]?.repo).toBe("owner/theme1");
    });

    it("returns empty array for empty database", () => {
      expect(store.listPayloads()).toEqual([]);
    });
  });
});
