import { existsSync, readFileSync } from "node:fs";
import type { ThemeEntry, ThemeMeta, ThemeStrategy } from "../types/schemas.js";

type OverrideEntry = Partial<ThemeEntry> & { repo: string };

interface OverridesFile {
  overrides?: unknown;
  excluded?: unknown;
}

export interface LoadOverridesResult {
  overrides: OverrideEntry[];
  excluded: string[];
}

export function loadOverrides(path: string): LoadOverridesResult {
  if (!existsSync(path)) {
    return { overrides: [], excluded: [] };
  }

  const raw = JSON.parse(readFileSync(path, "utf-8"));
  if (typeof raw !== "object" || raw === null) {
    return { overrides: [], excluded: [] };
  }

  const data = raw as OverridesFile;

  const overrides: OverrideEntry[] = [];
  if (Array.isArray(data.overrides)) {
    for (const item of data.overrides) {
      if (item && typeof item === "object" && "repo" in item) {
        overrides.push(item as OverrideEntry);
      }
    }
  }

  const excluded: string[] = [];
  if (Array.isArray(data.excluded)) {
    for (const item of data.excluded) {
      if (typeof item === "string" && item.length > 0) {
        excluded.push(item);
      }
    }
  }

  return { overrides, excluded };
}

export function applyOverrides(
  entries: ThemeEntry[],
  overrides: OverrideEntry[],
  excluded: string[]
): ThemeEntry[] {
  const byRepo = new Map<string, ThemeEntry>();

  for (const entry of entries) {
    if (entry.repo) {
      byRepo.set(entry.repo, entry);
    }
  }

  for (const repo of excluded) {
    byRepo.delete(repo);
  }

  for (const override of overrides) {
    if (!override.repo) continue;

    const existing = byRepo.get(override.repo);
    const base: ThemeEntry = existing ?? {
      name: override.name ?? "",
      repo: override.repo,
      colorscheme: override.colorscheme ?? "",
    };

    byRepo.set(override.repo, mergeEntry(base, override));
  }

  return Array.from(byRepo.values());
}

function mergeEntry(base: ThemeEntry, override: Partial<ThemeEntry>): ThemeEntry {
  return {
    ...base,
    ...override,
    meta: override.meta 
      ? { ...base.meta, strategy: mergeStrategy(base.meta?.strategy, override.meta?.strategy) }
      : base.meta,
  };
}

function mergeStrategy(
  base?: ThemeStrategy, 
  override?: ThemeStrategy
): ThemeStrategy | undefined {
  if (!override) return base;
  if (!base) return override;
  
  return {
    ...base,
    ...override,
    vim: {
      ...base.vim,
      ...override.vim,
    },
  };
}
