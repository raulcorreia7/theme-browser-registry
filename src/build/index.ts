import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ThemeEntry, ThemeMode, ThemeStrategy } from "@/lib/types";
import { mergeModeHintRecords, normalizeModeHintKey, resolveModeHint } from "@/lib/mode";
import { inferModeFromColorscheme, isValidThemeName, type ThemeWithMeta } from "./themes";

export * from "./themes";
export * from "./bundle";

export interface BuildOptions {
  index: string;
  overrides: string;
  output: string;
  minify?: boolean;
  preferredRepos?: string[];
}

export interface BuildResult {
  themes: number;
  variants: number;
  size: number;
  outputPath: string;
}

interface OutputVariant {
  name: string;
  variant?: string;
  colorscheme?: string;
  mode?: ThemeMode;
  modeExempt?: boolean;
  strategy?: string;
  module?: string;
}

interface OutputTheme {
  name: string;
  colorscheme?: string;
  repo?: string;
  stars?: number;
  mode?: ThemeMode | undefined;
  builtin?: boolean;
  strategy?: string;
  module?: string;
  variants?: OutputVariant[];
}

interface BuiltinLoadResult {
  builtin: ThemeEntry[];
  variantHints: Map<string, Record<string, ThemeMode>>;
  modeExemptHints: Map<string, string[]>;
}

type HintsFile = {
  hints?: Array<{
    repo?: string;
    variantModes?: Record<string, ThemeMode>;
    modeExemptVariants?: string[];
  }>;
};

type HintData = {
  variantHints: Map<string, Record<string, ThemeMode>>;
  modeExemptHints: Map<string, string[]>;
};

function hasModeExemptHint(variantName: string, hints: string[]): boolean {
  const normalizedName = normalizeModeHintKey(variantName);
  return hints.some((hintName) => normalizeModeHintKey(hintName) === normalizedName);
}

function loadHintData(hintsPath: string): HintData {
  if (!existsSync(hintsPath)) {
    return {
      variantHints: new Map(),
      modeExemptHints: new Map(),
    };
  }

  const hintsRaw = readFileSync(hintsPath, "utf-8");
  const hintsData = JSON.parse(hintsRaw) as HintsFile;
  const variantHints = new Map<string, Record<string, ThemeMode>>();
  const modeExemptHints = new Map<string, string[]>();

  if (!Array.isArray(hintsData.hints)) {
    return { variantHints, modeExemptHints };
  }

  for (const hint of hintsData.hints) {
    if (!hint.repo) continue;

    if (hint.variantModes) {
      const existing = variantHints.get(hint.repo) ?? {};
      const merged = mergeModeHintRecords(hint.repo, existing, hint.variantModes);
      variantHints.set(hint.repo, merged);
    }

    if (Array.isArray(hint.modeExemptVariants) && hint.modeExemptVariants.length > 0) {
      const existing = modeExemptHints.get(hint.repo) ?? [];
      const merged = Array.from(new Set([...existing, ...hint.modeExemptVariants]));
      modeExemptHints.set(hint.repo, merged);
    }
  }

  return { variantHints, modeExemptHints };
}

interface OverridesMaps {
  byRepo: Map<string | undefined, ThemeEntry>;
  byName: Map<string | undefined, ThemeEntry>;
}

