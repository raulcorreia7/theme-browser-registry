import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ThemeRegistrySchema,
  ManifestSchema,
  ThemeEntrySchema,
} from "../../src/types/schemas.js";

const ROOT = resolve(__dirname, "../../..");
const ARTIFACTS_DIR = resolve(ROOT, "theme-browser-registry-ts/artifacts");
const THEMES_PATH = resolve(ARTIFACTS_DIR, "themes.json");
const MANIFEST_PATH = resolve(ARTIFACTS_DIR, "manifest.json");

describe("Registry Pipeline E2E", () => {
  let themes: unknown[];
  let manifest: unknown;

  beforeAll(() => {
    if (existsSync(THEMES_PATH)) {
      themes = JSON.parse(readFileSync(THEMES_PATH, "utf-8"));
    }
    if (existsSync(MANIFEST_PATH)) {
      manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    }
  });

  describe("Artifacts Exist", () => {
    test("themes.json exists", () => {
      expect(existsSync(THEMES_PATH)).toBe(true);
    });

    test("manifest.json exists", () => {
      expect(existsSync(MANIFEST_PATH)).toBe(true);
    });
  });

  describe("Schema Validation", () => {
    test("themes.json validates against ThemeRegistrySchema", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const result = ThemeRegistrySchema.safeParse(themes);
      expect(result.success).toBe(true);
      if (!result.success) {
        console.error("Validation errors:", result.error.issues.slice(0, 5));
      }
    });

    test("manifest.json validates against ManifestSchema", () => {
      if (!manifest) {
        expect.fail("manifest.json not found - run pipeline first");
      }
      const result = ManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
      if (!result.success) {
        console.error("Validation errors:", result.error.issues);
      }
    });
  });

  describe("Data Integrity", () => {
    test("manifest count matches themes.json length", () => {
      if (!themes || !manifest) {
        expect.fail("Artifacts not found - run pipeline first");
      }
      const m = manifest as { count: number };
      expect(m.count).toBe(themes.length);
    });

    test("manifest has version field", () => {
      if (!manifest) {
        expect.fail("manifest.json not found - run pipeline first");
      }
      const m = manifest as { version?: string };
      expect(m.version).toBeDefined();
      expect(typeof m.version).toBe("string");
    });

    test("manifest has sha256 hash", () => {
      if (!manifest) {
        expect.fail("manifest.json not found - run pipeline first");
      }
      const m = manifest as { sha256?: string };
      expect(m.sha256).toBeDefined();
      expect(typeof m.sha256).toBe("string");
      expect(m.sha256).toHaveLength(64);
    });

    test("all themes have required fields", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const missing: string[] = [];
      for (const t of themes as unknown[]) {
        const theme = t as Record<string, unknown>;
        if (!theme.name) missing.push("missing name");
        if (!theme.repo && !theme.builtin) missing.push(`${theme.name}: missing repo`);
        if (!theme.colorscheme) missing.push(`${theme.name}: missing colorscheme`);
      }
      expect(missing).toHaveLength(0);
    });

    test("all themes validate against ThemeEntrySchema", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const invalid: string[] = [];
      for (const t of themes as unknown[]) {
        const result = ThemeEntrySchema.safeParse(t);
        if (!result.success) {
          const theme = t as Record<string, unknown>;
          invalid.push(`${theme.name || "unknown"}: ${result.error.issues[0]?.message}`);
        }
      }
      expect(invalid).toHaveLength(0);
    });
  });

  describe("Uniqueness", () => {
    test("no duplicate theme names (case-insensitive)", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const names = (themes as Record<string, unknown>[]).map((t) =>
        String(t.name).toLowerCase()
      );
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });

    test("no duplicate repo names", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const repos = (themes as Record<string, unknown>[])
        .filter((t) => t.repo)
        .map((t) => t.repo);
      const unique = new Set(repos);
      expect(unique.size).toBe(repos.length);
    });
  });

  describe("Variant Modes", () => {
    test("most variants have mode field (alpha: allow up to 20 missing)", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const missing: string[] = [];
      for (const t of themes as Record<string, unknown>[]) {
        const theme = t as Record<string, unknown>;
        if (theme.variants && Array.isArray(theme.variants)) {
          for (const v of theme.variants as Record<string, unknown>[]) {
            if (!v.mode) {
              missing.push(`${theme.name}/${v.name}`);
            }
          }
        }
      }
      if (missing.length > 20) {
        console.log(`Missing mode for ${missing.length} variants:`, missing.slice(0, 10));
      }
      expect(missing.length).toBeLessThanOrEqual(20);
    });
  });

  describe("Theme Quality", () => {
    test("top themes have valid star counts", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const themesList = themes as Record<string, unknown>[];
      const topThemes = themesList.slice(0, 10);
      for (const theme of topThemes) {
        if (theme.stars !== undefined) {
          expect(typeof theme.stars).toBe("number");
          expect((theme.stars as number)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test("all themes have valid repo format (owner/name)", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const invalid: string[] = [];
      const repoPattern = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/;
      for (const t of themes as Record<string, unknown>[]) {
        if (t.repo && typeof t.repo === "string" && !repoPattern.test(t.repo)) {
          invalid.push(`${t.name}: ${t.repo}`);
        }
      }
      expect(invalid).toHaveLength(0);
    });

    test("strategy types are valid", () => {
      if (!themes) {
        expect.fail("themes.json not found - run pipeline first");
      }
      const validStrategies = ["colorscheme", "setup", "load", "file"];
      const invalid: string[] = [];
      for (const t of themes as Record<string, unknown>[]) {
        const theme = t as Record<string, unknown>;
        const meta = theme.meta as Record<string, unknown> | undefined;
        if (meta?.strategy) {
          const strategy = meta.strategy as Record<string, unknown>;
          if (strategy.type && !validStrategies.includes(strategy.type as string)) {
            invalid.push(`${theme.name}: ${strategy.type}`);
          }
        }
      }
      expect(invalid).toHaveLength(0);
    });
  });
});
