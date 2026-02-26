import type { DetectionResult, DetectionSignal, StrategyType } from "./types";
import { CONFIG } from "./types";

const SCORE = {
  REQUIRE_LOAD: 8,
  LOAD_PATTERN: 2,
  REQUIRE_SETUP: 6,
  SETUP_OPTIONS: 2,
  COLORSCHEME_USAGE: 4,
  VIM_G_GLOBALS: 3,
  FILE_STRATEGY: 2,
  COLORS_VIM_ONLY: 6,
  LUA_MODULE_WITH_COLORS: 4,
  COLORS_LUA_ONLY: 5,
  PLUGIN_WITH_LUA: 3,
  LUA_NO_COLORS: 4,
  BONUS_LOAD_OVER_SETUP: 2,
  BONUS_SETUP_OVER_COLORSCHEME: 3,
} as const;

const RE = {
  REQUIRE_LOAD: /require\(["'][^"']+["']\)\.load\s*\(/i,
  LOAD_PATTERN: /\.load\s*\(\s*{?/i,
  REQUIRE_CALL: /require\(/i,
  REQUIRE_SETUP: /require\(["'][^"']+["']\)\.setup\s*\(/i,
  SETUP_OPTIONS: /setup\s*\(\s*{[\s\S]*?}\s*\)/i,
  COLORSCHEME_CMD: /:?colorscheme\s+[a-z0-9_.-]+/i,
  VIM_CMD_COLORSCHEME: /vim\.cmd\s*\(\s*["']colorscheme\s+[a-z0-9_.-]+["']\s*\)/i,
  VIM_CMD_DOT_COLORSCHEME: /vim\.cmd\.colorscheme\s*\(\s*["'][a-z0-9_.-]+["']\s*\)/i,
  VIM_G_GLOBAL: /let\s+g:[a-z_]+\s*=/i,
  BACKGROUND_MODE: /background\s*=\s*["'](dark|light)["']/i,
  CUSTOM_ORDERING: /before\s+loading|after\s+loading|must\s+set\s+global/i,
  LUA_MODULE: /^lua\/[^/]+\/init\.lua$/i,
  LUA_SINGLE: /^lua\/[^/]+\.lua$/i,
  COLORS_LUA: /^colors\/.+\.lua$/i,
  COLORS_VIM: /^colors\/.+\.vim$/i,
  PLUGIN_LUA: /^plugin\/.+\.lua$/i,
} as const;

const DEFAULT_TALLY: Record<StrategyType, number> = {
  setup: 0,
  load: 0,
  colorscheme: 0,
  file: 0,
  unknown: 0,
};

function createTally(): Record<StrategyType, number> {
  return { ...DEFAULT_TALLY };
}

function computeDetection(signals: DetectionSignal[]): { detected: StrategyType; confidence: number } {
  const tally = createTally();
  for (const s of signals) tally[s.strategy] += s.score;

  if (tally.load > 0 && tally.setup > 0 && tally.load >= tally.setup) {
    tally.load += SCORE.BONUS_LOAD_OVER_SETUP;
  }
  if (tally.setup > 0 && tally.colorscheme > 0) {
    tally.setup += SCORE.BONUS_SETUP_OVER_COLORSCHEME;
  }

  const ranked = (Object.entries(tally) as Array<[StrategyType, number]>)
    .filter(([k]) => k !== "unknown")
    .sort((a, b) => b[1] - a[1]);

  const top = ranked[0] ?? ["unknown", 0];
  const second = ranked[1] ?? ["unknown", 0];

  if (top[1] === 0) {
    return { detected: "unknown", confidence: 0 };
  }

  const delta = Math.max(0, top[1] - second[1]);
  const confidence = Math.min(1, top[1] / 10 + delta / 10);

  return { detected: top[0], confidence };
}

export function detectFromText(readme: string): DetectionResult {
  const signals: DetectionSignal[] = [];
  const text = readme;
  const lower = readme.toLowerCase();

  if (RE.REQUIRE_LOAD.test(text)) {
    signals.push({ strategy: "load", score: SCORE.REQUIRE_LOAD, reason: "README contains require(...).load(...)" });
  }
  if (RE.LOAD_PATTERN.test(text) && RE.REQUIRE_CALL.test(text)) {
    signals.push({ strategy: "load", score: SCORE.LOAD_PATTERN, reason: "README shows .load() pattern" });
  }

  if (RE.REQUIRE_SETUP.test(text)) {
    signals.push({ strategy: "setup", score: SCORE.REQUIRE_SETUP, reason: "README contains require(...).setup(...)" });
  }
  if (RE.SETUP_OPTIONS.test(text)) {
    signals.push({ strategy: "setup", score: SCORE.SETUP_OPTIONS, reason: "README shows setup({...}) options block" });
  }

  if (RE.COLORSCHEME_CMD.test(text)) {
    signals.push({ strategy: "colorscheme", score: SCORE.COLORSCHEME_USAGE, reason: "README shows :colorscheme usage" });
  }
  if (RE.VIM_CMD_COLORSCHEME.test(text)) {
    signals.push({ strategy: "colorscheme", score: SCORE.COLORSCHEME_USAGE, reason: 'README shows vim.cmd("colorscheme ...")' });
  }
  if (RE.VIM_CMD_DOT_COLORSCHEME.test(text)) {
    signals.push({ strategy: "colorscheme", score: SCORE.COLORSCHEME_USAGE, reason: "README shows vim.cmd.colorscheme(...)" });
  }

  if (RE.VIM_G_GLOBAL.test(text) && !RE.REQUIRE_CALL.test(text)) {
    signals.push({ strategy: "colorscheme", score: SCORE.VIM_G_GLOBALS, reason: "README shows vim.g globals without require()" });
  }

  if (RE.BACKGROUND_MODE.test(text) && RE.COLORSCHEME_CMD.test(text)) {
    signals.push({ strategy: "file", score: SCORE.FILE_STRATEGY, reason: "README suggests mode-dependent setup + colorscheme" });
  }
  if (RE.CUSTOM_ORDERING.test(lower)) {
    signals.push({ strategy: "file", score: SCORE.FILE_STRATEGY, reason: "README suggests custom init ordering" });
  }

  const { detected, confidence } = computeDetection(signals);

  const needsSourceInspection = detected === "unknown" || confidence < CONFIG.HIGH_CONFIDENCE_THRESHOLD;

  return { detected, confidence, signals, needsSourceInspection };
}

export type FileTreeItem = { path: string; type: string };

function hasMatchingPath(paths: string[], regex: RegExp): boolean {
  return paths.some((p) => regex.test(p));
}

export function inspectSource(files: FileTreeItem[]): Partial<DetectionResult> {
  const filePaths = files.filter((t) => t.type === "blob").map((t) => t.path);

  const hasLuaModule = hasMatchingPath(filePaths, RE.LUA_MODULE) || hasMatchingPath(filePaths, RE.LUA_SINGLE);
  const hasColorsLua = hasMatchingPath(filePaths, RE.COLORS_LUA);
  const hasColorsVim = hasMatchingPath(filePaths, RE.COLORS_VIM);
  const hasPluginDir = hasMatchingPath(filePaths, RE.PLUGIN_LUA);

  const signals: DetectionSignal[] = [];

  if (hasColorsVim && !hasLuaModule && !hasColorsLua) {
    signals.push({ strategy: "colorscheme", score: SCORE.COLORS_VIM_ONLY, reason: "Repo has colors/*.vim without Lua module" });
  }

  if (hasLuaModule && hasColorsLua) {
    signals.push({ strategy: "setup", score: SCORE.LUA_MODULE_WITH_COLORS, reason: "Repo has Lua module + colors/*.lua" });
  }

  if (hasColorsLua && !hasLuaModule) {
    signals.push({ strategy: "colorscheme", score: SCORE.COLORS_LUA_ONLY, reason: "Repo has colors/*.lua without Lua module" });
  }

  if (hasPluginDir && hasLuaModule) {
    signals.push({ strategy: "setup", score: SCORE.PLUGIN_WITH_LUA, reason: "Repo has plugin/ dir + Lua module" });
  }

  if (hasLuaModule && !hasColorsLua && !hasColorsVim) {
    signals.push({ strategy: "load", score: SCORE.LUA_NO_COLORS, reason: "Repo has Lua module without colors/" });
  }

  if (signals.length === 0) {
    signals.push({ strategy: "unknown", score: 0, reason: "No clear signals from source" });
  }

  const { detected, confidence } = computeDetection(signals);

  return { detected, confidence, signals };
}
