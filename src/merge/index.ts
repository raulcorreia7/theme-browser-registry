export * from "@/merge/apply";

import { readdirSync } from "node:fs";
import path from "node:path";
import { readJson, writeJson, pathExists } from "@/lib/io";
import type { ThemeEntry, LoadStrategy } from "@/lib/types";

export interface MergeOptions {
  sourcesDir: string;
  outputPath: string;
}

export interface MergeResult {
  themes: number;
  builtin: number;
  outputPath: string;
}

type StrategyFile = {
  strategy: LoadStrategy | "builtin";
  count: number;
  themes: ThemeEntry[];
};

type Hint = {
  repo: string;
  strategy: LoadStrategy;
  reason: string;
};

type HintsFile = {
  description: string;
  hints: Hint[];
};

export function run(options: MergeOptions): MergeResult {
  const allThemes: ThemeEntry[] = [];
  const builtin: ThemeEntry[] = [];

  const files = readdirSync(options.sourcesDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    if (file === "hints.json") continue;

    const filePath = path.join(options.sourcesDir, file);
    if (!pathExists(filePath)) continue;

    const data = readJson<StrategyFile | { themes: ThemeEntry[] }>(filePath);

    if (data && "strategy" in data) {
      if (data.strategy === "builtin") {
        builtin.push(...data.themes);
      } else {
        allThemes.push(...data.themes);
      }
    }
  }

  const hintsPath = path.join(options.sourcesDir, "hints.json");
  if (pathExists(hintsPath)) {
    const hints = readJson<HintsFile>(hintsPath);
    if (hints?.hints) {
      const hintMap = new Map(hints.hints.map((h) => [h.repo, h.strategy]));
      for (const theme of allThemes) {
        if (theme.repo && hintMap.has(theme.repo)) {
          if (!theme.meta) theme.meta = {};
          if (!theme.meta.strategy) theme.meta.strategy = { type: hintMap.get(theme.repo)! };
          else theme.meta.strategy.type = hintMap.get(theme.repo)!;
        }
      }
    }
  }

  allThemes.sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()),
  );
  builtin.sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));

  const merged = {
    overrides: allThemes,
    ...(builtin.length > 0 && { builtin }),
  };

  writeJson(options.outputPath, merged);

  return {
    themes: allThemes.length,
    builtin: builtin.length,
    outputPath: options.outputPath,
  };
}
