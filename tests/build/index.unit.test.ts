import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run as runBuild } from "../../src/build";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

describe("build/index", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("prefers configured include repos when names collide", () => {
    const dir = mkdtempSync(join(tmpdir(), "registry-build-"));
    tempDirs.push(dir);

    const indexPath = join(dir, "index.json");
    const overridesPath = join(dir, "overrides.json");
    const outputPath = join(dir, "themes.json");

    writeJson(indexPath, [
      {
        name: "eldritch",
        repo: "eldritch-theme/eldritch.nvim",
        colorscheme: "eldritch",
        stars: 200,
      },
      {
        name: "eldritch",
        repo: "raulcorreia7/eldritch.nvim",
        colorscheme: "eldritch",
        stars: 3,
      },
    ]);
    writeJson(overridesPath, { overrides: [] });

    runBuild({
      index: indexPath,
      overrides: overridesPath,
      output: outputPath,
      preferredRepos: ["raulcorreia7/eldritch.nvim"],
    });

    const built = JSON.parse(readFileSync(outputPath, "utf8")) as Array<{ repo?: string }>;
    expect(built[0]?.repo).toBe("raulcorreia7/eldritch.nvim");
  });

  it("applies override variants and colorscheme in output", () => {
    const dir = mkdtempSync(join(tmpdir(), "registry-build-"));
    tempDirs.push(dir);

    const indexPath = join(dir, "index.json");
    const overridesPath = join(dir, "overrides.json");
    const outputPath = join(dir, "themes.json");

    writeJson(indexPath, [
      {
        name: "eldritch",
        repo: "raulcorreia7/eldritch.nvim",
        colorscheme: "eldritch",
        variants: [{ name: "legacy", colorscheme: "legacy" }],
      },
    ]);

    writeJson(overridesPath, {
      overrides: [
        {
          name: "eldritch",
          repo: "raulcorreia7/eldritch.nvim",
          colorscheme: "eldritch",
          variants: [
            { name: "eldritch", colorscheme: "eldritch", mode: "dark" },
            {
              name: "kanagawa + azure",
              variant: "eldritch-kanagawa-azure",
              colorscheme: "eldritch-kanagawa-azure",
              mode: "dark",
            },
          ],
        },
      ],
    });

    runBuild({
      index: indexPath,
      overrides: overridesPath,
      output: outputPath,
      preferredRepos: ["raulcorreia7/eldritch.nvim"],
    });

    const built = JSON.parse(readFileSync(outputPath, "utf8")) as Array<{
      colorscheme?: string;
      variants?: Array<{ name?: string; variant?: string; colorscheme?: string }>;
    }>;
    expect(built[0]?.colorscheme).toBe("eldritch");
    expect(built[0]?.variants).toHaveLength(2);
    expect(built[0]?.variants?.[1]?.name).toBe("kanagawa + azure");
    expect(built[0]?.variants?.[1]?.variant).toBe("eldritch-kanagawa-azure");
    expect(built[0]?.variants?.[1]?.colorscheme).toBe("eldritch-kanagawa-azure");
  });

  it("applies variant mode hints and mode exemptions from source hints", () => {
    const dir = mkdtempSync(join(tmpdir(), "registry-build-"));
    tempDirs.push(dir);

    const indexPath = join(dir, "index.json");
    const overridesPath = join(dir, "overrides.json");
    const outputPath = join(dir, "themes.json");
    const sourcesDir = join(dir, "sources");
    const hintsPath = join(sourcesDir, "hints.json");

    writeJson(indexPath, [
      {
        name: "example-theme",
        repo: "example/theme.nvim",
        colorscheme: "example-theme",
        variants: [
          { name: "example-theme-rise", colorscheme: "example-theme-rise" },
          { name: "example-theme-adaptive", colorscheme: "example-theme-adaptive" },
        ],
      },
    ]);

    writeJson(overridesPath, { overrides: [] });
    mkdirSync(sourcesDir, { recursive: true });
    writeFileSync(
      hintsPath,
      JSON.stringify(
        {
          hints: [
            {
              repo: "example/theme.nvim",
              variantModes: {
                "example-theme-rise": "light",
              },
              modeExemptVariants: ["example-theme-adaptive"],
            },
          ],
        },
        null,
        2,
      ),
    );

    runBuild({
      index: indexPath,
      overrides: overridesPath,
      output: outputPath,
    });

    const built = JSON.parse(readFileSync(outputPath, "utf8")) as Array<{
      variants?: Array<{
        name?: string;
        colorscheme?: string;
        mode?: string;
        modeExempt?: boolean;
      }>;
    }>;
    expect(built[0]?.variants).toEqual([
      { name: "example-theme-rise", colorscheme: "example-theme-rise", mode: "light" },
      { name: "example-theme-adaptive", colorscheme: "example-theme-adaptive", modeExempt: true },
    ]);
  });
});
