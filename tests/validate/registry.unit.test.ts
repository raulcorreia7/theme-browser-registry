import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run as runValidate } from "../../src/validate";

describe("validate/registry", () => {
  it("does not warn for reviewed mode-exempt variants", () => {
    const dir = mkdtempSync(join(tmpdir(), "registry-validate-"));

    try {
      const inputPath = join(dir, "themes.json");
      const themes = Array.from({ length: 5 }, (_, index) => ({
        name: `theme-colorscheme-${index}`,
        repo: `example/theme-colorscheme-${index}`,
        colorscheme: `theme-colorscheme-${index}`,
        strategy: "colorscheme",
        variants: [
          { name: `theme-colorscheme-${index}-core`, colorscheme: `theme-colorscheme-${index}-core`, mode: "dark" },
          {
            name: `theme-colorscheme-${index}-adaptive`,
            colorscheme: `theme-colorscheme-${index}-adaptive`,
            modeExempt: true,
          },
        ],
      }))
        .concat(
          Array.from({ length: 5 }, (_, index) => ({
            name: `theme-setup-${index}`,
            repo: `example/theme-setup-${index}`,
            colorscheme: `theme-setup-${index}`,
            strategy: "setup",
            variants: [{ name: `theme-setup-${index}-core`, colorscheme: `theme-setup-${index}-core`, mode: "light" }],
          })),
        )
        .concat(
          Array.from({ length: 5 }, (_, index) => ({
            name: `theme-load-${index}`,
            repo: `example/theme-load-${index}`,
            colorscheme: `theme-load-${index}`,
            strategy: "load",
            variants: [{ name: `theme-load-${index}-core`, colorscheme: `theme-load-${index}-core`, mode: "dark" }],
          })),
        );

      writeFileSync(
        inputPath,
        JSON.stringify(themes, null, 2),
      );

      const result = runValidate({ input: inputPath });
      expect(result.errors).toContain("Total themes (15) is less than 40");
      expect(result.warnings).not.toContain("1 variants missing mode field");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
