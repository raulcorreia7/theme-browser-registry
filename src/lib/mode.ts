import type { ThemeMode } from "@/lib/types";

export const AUTO_APPLY_MODE_CONFIDENCE = 0.9;

type ConfidenceLevel = "high" | "medium" | "low";

type TokenWeight = {
  token: string;
  weight: number;
};

export type ModeInference = {
  mode: ThemeMode;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  reason: string;
};

export type ModeHintResolution = {
  mode: ThemeMode;
  matchedKey: string;
  normalizedMatch: boolean;
};

const RE_BASE16_LIGHT = /^base16-.+-light$/i;
const RE_BASE16_DARK = /^base16-(?!.*-light$).+$/i;

const RE_TRAILING_STYLE_MODIFIER =
  /[-_](bold|italic|dim|dimmed|soft|hard|mono|minimal|default|main|opaque|transparent|contrast|highcontrast)$/;

const LIGHT_TOKENS: readonly TokenWeight[] = [
  { token: "light", weight: 3 },
  { token: "day", weight: 3 },
  { token: "dawn", weight: 3 },
  { token: "operandi", weight: 3 },
  { token: "latte", weight: 3 },
  { token: "sun", weight: 3 },
  { token: "morning", weight: 2 },
  { token: "white", weight: 2 },
  { token: "paper", weight: 2 },
  { token: "cream", weight: 2 },
  { token: "snow", weight: 2 },
  { token: "lumi", weight: 1 },
  { token: "bright", weight: 1 },
] as const;

const DARK_TOKENS: readonly TokenWeight[] = [
  { token: "dark", weight: 3 },
  { token: "night", weight: 3 },
  { token: "vivendi", weight: 3 },
  { token: "moon", weight: 3 },
  { token: "storm", weight: 3 },
  { token: "mocha", weight: 3 },
  { token: "frappe", weight: 3 },
  { token: "macchiato", weight: 3 },
  { token: "shadow", weight: 2 },
  { token: "midnight", weight: 2 },
  { token: "abyss", weight: 2 },
  { token: "dusk", weight: 2 },
  { token: "deep", weight: 1 },
  { token: "black", weight: 1 },
  { token: "dragon", weight: 1 },
  { token: "wave", weight: 1 },
  { token: "ember", weight: 1 },
  { token: "fog", weight: 1 },
  { token: "moss", weight: 1 },
] as const;

const COMPACT_LIGHT_EXCLUSIONS = new Set([
  "twilight",
  "starlight",
  "moonlight",
  "spotlight",
  "limelight",
  "highlight",
] as const);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function stripTrailingStyleModifiers(value: string): string {
  let output = value;
  while (RE_TRAILING_STYLE_MODIFIER.test(output)) {
    output = output.replace(RE_TRAILING_STYLE_MODIFIER, "");
  }
  return output;
}

function hasBoundaryToken(text: string, token: string): boolean {
  return new RegExp(`(^|[-_])${escapeRegex(token)}($|[-_])`, "i").test(text);
}

function hasTerminalBoundaryToken(text: string, token: string): boolean {
  return new RegExp(`(^|[-_])${escapeRegex(token)}$`, "i").test(text);
}

function hasCompactTerminalLight(text: string): boolean {
  if (!text.endsWith("light")) return false;
  if (text.endsWith("-light") || text.endsWith("_light")) return false;
  for (const excluded of COMPACT_LIGHT_EXCLUSIONS) {
    if (text.endsWith(excluded)) return false;
  }
  return true;
}

function hasCompactTerminalDark(text: string): boolean {
  if (!text.endsWith("dark")) return false;
  if (text.endsWith("-dark") || text.endsWith("_dark")) return false;
  return true;
}

function scoreTokens(
  text: string,
  tokens: readonly TokenWeight[],
): { score: number; strongestTerminal: number; labels: string[] } {
  let score = 0;
  let strongestTerminal = 0;
  const labels: string[] = [];

  for (const { token, weight } of tokens) {
    if (!hasBoundaryToken(text, token)) continue;
    score += weight;
    labels.push(token);
    if (hasTerminalBoundaryToken(text, token)) {
      strongestTerminal = Math.max(strongestTerminal, weight);
    }
  }

  return { score, strongestTerminal, labels };
}

