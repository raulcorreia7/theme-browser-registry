import type { ThemeMode } from "@/lib/types";
import type { VariantModeResult } from "./types";

const DARK_SUFFIXES = [
  "dark",
  "night",
  "moon",
  "storm",
  "mocha",
  "frappe",
  "macchiato",
  "deep",
  "black",
  "shadow",
  "midnight",
  "abyss",
] as const;
const LIGHT_SUFFIXES = [
  "light",
  "day",
  "sun",
  "latte",
  "bright",
  "white",
  "paper",
  "cream",
  "morning",
] as const;

const RE_BASE16_LIGHT = /^base16-.+-light$/i;
const RE_BASE16_DARK = /^base16-(?!.*-light$).+$/i;

const CONFIDENCE = {
  HIGH: 0.9,
  FULL: 1.0,
  NONE: 0,
} as const;

const SOURCE = {
  PATTERN: "pattern",
  HINT: "hint",
  UNKNOWN: "unknown",
} as const;

function hasSuffix(name: string, suffixes: readonly string[]): boolean {
  for (const suffix of suffixes) {
    if (name.endsWith(suffix)) return true;
  }
  return false;
}

export function detectVariantModeFromName(variantName: string): ThemeMode | undefined {
  const lower = variantName.toLowerCase();

  if (RE_BASE16_LIGHT.test(variantName)) return "light";
  if (RE_BASE16_DARK.test(variantName)) return "dark";
  if (hasSuffix(lower, LIGHT_SUFFIXES)) return "light";
  if (hasSuffix(lower, DARK_SUFFIXES)) return "dark";

  return undefined;
}

export type VariantInput = {
  name: string;
  colorscheme?: string;
  mode?: ThemeMode | undefined;
  meta?: { strategy?: unknown };
};

export function detectVariantModesFromNames(
  variants: VariantInput[] | undefined,
): VariantModeResult[] {
  if (!variants || variants.length === 0) return [];

  return variants.map((variant): VariantModeResult => {
    const mode = detectVariantModeFromName(variant.name);
    if (!mode) {
      return { name: variant.name, confidence: CONFIDENCE.NONE, source: SOURCE.UNKNOWN };
    }
    return {
      name: variant.name,
      detectedMode: mode,
      confidence: CONFIDENCE.HIGH,
      source: SOURCE.PATTERN,
      reason: `Name matches ${mode}`,
    };
  });
}

export function applyVariantHints(
  results: VariantModeResult[],
  hints: Record<string, ThemeMode>,
): VariantModeResult[] {
  return results.map((result): VariantModeResult => {
    const hintedMode = hints[result.name];
    if (!hintedMode) return result;
    return {
      ...result,
      detectedMode: hintedMode,
      confidence: CONFIDENCE.FULL,
      source: SOURCE.HINT,
      reason: "Manual hint override",
    };
  });
}
