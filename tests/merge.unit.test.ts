import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadOverrides, applyOverrides, type LoadOverridesResult } from "../src/merge.js";
import type { ThemeEntry } from "../src/types.js";

function makeEntry(overrides: Partial<ThemeEntry> = {}): ThemeEntry {
  return {
    name: "test-theme",
    repo: "owner/test-theme",
    colorscheme: "test",
    ...overrides,
  };
}

describe("merge", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `merge-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("loadOverrides", () => {
    it("returns empty arrays when file does not exist", () => {
      const result = loadOverrides(join(testDir, "nonexistent.json"));
      expect(result.overrides).toEqual([]);
      expect(result.excluded).toEqual([]);
    });

    it("returns empty arrays for empty JSON", () => {
      const path = join(testDir, "empty.json");
      writeFileSync(path, "{}");
      const result = loadOverrides(path);
      expect(result.overrides).toEqual([]);
      expect(result.excluded).toEqual([]);
    });

    it("loads overrides array", () => {
      const path = join(testDir, "overrides.json");
      writeFileSync(path, JSON.stringify({
        overrides: [
          { repo: "owner/theme1", name: "custom-name" },
          { repo: "owner/theme2", colorscheme: "custom-color" },
        ],
      }));
      const result = loadOverrides(path);
      expect(result.overrides).toHaveLength(2);
      expect(result.overrides[0]?.repo).toBe("owner/theme1");
      expect(result.overrides[1]?.repo).toBe("owner/theme2");
    });

    it("loads excluded array", () => {
      const path = join(testDir, "excluded.json");
      writeFileSync(path, JSON.stringify({
        excluded: ["owner/deprecated", "owner/archived"],
      }));
      const result = loadOverrides(path);
      expect(result.excluded).toEqual(["owner/deprecated", "owner/archived"]);
    });

    it("ignores invalid override items (missing repo)", () => {
      const path = join(testDir, "invalid-override.json");
      writeFileSync(path, JSON.stringify({
        overrides: [
          { name: "no-repo" },
          { repo: "owner/valid", name: "valid" },
          null,
        ],
      }));
      const result = loadOverrides(path);
      expect(result.overrides).toHaveLength(1);
      expect(result.overrides[0]?.repo).toBe("owner/valid");
    });

    it("ignores non-string excluded items", () => {
      const path = join(testDir, "invalid-excluded.json");
      writeFileSync(path, JSON.stringify({
        excluded: ["valid", 123, null, "", "also-valid"],
      }));
      const result = loadOverrides(path);
      expect(result.excluded).toEqual(["valid", "also-valid"]);
    });

    it("returns empty for non-object JSON", () => {
      const path = join(testDir, "array.json");
      writeFileSync(path, JSON.stringify([1, 2, 3]));
      const result = loadOverrides(path);
      expect(result.overrides).toEqual([]);
      expect(result.excluded).toEqual([]);
    });

    it("returns empty for malformed JSON", () => {
      const path = join(testDir, "malformed.json");
      writeFileSync(path, "{ not valid }");
      expect(() => loadOverrides(path)).toThrow();
    });
  });

  describe("applyOverrides", () => {
    it("returns empty array for empty input", () => {
      expect(applyOverrides([], [], [])).toEqual([]);
    });

    it("returns entries unchanged when no overrides or exclusions", () => {
      const entries = [makeEntry({ repo: "owner/a" }), makeEntry({ repo: "owner/b" })];
      const result = applyOverrides(entries, [], []);
      expect(result).toHaveLength(2);
    });

    it("excludes repos from the list", () => {
      const entries = [
        makeEntry({ repo: "owner/keep" }),
        makeEntry({ repo: "owner/remove" }),
      ];
      const result = applyOverrides(entries, [], ["owner/remove"]);
      expect(result).toHaveLength(1);
      expect(result[0]?.repo).toBe("owner/keep");
    });

    it("applies override to existing entry", () => {
      const entries = [makeEntry({ repo: "owner/theme", name: "original" })];
      const overrides = [{ repo: "owner/theme", name: "overridden" }];
      const result = applyOverrides(entries, overrides, []);
      expect(result[0]?.name).toBe("overridden");
    });

    it("adds new entry from override (synthetic)", () => {
      const entries = [makeEntry({ repo: "owner/existing" })];
      const overrides = [{ repo: "owner/new", name: "new-theme", colorscheme: "new" }];
      const result = applyOverrides(entries, overrides, []);
      expect(result).toHaveLength(2);
      const newEntry = result.find((e) => e.repo === "owner/new");
      expect(newEntry?.name).toBe("new-theme");
    });

    it("deep merges meta field", () => {
      const entries = [makeEntry({
        repo: "owner/theme",
        meta: { strategy: "colorscheme_only", module: "original" },
      })];
      const overrides = [{
        repo: "owner/theme",
        meta: { strategy: "setup_colorscheme" },
      }];
      const result = applyOverrides(entries, overrides, []);
      expect(result[0]?.meta?.strategy).toBe("setup_colorscheme");
      expect(result[0]?.meta?.module).toBe("original");
    });

    it("replaces variants entirely", () => {
      const entries = [makeEntry({
        repo: "owner/theme",
        variants: [{ name: "dark", colorscheme: "dark" }],
      })];
      const overrides = [{
        repo: "owner/theme",
        variants: [{ name: "light", colorscheme: "light" }],
      }];
      const result = applyOverrides(entries, overrides, []);
      expect(result[0]?.variants).toHaveLength(1);
      expect(result[0]?.variants?.[0]?.name).toBe("light");
    });

    it("handles multiple overrides", () => {
      const entries = [
        makeEntry({ repo: "owner/a", name: "a" }),
        makeEntry({ repo: "owner/b", name: "b" }),
      ];
      const overrides = [
        { repo: "owner/a", name: "a-modified" },
        { repo: "owner/b", stars: 999 },
      ];
      const result = applyOverrides(entries, overrides, []);
      expect(result.find((e) => e.repo === "owner/a")?.name).toBe("a-modified");
      expect(result.find((e) => e.repo === "owner/b")?.stars).toBe(999);
    });

    it("skips override without repo", () => {
      const entries = [makeEntry({ repo: "owner/theme" })];
      const overrides = [{ name: "no-repo" } as { repo: string }];
      const result = applyOverrides(entries, overrides, []);
      expect(result).toHaveLength(1);
    });

    it("override can re-add excluded repo (synthetic entry)", () => {
      const entries = [makeEntry({ repo: "owner/theme" })];
      const overrides = [{ repo: "owner/theme", name: "modified" }];
      const result = applyOverrides(entries, overrides, ["owner/theme"]);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("modified");
    });
  });
});
