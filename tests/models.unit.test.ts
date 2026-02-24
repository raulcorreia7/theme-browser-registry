import { describe, it, expect } from "vitest";
import {
  createThemeMeta,
  createThemeVariant,
  createThemeEntry,
  createRepoCacheEntry,
  isValidStrategy,
  isValidAdapter,
  isThemeMeta,
  isThemeVariant,
  isThemeEntry,
  isGitHubRepoItem,
  isGitHubTreeItem,
  isRepoCacheEntry,
} from "../src/models.js";
import type {
  ThemeMeta,
  ThemeVariant,
  ThemeEntry,
  GitHubRepoItem,
  GitHubTreeItem,
  RepoCacheEntry,
} from "../src/types.js";

describe("models", () => {
  describe("factory functions", () => {
    describe("createThemeMeta", () => {
      it("creates empty meta by default", () => {
        const meta = createThemeMeta();
        expect(meta).toEqual({});
      });

      it("creates meta with provided values", () => {
        const meta = createThemeMeta({
          strategy: "setup_colorscheme",
          adapter: "use",
          module: "theme.module",
          background: "dark",
        });
        expect(meta.strategy).toBe("setup_colorscheme");
        expect(meta.adapter).toBe("use");
        expect(meta.module).toBe("theme.module");
        expect(meta.background).toBe("dark");
      });
    });

    describe("createThemeVariant", () => {
      it("creates variant without meta", () => {
        const variant = createThemeVariant("dark", "theme-dark");
        expect(variant).toEqual({ name: "dark", colorscheme: "theme-dark" });
      });

      it("creates variant with meta", () => {
        const meta: ThemeMeta = { background: "dark" };
        const variant = createThemeVariant("dark", "theme-dark", meta);
        expect(variant.meta).toEqual(meta);
      });
    });

    describe("createThemeEntry", () => {
      it("creates minimal entry", () => {
        const entry = createThemeEntry("mytheme", "owner/mytheme", "mytheme");
        expect(entry).toEqual({
          name: "mytheme",
          repo: "owner/mytheme",
          colorscheme: "mytheme",
        });
      });

      it("creates entry with optional fields", () => {
        const entry = createThemeEntry("mytheme", "owner/mytheme", "mytheme", {
          description: "A great theme",
          stars: 100,
          topics: ["neovim"],
          updated_at: "2024-01-01",
          archived: false,
          disabled: false,
          homepage: "https://example.com",
        });
        expect(entry.description).toBe("A great theme");
        expect(entry.stars).toBe(100);
        expect(entry.topics).toEqual(["neovim"]);
        expect(entry.homepage).toBe("https://example.com");
      });
    });

    describe("createRepoCacheEntry", () => {
      it("creates entry with payload", () => {
        const payload = createThemeEntry("test", "owner/test", "test");
        const entry = createRepoCacheEntry("owner/test", "2024-01-01", 1234567890, payload);
        expect(entry.repo).toBe("owner/test");
        expect(entry.updated_at).toBe("2024-01-01");
        expect(entry.scanned_at).toBe(1234567890);
        expect(entry.payload).toEqual(payload);
        expect(entry.parse_error).toBeNull();
      });

      it("creates entry with parse error", () => {
        const entry = createRepoCacheEntry("owner/test", "2024-01-01", 1234567890, null, "Parse failed");
        expect(entry.payload).toBeNull();
        expect(entry.parse_error).toBe("Parse failed");
      });
    });
  });

  describe("type guards", () => {
    describe("isValidStrategy", () => {
      it("accepts valid strategies", () => {
        expect(isValidStrategy("colorscheme_only")).toBe(true);
        expect(isValidStrategy("setup_colorscheme")).toBe(true);
        expect(isValidStrategy("vimg_colorscheme")).toBe(true);
      });

      it("rejects invalid strategies", () => {
        expect(isValidStrategy("invalid")).toBe(false);
        expect(isValidStrategy("")).toBe(false);
        expect(isValidStrategy(null)).toBe(false);
        expect(isValidStrategy(123)).toBe(false);
      });
    });

    describe("isValidAdapter", () => {
      it("accepts valid adapters", () => {
        expect(isValidAdapter("load")).toBe(true);
        expect(isValidAdapter("setup_load")).toBe(true);
        expect(isValidAdapter("use")).toBe(true);
      });

      it("rejects invalid adapters", () => {
        expect(isValidAdapter("invalid")).toBe(false);
        expect(isValidAdapter("")).toBe(false);
        expect(isValidAdapter(null)).toBe(false);
      });
    });

    describe("isThemeMeta", () => {
      it("accepts valid meta objects", () => {
        expect(isThemeMeta({})).toBe(true);
        expect(isThemeMeta({ strategy: "colorscheme_only" })).toBe(true);
        expect(isThemeMeta({ adapter: "load", background: "dark" })).toBe(true);
        expect(isThemeMeta({ module: "test", opts_g: { foo: "bar" } })).toBe(true);
      });

      it("rejects invalid meta objects", () => {
        expect(isThemeMeta(null)).toBe(false);
        expect(isThemeMeta("string")).toBe(false);
        expect(isThemeMeta({ strategy: "invalid" })).toBe(false);
        expect(isThemeMeta({ adapter: "invalid" })).toBe(false);
        expect(isThemeMeta({ module: 123 })).toBe(false);
        expect(isThemeMeta({ background: "invalid" })).toBe(false);
        expect(isThemeMeta({ opts_g: { foo: 123 } })).toBe(false);
        expect(isThemeMeta({ opts_g: "not-object" })).toBe(false);
      });
    });

    describe("isThemeVariant", () => {
      it("accepts valid variants", () => {
        expect(isThemeVariant({ name: "dark", colorscheme: "dark" })).toBe(true);
        expect(isThemeVariant({ name: "dark", colorscheme: "dark", meta: {} })).toBe(true);
      });

      it("rejects invalid variants", () => {
        expect(isThemeVariant(null)).toBe(false);
        expect(isThemeVariant({})).toBe(false);
        expect(isThemeVariant({ name: "dark" })).toBe(false);
        expect(isThemeVariant({ colorscheme: "dark" })).toBe(false);
        expect(isThemeVariant({ name: 123, colorscheme: "dark" })).toBe(false);
        expect(isThemeVariant({ name: "dark", colorscheme: "dark", meta: "invalid" })).toBe(false);
      });
    });

    describe("isThemeEntry", () => {
      it("accepts valid entries", () => {
        expect(isThemeEntry({ name: "test", repo: "owner/test", colorscheme: "test" })).toBe(true);
        expect(isThemeEntry({
          name: "test",
          repo: "owner/test",
          colorscheme: "test",
          stars: 100,
          topics: ["a", "b"],
          variants: [{ name: "v", colorscheme: "v" }],
        })).toBe(true);
      });

      it("rejects invalid entries", () => {
        expect(isThemeEntry(null)).toBe(false);
        expect(isThemeEntry({})).toBe(false);
        expect(isThemeEntry({ name: "test" })).toBe(false);
        expect(isThemeEntry({ name: "test", repo: "owner/test" })).toBe(false);
        expect(isThemeEntry({ name: 123, repo: "owner/test", colorscheme: "test" })).toBe(false);
        expect(isThemeEntry({ name: "test", repo: "owner/test", colorscheme: "test", stars: "100" })).toBe(false);
        expect(isThemeEntry({ name: "test", repo: "owner/test", colorscheme: "test", topics: "not-array" })).toBe(false);
        expect(isThemeEntry({
          name: "test",
          repo: "owner/test",
          colorscheme: "test",
          variants: [{ name: "v" }],
        })).toBe(false);
      });
    });

    describe("isGitHubRepoItem", () => {
      it("accepts valid repo items", () => {
        expect(isGitHubRepoItem({
          id: 123,
          full_name: "owner/repo",
          description: "A repo",
          stargazers_count: 100,
          topics: ["neovim"],
          updated_at: "2024-01-01",
          archived: false,
          disabled: false,
          html_url: "https://github.com/owner/repo",
        })).toBe(true);
      });

      it("accepts null description", () => {
        expect(isGitHubRepoItem({
          id: 123,
          full_name: "owner/repo",
          description: null,
          stargazers_count: 100,
          topics: [],
          updated_at: "2024-01-01",
          archived: false,
          disabled: false,
          html_url: "https://github.com/owner/repo",
        })).toBe(true);
      });

      it("rejects invalid repo items", () => {
        expect(isGitHubRepoItem(null)).toBe(false);
        expect(isGitHubRepoItem({})).toBe(false);
        expect(isGitHubRepoItem({ id: "123", full_name: "owner/repo" })).toBe(false);
        expect(isGitHubRepoItem({ id: 123, full_name: 123 })).toBe(false);
        expect(isGitHubRepoItem({
          id: 123,
          full_name: "owner/repo",
          description: "test",
          stargazers_count: 100,
          topics: "not-array",
          updated_at: "2024-01-01",
          archived: false,
          disabled: false,
          html_url: "https://github.com/owner/repo",
        })).toBe(false);
      });
    });

    describe("isGitHubTreeItem", () => {
      it("accepts valid tree items", () => {
        expect(isGitHubTreeItem({
          path: "colors/theme.vim",
          mode: "100644",
          type: "blob",
          sha: "abc123",
          url: "https://api.github.com/...",
        })).toBe(true);

        expect(isGitHubTreeItem({
          path: "colors",
          mode: "040000",
          type: "tree",
          sha: "abc123",
          url: "https://api.github.com/...",
        })).toBe(true);
      });

      it("accepts items with optional size", () => {
        expect(isGitHubTreeItem({
          path: "file.lua",
          mode: "100644",
          type: "blob",
          sha: "abc123",
          size: 1234,
          url: "https://api.github.com/...",
        })).toBe(true);
      });

      it("rejects invalid tree items", () => {
        expect(isGitHubTreeItem(null)).toBe(false);
        expect(isGitHubTreeItem({})).toBe(false);
        expect(isGitHubTreeItem({ path: 123, mode: "100644", type: "blob", sha: "abc", url: "url" })).toBe(false);
        expect(isGitHubTreeItem({ path: "file", mode: "100644", type: "invalid", sha: "abc", url: "url" })).toBe(false);
        expect(isGitHubTreeItem({ path: "file", mode: "100644", type: "blob", sha: "abc", size: "not-number", url: "url" })).toBe(false);
      });
    });

    describe("isRepoCacheEntry", () => {
      it("accepts valid cache entries", () => {
        expect(isRepoCacheEntry({
          repo: "owner/repo",
          updated_at: "2024-01-01",
          scanned_at: 1234567890,
          payload: { name: "test" },
          parse_error: null,
        })).toBe(true);

        expect(isRepoCacheEntry({
          repo: "owner/repo",
          updated_at: "2024-01-01",
          scanned_at: 1234567890,
          payload: null,
          parse_error: "Error message",
        })).toBe(true);
      });

      it("rejects invalid cache entries", () => {
        expect(isRepoCacheEntry(null)).toBe(false);
        expect(isRepoCacheEntry({})).toBe(false);
        expect(isRepoCacheEntry({ repo: 123, updated_at: "d", scanned_at: 1, payload: null, parse_error: null })).toBe(false);
        expect(isRepoCacheEntry({ repo: "r", updated_at: 123, scanned_at: 1, payload: null, parse_error: null })).toBe(false);
        expect(isRepoCacheEntry({ repo: "r", updated_at: "d", scanned_at: "not-number", payload: null, parse_error: null })).toBe(false);
        expect(isRepoCacheEntry({ repo: "r", updated_at: "d", scanned_at: 1, payload: "string", parse_error: null })).toBe(false);
        expect(isRepoCacheEntry({ repo: "r", updated_at: "d", scanned_at: 1, payload: null, parse_error: 123 })).toBe(false);
      });
    });
  });
});
