import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function resolveOverridesPathFromSourcesDir(sourcesDir: string): string {
  const localOverridesPath = resolve(sourcesDir, "overrides.json");
  if (existsSync(localOverridesPath)) {
    return localOverridesPath;
  }

  return resolve(sourcesDir, "../overrides.json");
}

export function resolveHintsPathFromOverridesPath(overridesPath: string): string {
  const overridesDir = dirname(overridesPath);
  const localHintsPath = resolve(overridesDir, "hints.json");
  if (existsSync(localHintsPath)) {
    return localHintsPath;
  }

  return resolve(overridesDir, "sources/hints.json");
}