function loadBuiltinThemes(overridesPath: string): BuiltinLoadResult {
  if (!existsSync(overridesPath)) {
    return { builtin: [], variantHints: new Map(), modeExemptHints: new Map() };
  }

  const raw = readFileSync(overridesPath, "utf-8");
  const data = JSON.parse(raw) as { builtin?: ThemeEntry[] };

  const variantHints = new Map<string, Record<string, ThemeMode>>();
  const modeExemptHints = new Map<string, string[]>();
  const hintsPath = resolve(dirname(overridesPath), "sources/hints.json");

  if (existsSync(hintsPath)) {
    try {
      const hintData = loadHintData(hintsPath);
      for (const [repo, repoHints] of hintData.variantHints) {
        variantHints.set(repo, repoHints);
      }
      for (const [repo, repoHints] of hintData.modeExemptHints) {
        modeExemptHints.set(repo, repoHints);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load variant hints: ${message}`);
    }
  }

  const builtin = Array.isArray(data.builtin)
    ? data.builtin.filter((t) => t && t.name && t.builtin === true)
    : [];

  return { builtin, variantHints, modeExemptHints };
}

function loadOverrides(overridesPath: string): OverridesMaps {
  if (!existsSync(overridesPath)) {
    return { byRepo: new Map(), byName: new Map() };
  }

  const raw = readFileSync(overridesPath, "utf-8");
  const data = JSON.parse(raw) as { overrides?: ThemeEntry[] };

  if (!Array.isArray(data.overrides)) {
    return { byRepo: new Map(), byName: new Map() };
  }

  const byRepo = new Map<string | undefined, ThemeEntry>();
  const byName = new Map<string | undefined, ThemeEntry>();

  for (const o of data.overrides) {
    byRepo.set(o.repo, o);
    byName.set(o.name, o);
  }

  return { byRepo, byName };
}

function buildOptimizedEntry(
  theme: ThemeWithMeta,
  override: ThemeEntry | undefined,
  variantHints: Map<string, Record<string, ThemeMode>>,
  modeExemptHints: Map<string, string[]>,
): OutputTheme {
  const entry: OutputTheme = {
    name: override?.name ?? theme.name,
    colorscheme: override?.colorscheme ?? theme.colorscheme,
  };

  if (override?.repo) {
    entry.repo = override.repo;
  } else if (theme.repo) {
    entry.repo = theme.repo;
  }
  if (override?.stars !== undefined) {
    entry.stars = override.stars;
  } else if (theme.stars) {
    entry.stars = theme.stars;
  }
  if (override?.meta?.mode) {
    entry.mode = override.meta.mode;
  } else if (theme.meta?.mode) {
    entry.mode = theme.meta.mode;
  }
  if (theme.builtin) entry.builtin = true;

  const strategy: ThemeStrategy | undefined = override?.meta?.strategy ?? theme.meta?.strategy;
  if (strategy?.type) {
    entry.strategy = strategy.type;
    if (strategy.module) entry.module = strategy.module;
  }

  const variants = Array.isArray(override?.variants) ? override?.variants : theme.variants;
  if (variants && variants.length > 0) {
    const hintsRepo = override?.repo ?? theme.repo;
    const hintsForRepo = hintsRepo ? variantHints.get(hintsRepo) : null;
    const modeExemptForRepo = hintsRepo ? modeExemptHints.get(hintsRepo) : null;

    entry.variants = variants.map((v): OutputVariant => {
      const variant: OutputVariant = {
        name: v.name,
        colorscheme: v.colorscheme,
      };
      if (v.variant) {
        variant.variant = v.variant;
      }

      const variantMode = v.mode;
      const hint =
        hintsForRepo &&
        (resolveModeHint(v.name, hintsForRepo) ||
          resolveModeHint(v.colorscheme ?? "", hintsForRepo));

      if (hint) {
        variant.mode = hint.mode;
      } else if (variantMode) {
        variant.mode = variantMode;
      } else {
        const inferred = inferModeFromColorscheme(v.colorscheme ?? v.name);
        if (inferred) variant.mode = inferred;
      }

      if (
        !variant.mode &&
        modeExemptForRepo &&
        (hasModeExemptHint(v.name, modeExemptForRepo) ||
          hasModeExemptHint(v.colorscheme ?? "", modeExemptForRepo))
      ) {
        variant.modeExempt = true;
      }

      if (v.meta?.strategy?.type) {
        variant.strategy = v.meta.strategy.type;
        if (v.meta.strategy.module) variant.module = v.meta.strategy.module;
      }

      return variant;
    });
  }

  return entry;
}

export function run(options: BuildOptions): BuildResult {
  const { index, overrides, output, minify = false, preferredRepos = [] } = options;

  const raw = readFileSync(index, "utf-8");
  const themes: ThemeWithMeta[] = JSON.parse(raw);

  const { byRepo: overridesMap, byName: overridesByName } = loadOverrides(overrides);
  const { builtin: builtinThemes, variantHints, modeExemptHints } = loadBuiltinThemes(overrides);
  const preferredRepoSet = new Set(
    preferredRepos
      .map((repo) => (typeof repo === "string" ? repo.trim().toLowerCase() : ""))
      .filter((repo) => repo.length > 0),
  );

  const themesByName = new Map<string, ThemeWithMeta>();

  for (const theme of themes) {
    if (!theme.name) continue;

    const nameLower = theme.name.toLowerCase();

    if (!isValidThemeName(theme.name)) {
      continue;
    }

    const existing = themesByName.get(nameLower);
    if (existing) {
      const existingIsPreferred =
        typeof existing.repo === "string" && preferredRepoSet.has(existing.repo.toLowerCase());
      const newIsPreferred =
        typeof theme.repo === "string" && preferredRepoSet.has(theme.repo.toLowerCase());
      const existingIsNeovim =
        existing.repo?.includes(".nvim") || existing.repo?.includes("neovim") || false;
      const newIsNeovim = theme.repo?.includes(".nvim") || theme.repo?.includes("neovim") || false;
      const existingStars = existing.stars ?? 0;
      const newStars = theme.stars ?? 0;
      const existingVariants = existing.variants?.length ?? 0;
      const newVariants = theme.variants?.length ?? 0;

      let newIsBetter = false;

      if (newIsPreferred && !existingIsPreferred) {
        newIsBetter = true;
      } else if (!newIsPreferred && existingIsPreferred) {
        newIsBetter = false;
      } else if (newIsNeovim && !existingIsNeovim) {
        newIsBetter = true;
      } else if (!newIsNeovim && existingIsNeovim) {
        newIsBetter = false;
      } else if (newStars > existingStars) {
        newIsBetter = true;
      } else if (newStars < existingStars) {
        newIsBetter = false;
      } else if (newVariants > existingVariants) {
        newIsBetter = true;
      } else {
        newIsBetter = false;
      }

      if (newIsBetter) {
        themesByName.set(nameLower, theme);
      }
    } else {
      themesByName.set(nameLower, theme);
    }
  }

  const curated: OutputTheme[] = [];

  for (const theme of themesByName.values()) {
    const override = theme.repo ? overridesMap.get(theme.repo) : overridesByName.get(theme.name);
    const entry = buildOptimizedEntry(theme, override, variantHints, modeExemptHints);
    curated.push(entry);
  }

  for (const builtin of builtinThemes) {
    const nameLower = builtin.name.toLowerCase();
    if (themesByName.has(nameLower)) continue;

    const entry: OutputTheme = {
      name: builtin.name,
      colorscheme: builtin.colorscheme,
      builtin: true,
    };

    if (builtin.stars !== undefined) entry.stars = builtin.stars;
    if (builtin.meta?.mode) entry.mode = builtin.meta.mode;
    if (builtin.meta?.strategy?.type) {
      entry.strategy = builtin.meta.strategy.type;
      if (builtin.meta.strategy.module) entry.module = builtin.meta.strategy.module;
    }

    curated.push(entry);
  }

  mkdirSync(dirname(output), { recursive: true });

  const jsonOutput = minify ? JSON.stringify(curated) : JSON.stringify(curated, null, 2) + "\n";

  writeFileSync(output, jsonOutput, "utf-8");

  return {
    themes: curated.length,
    variants: curated.reduce((sum, t) => sum + (t.variants?.length ?? 0), 0),
    size: jsonOutput.length,
    outputPath: output,
  };
}
