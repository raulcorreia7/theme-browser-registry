import type { ThemeEntry, ThemeMode } from "@/lib/types";

const DEFAULT_STRATEGY = "colorscheme";
const MIN_TOTAL_THEMES = 40;
const MIN_THEMES_PER_STRATEGY = 5;

const VALID_STRATEGIES = ["colorscheme", "setup", "load", "file"] as const;
const VALID_MODES = ["dark", "light"] as const;

type StrategyType = (typeof VALID_STRATEGIES)[number];

export type RegistryValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    byStrategy: Record<StrategyType, number>;
    byMode: Record<ThemeMode, number>;
    missingModeVariants: number;
  };
};

const STRATEGY_COUNTS: Record<StrategyType, number> = {
  colorscheme: 0,
  setup: 0,
  load: 0,
  file: 0,
};

const MODE_COUNTS: Record<ThemeMode, number> = {
  dark: 0,
  light: 0,
};

function isValidStrategy(value: string): value is StrategyType {
  return VALID_STRATEGIES.includes(value as StrategyType);
}

function isValidMode(value: string): value is ThemeMode {
  return VALID_MODES.includes(value as ThemeMode);
}

export function getThemeStrategy(theme: ThemeEntry): string {
  if (theme.meta?.strategy?.type) return theme.meta.strategy.type;
  if (theme.variants?.[0]?.meta?.strategy?.type) return theme.variants[0].meta.strategy.type;
  return DEFAULT_STRATEGY;
}

export function validateRegistry(themes: ThemeEntry[]): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const byStrategy: Record<StrategyType, number> = { ...STRATEGY_COUNTS };
  const byMode: Record<ThemeMode, number> = { ...MODE_COUNTS };
  let missingModeVariants = 0;

  const total = themes.length;

  if (total < MIN_TOTAL_THEMES) {
    errors.push(`Total themes (${total}) is less than ${MIN_TOTAL_THEMES}`);
  }

  for (const theme of themes) {
    const strategy = getThemeStrategy(theme);
    if (isValidStrategy(strategy)) {
      byStrategy[strategy] += 1;
    }

    const requiredFields = ["name", "colorscheme"];
    if (!theme.builtin) {
      requiredFields.push("repo");
    }

    for (const field of requiredFields) {
      const value = theme[field as keyof ThemeEntry];
      if (value === undefined || value === null || value === "") {
        errors.push(`${theme.name ?? "UNKNOWN"}: missing required field '${field}'`);
      }
    }

    if (theme.variants) {
      for (const variant of theme.variants) {
        if (!variant.mode) {
          missingModeVariants += 1;
        } else if (isValidMode(variant.mode)) {
          byMode[variant.mode] += 1;
        }
      }
    }
  }

  for (const [strategy, count] of Object.entries(byStrategy) as [StrategyType, number][]) {
    if (count < MIN_THEMES_PER_STRATEGY) {
      warnings.push(`Only ${count} themes with strategy '${strategy}' (recommended: >= ${MIN_THEMES_PER_STRATEGY})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      total,
      byStrategy,
      byMode,
      missingModeVariants,
    },
  };
}
