/**
 * Theme Browser Registry
 *
 * Discovers Neovim colorschemes from GitHub and produces a searchable index.
 */

// Core types and utilities
export * from "@/lib/index";

// Database layer
export * from "@/db/index";

// Domain: sync themes from GitHub
export * from "@/sync/index";

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
} from "@/detect/index";

// Domain: merge overrides
export * from "@/merge/index";

// Domain: build artifacts
export {
  isValidThemeName,
  inferModeFromColorscheme,
  type ThemeWithMeta,
  getThemeStrategy,
  deduplicateThemes,
  applyInferredModes,
} from "@/build/index";

// Domain: lint/validate
export {
  type RegistryValidationResult,
  getThemeStrategy as getThemeStrategyForLint,
  validateRegistry,
} from "@/lint/index";

// Domain: push/release
export * from "@/push/index";

// CLI commands
export * from "@/cmd/index";
