import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { LoadStrategy, ThemeMode } from "@/lib/types";

export interface ValidateOptions {
  input: string;
  themesDir?: string;
}

export interface ValidationMetrics {
  totalThemes: number;
  darkModeVariants: number;
  lightModeVariants: number;
  luaFiles: number;
  incompleteThemes: number;
  strategyCounts: Record<string, number>;
}

export interface ValidateResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  metrics: ValidationMetrics;
}

interface IncompleteTheme {
  name: string;
  missing: string;
}

interface OutputTheme {
  name: string;
  colorscheme?: string;
  repo?: string;
  mode?: ThemeMode;
  builtin?: boolean;
  strategy?: string;
  variants?: Array<{
    name: string;
    colorscheme?: string;
    mode?: ThemeMode;
  }>;
  meta?: {
    strategy?: { type?: LoadStrategy };
    mode?: ThemeMode;
  };
}

function getStrategy(theme: OutputTheme): LoadStrategy {
  const metaStrategy = theme.meta?.strategy?.type ?? (theme.strategy as LoadStrategy | undefined);
  if (metaStrategy) return metaStrategy;
  return "colorscheme";
}

function getLuaFiles(themesDir: string): Set<string> {
  if (!existsSync(themesDir)) return new Set();
  return new Set(
    readdirSync(themesDir)
      .filter((f) => f.endsWith(".lua"))
      .map((f) => basename(f, ".lua"))
  );
}

const REQUIRED_STRATEGIES: LoadStrategy[] = ["colorscheme", "setup", "load"];

export function run(options: ValidateOptions): ValidateResult {
  const { input, themesDir } = options;
  const errors: string[] = [];
  const warnings: string[] = [];
  const incompleteThemes: IncompleteTheme[] = [];

  if (!existsSync(input)) {
    return {
      passed: false,
      errors: [`themes.json not found at ${input}`],
      warnings: [],
      metrics: {
        totalThemes: 0,
        darkModeVariants: 0,
        lightModeVariants: 0,
        luaFiles: 0,
        incompleteThemes: 0,
        strategyCounts: {},
      },
    };
  }

  const raw = readFileSync(input, "utf-8");
  const themes: OutputTheme[] = JSON.parse(raw);
  const luaDir = themesDir || resolve(dirname(input), "..", "themes");
  const luaFiles = getLuaFiles(luaDir);

  const totalThemes = themes.length;
  if (totalThemes < 40) {
    errors.push(`Total themes (${totalThemes}) is less than 40`);
  }

  const strategyCounts: Record<string, number> = {
    colorscheme: 0,
    setup: 0,
    load: 0,
    file: 0,
  };
  let darkModeCount = 0;
  let lightModeCount = 0;
  let missingModeVariants = 0;

  for (const theme of themes) {
    const strategy = getStrategy(theme);
    if (strategy in strategyCounts) {
      strategyCounts[strategy] = (strategyCounts[strategy] ?? 0) + 1;
    }

    const requiredFields: string[] = ["name", "colorscheme"];
    if (!theme.builtin) {
      requiredFields.push("repo");
    }
    const missing = requiredFields.filter((f) => !theme[f as keyof OutputTheme]);
    if (missing.length > 0) {
      incompleteThemes.push({
        name: theme.name || "UNKNOWN",
        missing: missing.join(", "),
      });
    }

    const variants = theme.variants;
    if (variants && variants.length > 0) {
      for (const v of variants) {
        const vMode = v.mode;
        if (vMode === "dark") {
          darkModeCount++;
        } else if (vMode === "light") {
          lightModeCount++;
        } else {
          missingModeVariants++;
        }
      }
    } else if (theme.mode === "dark" || theme.meta?.mode === "dark") {
      darkModeCount++;
    } else if (theme.mode === "light" || theme.meta?.mode === "light") {
      lightModeCount++;
    }

    if (strategy === "file") {
      const themeName = theme.name;
      if (themeName && !luaFiles.has(themeName)) {
        errors.push(`File strategy theme "${themeName}" missing themes/${themeName}.lua`);
      }
    }
  }

  for (const s of REQUIRED_STRATEGIES) {
    const count = strategyCounts[s] ?? 0;
    if (count < 5) {
      errors.push(`Strategy "${s}" has only ${count} themes (need at least 5)`);
    }
  }

  if ((strategyCounts.file ?? 0) === 0) {
    warnings.push("No file strategy themes (optional)");
  }

  if (darkModeCount === 0) {
    errors.push("No dark mode themes found");
  }
  if (lightModeCount === 0) {
    warnings.push("No light mode themes found");
  }

  if (missingModeVariants > 0) {
    warnings.push(`${missingModeVariants} variants missing mode field`);
  }

  const metrics: ValidationMetrics = {
    totalThemes,
    darkModeVariants: darkModeCount,
    lightModeVariants: lightModeCount,
    luaFiles: luaFiles.size,
    incompleteThemes: incompleteThemes.length,
    strategyCounts,
  };

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    metrics,
  };
}
