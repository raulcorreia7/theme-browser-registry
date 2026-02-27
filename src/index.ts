/**
 * Theme Browser Registry
 *
 * Discovers Neovim colorschemes from GitHub and produces a searchable index.
 */

// Core types and utilities
export * from "@/lib/types";
export { readJson, writeJson, ensureDir, pathExists, resolveRootPath } from "@/lib/io";
export * from "@/lib/cli";
export * from "@/lib/progress";
export * from "@/lib/constants";
export * from "@/lib/logger";
export * from "@/lib/config";
export * from "@/lib/validation";
export * from "@/lib/errors";
export * from "@/lib/mode";

// Database layer
export * from "@/db/index";

// Domain: sync themes from GitHub
export { runOnce, safeRepo, type DiscoveredRepo } from "@/sync/indexer";
export { GitHubClient, type GitHubClientOptions, GitHubRequestError } from "@/sync/github";
export { normalizeThemeName, extractColorschemes, buildEntry } from "@/sync/parser";
export { type SyncOptions, type SyncResult, run as runSync } from "@/sync/index";

// Domain: detect loading strategies
export {
  type StrategyType,
  type Strategy,
  type DetectionSignal,
  type DetectionResult,
  type DetectionRow,
  detectFromText,
  inspectSource,
  type FileTreeItem,
  detectVariantModeFromName,
  detectVariantModesFromNames,
  applyVariantHints,
  type DetectOptions,
  type DetectDeps,
  type PatchEntry,
  type VariantCoverageReport,
  type ExtendedDetectionRow,
  run as runDetection,
  applyDetectionPatch,
  saveSources,
} from "@/detect/index";

// Domain: merge overrides
export { type MergeOptions, type MergeResult, run as runMerge } from "@/merge/index";
export { loadOverrides, applyOverrides, type LoadOverridesResult } from "@/merge/apply";

// Domain: build artifacts
export {
  isValidThemeName,
  inferModeFromColorscheme,
  type ThemeWithMeta,
  getThemeStrategy,
  deduplicateThemes,
  applyInferredModes,
  type BuildOptions,
  type BuildResult,
  run as runBuild,
  type BundleOptions,
  type BundleResult,
  run as runBundle,
  getThemeModes,
  scoreTheme,
  selectThemesWithHeuristics,
} from "@/build/index";

// Domain: lint/validate
export {
  type RegistryValidationResult,
  getThemeStrategy as getThemeStrategyForLint,
  validateRegistry,
} from "@/lint/index";
export { type ValidateOptions, type ValidateResult, run as runValidate } from "@/validate/index";

// Domain: push/release
export * from "@/push/index";

// CLI commands
export * from "@/cmd/index";
