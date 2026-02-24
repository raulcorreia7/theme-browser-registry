import * as fs from "node:fs";
import type { ThemeEntry, ThemeMeta, ThemeVariant } from "./types.js";

type OverrideEntry = Partial<ThemeEntry> & { repo: string };

interface OverridesFile {
  overrides?: unknown;
  excluded?: unknown;
}

function deepMerge(base: ThemeEntry, override: Partial<ThemeEntry>): ThemeEntry {
  const merged: ThemeEntry = { ...base };

  if (override.name !== undefined) merged.name = override.name;
  if (override.repo !== undefined) merged.repo = override.repo;
  if (override.colorscheme !== undefined) merged.colorscheme = override.colorscheme;
  if (override.description !== undefined) merged.description = override.description;
  if (override.stars !== undefined) merged.stars = override.stars;
  if (override.topics !== undefined) merged.topics = override.topics;
  if (override.updated_at !== undefined) merged.updated_at = override.updated_at;
  if (override.archived !== undefined) merged.archived = override.archived;
  if (override.disabled !== undefined) merged.disabled = override.disabled;
  if (override.homepage !== undefined) merged.homepage = override.homepage;

  if (override.meta !== undefined) {
    merged.meta = { ...(merged.meta ?? {}), ...override.meta } as ThemeMeta;
  }

  if (override.variants !== undefined) {
    merged.variants = override.variants;
  }

  return merged;
}

export interface LoadOverridesResult {
  overrides: OverrideEntry[];
  excluded: string[];
}

export function loadOverrides(path: string): LoadOverridesResult {
  if (!fs.existsSync(path)) {
    return { overrides: [], excluded: [] };
  }

  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  if (typeof raw !== "object" || raw === null) {
    return { overrides: [], excluded: [] };
  }

  const data = raw as OverridesFile;
  const overridesRaw = data.overrides;
  const excludedRaw = data.excluded;

  const overrides: OverrideEntry[] = [];
  if (Array.isArray(overridesRaw)) {
    for (const item of overridesRaw) {
      if (item !== null && typeof item === "object" && "repo" in item) {
        overrides.push(item as OverrideEntry);
      }
    }
  }

  const excluded: string[] = [];
  if (Array.isArray(excludedRaw)) {
    for (const item of excludedRaw) {
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
    if (!override.repo) {
      continue;
    }
    const existing = byRepo.get(override.repo);
    const base: ThemeEntry = existing ?? {
      name: override.name ?? "",
      repo: override.repo,
      colorscheme: override.colorscheme ?? "",
    };
    byRepo.set(override.repo, deepMerge(base, override));
  }

  return Array.from(byRepo.values());
}
