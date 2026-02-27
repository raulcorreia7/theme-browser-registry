import type { ThemeMode } from "@/lib/types";
import { AUTO_APPLY_MODE_CONFIDENCE, inferThemeMode, resolveModeHint } from "@/lib/mode";
import type { VariantModeResult } from "./types";

const CONFIDENCE = {
  FULL: 1.0,
  NONE: 0,
} as const;

const SOURCE = {
  PATTERN: "pattern",
  HINT: "hint",
  UNKNOWN: "unknown",
} as const;

export function detectVariantModeFromName(variantName: string): ThemeMode | undefined {
  const inference = inferThemeMode(variantName);
  if (!inference) return undefined;
  if (inference.confidence < AUTO_APPLY_MODE_CONFIDENCE) return undefined;
  return inference.mode;
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
    const inference = inferThemeMode(variant.name);
    if (!inference) {
      return { name: variant.name, confidence: CONFIDENCE.NONE, source: SOURCE.UNKNOWN };
    }

    if (inference.confidence < AUTO_APPLY_MODE_CONFIDENCE) {
      return {
        name: variant.name,
        confidence: inference.confidence,
        source: SOURCE.UNKNOWN,
        reason: `Low-confidence pattern match: ${inference.reason}`,
      };
    }

    return {
      name: variant.name,
      detectedMode: inference.mode,
      confidence: inference.confidence,
      source: SOURCE.PATTERN,
      reason: inference.reason,
    };
  });
}

export function applyVariantHints(
  results: VariantModeResult[],
  hints: Record<string, ThemeMode>,
): VariantModeResult[] {
  return results.map((result): VariantModeResult => {
    const hint = resolveModeHint(result.name, hints);
    if (!hint) return result;

    const reason = hint.normalizedMatch
      ? `Manual hint override (normalized match: ${hint.matchedKey})`
      : "Manual hint override";

    return {
      ...result,
      detectedMode: hint.mode,
      confidence: CONFIDENCE.FULL,
      source: SOURCE.HINT,
      reason,
    };
  });
}
