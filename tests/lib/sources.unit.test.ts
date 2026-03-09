import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveHintsPathFromOverridesPath,
  resolveOverridesPathFromSourcesDir,
} from "../../src/lib/sources";

describe("lib/sources", () => {
  it("prefers a self-contained overrides file inside the sources directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "registry-sources-"));

    try {
      const sourcesDir = join(dir, "sources");
      const localOverridesPath = join(sourcesDir, "overrides.json");
      mkdirSync(sourcesDir, { recursive: true });
      writeFileSync(localOverridesPath, JSON.stringify({ overrides: [] }, null, 2));

      expect(resolveOverridesPathFromSourcesDir(sourcesDir)).toBe(localOverridesPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to the sibling overrides file for the default layout", () => {
    const dir = mkdtempSync(join(tmpdir(), "registry-sources-"));

    try {
      const sourcesDir = join(dir, "sources");
      const siblingOverridesPath = join(dir, "overrides.json");
      mkdirSync(sourcesDir, { recursive: true });
      writeFileSync(siblingOverridesPath, JSON.stringify({ overrides: [] }, null, 2));

      expect(resolveOverridesPathFromSourcesDir(sourcesDir)).toBe(siblingOverridesPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers hints beside a self-contained overrides file", () => {
    const dir = mkdtempSync(join(tmpdir(), "registry-sources-"));

    try {
      const sourcesDir = join(dir, "sources");
      const overridesPath = join(sourcesDir, "overrides.json");
      const hintsPath = join(sourcesDir, "hints.json");
      mkdirSync(sourcesDir, { recursive: true });
      writeFileSync(overridesPath, JSON.stringify({ overrides: [] }, null, 2));
      writeFileSync(hintsPath, JSON.stringify({ hints: [] }, null, 2));

      expect(resolveHintsPathFromOverridesPath(overridesPath)).toBe(hintsPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