function confidenceFromScores(
  dominant: number,
  runnerUp: number,
): { value: number; level: ConfidenceLevel } {
  const delta = dominant - runnerUp;
  if (dominant >= 3 && delta >= 2) {
    return { value: 0.95, level: "high" };
  }
  if (dominant >= 2 && delta >= 1) {
    return { value: 0.8, level: "medium" };
  }
  return { value: 0.65, level: "low" };
}

export function inferThemeMode(name: string | undefined): ModeInference | undefined {
  if (!name) return undefined;

  const normalized = normalizeName(name);
  if (!normalized) return undefined;

  if (RE_BASE16_LIGHT.test(normalized)) {
    return {
      mode: "light",
      confidence: 1,
      confidenceLevel: "high",
      reason: "Base16 light variant pattern",
    };
  }

  if (RE_BASE16_DARK.test(normalized)) {
    return {
      mode: "dark",
      confidence: 0.95,
      confidenceLevel: "high",
      reason: "Base16 dark variant pattern",
    };
  }

  const stripped = stripTrailingStyleModifiers(normalized);
  const light = scoreTokens(stripped, LIGHT_TOKENS);
  const dark = scoreTokens(stripped, DARK_TOKENS);

  if (hasCompactTerminalLight(stripped)) {
    light.score += 2;
    light.strongestTerminal = Math.max(light.strongestTerminal, 2);
    light.labels.push("light(compact)");
  }

  if (hasCompactTerminalDark(stripped)) {
    dark.score += 2;
    dark.strongestTerminal = Math.max(dark.strongestTerminal, 2);
    dark.labels.push("dark(compact)");
  }

  if (light.score === 0 && dark.score === 0) {
    return undefined;
  }

  if (light.score > 0 && dark.score > 0) {
    const terminalDelta = light.strongestTerminal - dark.strongestTerminal;
    if (terminalDelta >= 2) {
      const confidence = confidenceFromScores(light.score, dark.score);
      return {
        mode: "light",
        confidence: confidence.value,
        confidenceLevel: confidence.level,
        reason: `Light tokens dominate (${light.labels.join(", ")})`,
      };
    }
    if (terminalDelta <= -2) {
      const confidence = confidenceFromScores(dark.score, light.score);
      return {
        mode: "dark",
        confidence: confidence.value,
        confidenceLevel: confidence.level,
        reason: `Dark tokens dominate (${dark.labels.join(", ")})`,
      };
    }
    return undefined;
  }

  const mode: ThemeMode = light.score > dark.score ? "light" : "dark";
  const dominant = mode === "light" ? light : dark;
  const runnerUp = mode === "light" ? dark.score : light.score;
  const confidence = confidenceFromScores(dominant.score, runnerUp);

  return {
    mode,
    confidence: confidence.value,
    confidenceLevel: confidence.level,
    reason: `${mode === "light" ? "Light" : "Dark"} tokens matched (${dominant.labels.join(", ")})`,
  };
}

export function normalizeModeHintKey(name: string): string {
  return normalizeName(name).replace(/[^a-z0-9]/g, "");
}

export function mergeModeHintRecords(
  repo: string,
  existing: Record<string, ThemeMode>,
  incoming: Record<string, ThemeMode>,
): Record<string, ThemeMode> {
  const merged = { ...existing };
  const index = new Map<string, string>();

  for (const key of Object.keys(merged)) {
    index.set(normalizeModeHintKey(key), key);
  }

  for (const [key, mode] of Object.entries(incoming)) {
    const normalized = normalizeModeHintKey(key);
    const existingKey = index.get(normalized);
    if (!existingKey) {
      merged[key] = mode;
      index.set(normalized, key);
      continue;
    }

    if (merged[existingKey] !== mode) {
      throw new Error(
        `Conflicting mode hints for ${repo}/${key}: ${merged[existingKey]} vs ${mode}`,
      );
    }
  }

  return merged;
}

export function resolveModeHint(
  variantName: string,
  hints: Record<string, ThemeMode>,
): ModeHintResolution | undefined {
  const exact = hints[variantName];
  if (exact) {
    return { mode: exact, matchedKey: variantName, normalizedMatch: false };
  }

  const normalizedName = normalizeModeHintKey(variantName);
  for (const [hintName, mode] of Object.entries(hints)) {
    if (normalizeModeHintKey(hintName) === normalizedName) {
      return { mode, matchedKey: hintName, normalizedMatch: true };
    }
  }

  return undefined;
}
