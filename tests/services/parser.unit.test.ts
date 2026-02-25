import { describe, it, expect } from "vitest";
import {
  normalizeThemeName,
  extractColorschemes,
  buildEntry,
} from "../../src/services/parser.js";
import type { GitHubRepoItem, GitHubTreeItem } from "../../src/types/schemas.js";

function makeRepoItem(overrides: Partial<GitHubRepoItem> = {}): GitHubRepoItem {
  return {
    id: 123,
    full_name: "owner/repo",
    description: "A theme",
    stargazers_count: 100,
    topics: ["neovim"],
    updated_at: "2024-01-01T00:00:00Z",
    archived: false,
    disabled: false,
    html_url: "https://github.com/owner/repo",
    ...overrides,
  };
}

function makeTreeItem(path: string, type: "blob" | "tree" | "commit" = "blob"): GitHubTreeItem {
  return {
    path,
    mode: "100644",
    type,
    sha: "abc123",
    url: "https://api.github.com/...",
  };
}

describe("parser", () => {
  describe("normalizeThemeName", () => {
    it("extracts repo name from owner/repo format", () => {
      expect(normalizeThemeName("folke/tokyonight.nvim")).toBe("tokyonight");
    });

    it("handles plain repo name without owner", () => {
      expect(normalizeThemeName("mytheme")).toBe("mytheme");
    });

    it("strips .nvim suffix (but falls back to owner if result is 'theme')", () => {
      expect(normalizeThemeName("owner/theme.nvim")).toBe("owner");
    });

    it("strips .vim suffix", () => {
      expect(normalizeThemeName("owner/gruvbox.vim")).toBe("gruvbox");
    });

    it("strips .lua suffix", () => {
      expect(normalizeThemeName("owner/tokyonight.lua")).toBe("tokyonight");
    });

    it("strips -nvim suffix", () => {
      expect(normalizeThemeName("owner/catppuccin-nvim")).toBe("catppuccin");
    });

    it("strips _nvim suffix", () => {
      expect(normalizeThemeName("owner/catppuccin_nvim")).toBe("catppuccin");
    });

    it("strips -colorscheme suffix", () => {
      expect(normalizeThemeName("owner/awesome-colorscheme")).toBe("awesome");
    });

    it("falls back to owner when repo name is invalid", () => {
      expect(normalizeThemeName("nvim-theme/nvim")).toBe("nvim-theme");
    });

    it("returns owner as fallback when both owner and repo are invalid", () => {
      expect(normalizeThemeName("nvim/nvim")).toBe("nvim");
    });

    it("normalizes to lowercase", () => {
      expect(normalizeThemeName("Owner/TokyoNight")).toBe("tokyonight");
    });

    it("strips leading and trailing dashes/underscores", () => {
      expect(normalizeThemeName("owner/-my-theme-_")).toBe("my-theme");
    });

    it("does not strip suffix if it would make name empty", () => {
      expect(normalizeThemeName("owner/.nvim")).toBe(".nvim");
    });
  });

  describe("extractColorschemes", () => {
    it("extracts colorschemes from colors/*.vim files", () => {
      const items = [
        makeTreeItem("colors/tokyonight.vim"),
        makeTreeItem("colors/nightfox.vim"),
      ];
      expect(extractColorschemes(items)).toEqual(["nightfox", "tokyonight"]);
    });

    it("extracts colorschemes from colors/*.lua files", () => {
      const items = [
        makeTreeItem("colors/catppuccin.lua"),
        makeTreeItem("colors/gruvbox.lua"),
      ];
      expect(extractColorschemes(items)).toEqual(["catppuccin", "gruvbox"]);
    });

    it("handles mixed vim and lua files", () => {
      const items = [
        makeTreeItem("colors/theme.vim"),
        makeTreeItem("colors/theme.lua"),
      ];
      expect(extractColorschemes(items)).toEqual(["theme"]);
    });

    it("ignores non-colors paths", () => {
      const items = [
        makeTreeItem("lua/theme/init.lua"),
        makeTreeItem("plugin/theme.vim"),
        makeTreeItem("colors/dark.vim"),
      ];
      expect(extractColorschemes(items)).toEqual(["dark"]);
    });

    it("ignores tree and commit types", () => {
      const items = [
        makeTreeItem("colors", "tree"),
        makeTreeItem("colors/dark.vim"),
      ];
      expect(extractColorschemes(items)).toEqual(["dark"]);
    });

    it("ignores nested paths in colors", () => {
      const items = [
        makeTreeItem("colors/dark/variant.vim"),
        makeTreeItem("colors/light.lua"),
      ];
      expect(extractColorschemes(items)).toEqual(["light"]);
    });

    it("returns sorted results", () => {
      const items = [
        makeTreeItem("colors/zebra.vim"),
        makeTreeItem("colors/apple.vim"),
        makeTreeItem("colors/mango.vim"),
      ];
      expect(extractColorschemes(items)).toEqual(["apple", "mango", "zebra"]);
    });

    it("returns empty array for no matches", () => {
      expect(extractColorschemes([])).toEqual([]);
      expect(extractColorschemes([makeTreeItem("lua/init.lua")])).toEqual([]);
    });

    it("handles empty colorscheme names gracefully", () => {
      const items = [
        makeTreeItem("colors/.vim"),
        makeTreeItem("colors/valid.vim"),
      ];
      expect(extractColorschemes(items)).toEqual(["valid"]);
    });
  });

  describe("buildEntry", () => {
    it("creates entry from repo payload", () => {
      const repo = makeRepoItem({ full_name: "folke/tokyonight.nvim" });
      const entry = buildEntry(repo, ["tokyonight"]);
      expect(entry.name).toBe("tokyonight");
      expect(entry.repo).toBe("folke/tokyonight.nvim");
      expect(entry.colorscheme).toBe("tokyonight");
      expect(entry.stars).toBe(100);
    });

    it("picks matching colorscheme as base", () => {
      const repo = makeRepoItem({ full_name: "owner/mytheme" });
      const entry = buildEntry(repo, ["other", "mytheme", "variant"]);
      expect(entry.colorscheme).toBe("mytheme");
    });

    it("picks matching colorscheme with different separators (first match wins)", () => {
      const repo = makeRepoItem({ full_name: "owner/my-theme" });
      const entry = buildEntry(repo, ["my_theme", "my-theme"]);
      expect(entry.colorscheme).toBe("my_theme");
    });

    it("picks colorscheme without separators as base", () => {
      const repo = makeRepoItem({ full_name: "owner/mytheme" });
      const entry = buildEntry(repo, ["my-theme", "my_theme", "simple"]);
      expect(entry.colorscheme).toBe("simple");
    });

    it("picks first colorscheme as fallback", () => {
      const repo = makeRepoItem({ full_name: "owner/mytheme" });
      const entry = buildEntry(repo, ["a-theme", "b-theme"]);
      expect(entry.colorscheme).toBe("a-theme");
    });

    it("uses theme name when no colorschemes", () => {
      const repo = makeRepoItem({ full_name: "owner/mytheme" });
      const entry = buildEntry(repo, []);
      expect(entry.colorscheme).toBe("mytheme");
    });

    it("adds variants for extra colorschemes", () => {
      const repo = makeRepoItem({ full_name: "owner/mytheme" });
      const entry = buildEntry(repo, ["mytheme", "dark", "light"]);
      expect(entry.variants).toHaveLength(2);
      expect(entry.variants?.map((v) => v.name)).toEqual(["dark", "light"]);
    });

    it("omits variants when only base colorscheme", () => {
      const repo = makeRepoItem({ full_name: "owner/mytheme" });
      const entry = buildEntry(repo, ["mytheme"]);
      expect(entry.variants).toBeUndefined();
    });

    it("throws for invalid payload (missing full_name)", () => {
      const repo = { ...makeRepoItem(), full_name: "" };
      expect(() => buildEntry(repo, [])).toThrow("invalid repository payload");
    });

    it("throws for invalid payload (no slash)", () => {
      const repo = { ...makeRepoItem(), full_name: "noSlashHere" };
      expect(() => buildEntry(repo, [])).toThrow("invalid repository payload");
    });

    it("handles null description", () => {
      const repo = makeRepoItem({ description: null });
      const entry = buildEntry(repo, []);
      expect(entry.description).toBe("");
    });

    it("filters non-string topics", () => {
      const repo = makeRepoItem({ topics: ["valid", 123, null, "also-valid"] as string[] });
      const entry = buildEntry(repo, []);
      expect(entry.topics).toEqual(["valid", "also-valid"]);
    });

    it("handles missing topics array", () => {
      const repo = { ...makeRepoItem(), topics: undefined };
      const entry = buildEntry(repo, []);
      expect(entry.topics).toEqual([]);
    });
  });
});