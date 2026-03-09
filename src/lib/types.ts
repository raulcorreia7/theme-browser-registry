/**
 * Core types and Zod schemas for theme-browser-registry.
 *
 * All runtime validation is handled through Zod schemas.
 * TypeScript types are inferred from these schemas.
 */

import { z } from "zod";
import { REGISTRY_VERSION } from "@/lib/version";

// =============================================================================
// Theme Domain - Core theme-related types
// =============================================================================

/**
 * Background color preference
 */
export const BackgroundSchema = z.enum(["dark", "light"]);

/**
 * Theme loading strategies
 */
export const LoadStrategySchema = z.enum(["colorscheme", "setup", "load", "file"]);

/**
 * Theme mode (dark/light)
 */
export const ThemeModeSchema = z.enum(["dark", "light"]);

/**
 * Vim options (vim.g and vim.o)
 */
export const VimOptionsSchema = z.object({
  g: z.record(z.unknown()).optional(),
  o: z.record(z.unknown()).optional(),
});

/**
 * Theme strategy configuration
 */
export const ThemeStrategySchema = z.object({
  type: LoadStrategySchema.optional(),
  module: z.string().optional(),
  file: z.string().optional(),
  args: z.array(z.string()).optional(),
  opts: z.record(z.unknown()).optional(),
  vim: VimOptionsSchema.optional(),
  mode: ThemeModeSchema.optional(),
});

/**
 * Theme metadata for advanced loading
 */
export const ThemeMetaSchema = z.object({
  strategy: ThemeStrategySchema.optional(),
  mode: ThemeModeSchema.optional(),
});

/**
 * Theme variant (e.g., different color schemes for same theme)
 */
export const ThemeVariantSchema = z.object({
  colorscheme: z.string().min(1),
  meta: ThemeMetaSchema.optional(),
  mode: ThemeModeSchema.optional(),
  modeExempt: z.boolean().optional(),
  name: z.string().min(1),
  variant: z.string().optional(),
});

/**
 * Main theme entry schema
 */
export const ThemeEntrySchema = z.object({
  aliases: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  builtin: z.boolean().optional(),
  colorscheme: z.string().min(1),
  deps: z.array(z.string()).optional(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  homepage: z.string().optional(),
  meta: ThemeMetaSchema.optional(),
  name: z.string().min(1),
  repo: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/)
    .optional(),
  stars: z.number().int().nonnegative().optional(),
  topics: z.array(z.string()).optional(),
  updated_at: z.string().optional(),
  variants: z.array(ThemeVariantSchema).optional(),
});

/**
 * Full theme registry (array of entries)
 */
export const ThemeRegistrySchema = z.array(ThemeEntrySchema);

// =============================================================================
// GitHub Domain - GitHub API types
// =============================================================================

/**
 * GitHub repository item from API
 */
export const GitHubRepoItemSchema = z.object({
  archived: z.boolean(),
  default_branch: z.string().optional(),
  description: z.string().nullable(),
  disabled: z.boolean(),
  full_name: z.string(),
  html_url: z.string(),
  id: z.number(),
  stargazers_count: z.number(),
  topics: z.array(z.string()).optional(),
  updated_at: z.string(),
});

/**
 * GitHub tree item from API
 */
export const GitHubTreeItemSchema = z.object({
  mode: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number().optional(),
  type: z.enum(["blob", "commit", "tree"]),
  url: z.string(),
});

// =============================================================================
// Storage Domain - Database and export types
// =============================================================================

/**
 * Database cache entry schema
 */
export const RepoCacheEntrySchema = z.object({
  parse_error: z.string().nullable(),
  payload: ThemeEntrySchema.or(z.record(z.unknown())).nullable(),
  repo: z.string(),
  scanned_at: z.number(),
  updated_at: z.string(),
});

/**
 * Export entry for database export
 */
export const DbExportEntrySchema = z.object({
  parse_error: z.string().nullable(),
  payload: ThemeEntrySchema.or(z.record(z.unknown())).nullable(),
  repo: z.string(),
  scanned_at: z.number(),
  updated_at: z.string(),
});

/**
 * Database export schema
 */
export const DbExportSchema = z.object({
  count: z.number().int().nonnegative(),
  entries: z.array(DbExportEntrySchema),
  exported_at: z.string(),
});

// =============================================================================
// Output Domain - File and manifest types
// =============================================================================

/**
 * Manifest file schema
 */
export const ManifestSchema = z.object({
  version: z.string().default(REGISTRY_VERSION),
  count: z.number().int().nonnegative(),
  generated_at: z.string(),
  sha256: z.string().optional(),
});

// =============================================================================
// Stats Domain - Runtime statistics
// =============================================================================

/**
 * Run statistics schema
 */
export const RunStatsSchema = z.object({
  batches: z.number().int().nonnegative(),
  cached: z.number().int().nonnegative(),
  discovered: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  fetched: z.number().int().nonnegative(),
  scheduled: z.number().int().nonnegative(),
  written: z.number().int().nonnegative(),
});

// =============================================================================
// Type Exports (inferred from schemas) - Alphabetical
// =============================================================================

export type Background = z.infer<typeof BackgroundSchema>;
export type DbExport = z.infer<typeof DbExportSchema>;
export type DbExportEntry = z.infer<typeof DbExportEntrySchema>;
export type GitHubRepoItem = z.infer<typeof GitHubRepoItemSchema>;
export type GitHubTreeItem = z.infer<typeof GitHubTreeItemSchema>;
export type LoadStrategy = z.infer<typeof LoadStrategySchema>;
export type ThemeMode = z.infer<typeof ThemeModeSchema>;
export type VimOptions = z.infer<typeof VimOptionsSchema>;
export type ThemeStrategy = z.infer<typeof ThemeStrategySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type RepoCacheEntry = z.infer<typeof RepoCacheEntrySchema>;
export type RunStats = z.infer<typeof RunStatsSchema>;
export type ThemeEntry = z.infer<typeof ThemeEntrySchema>;
export type ThemeMeta = z.infer<typeof ThemeMetaSchema>;
export type ThemeRegistry = z.infer<typeof ThemeRegistrySchema>;
export type ThemeVariant = z.infer<typeof ThemeVariantSchema>;

// =============================================================================
// Type Guards - Alphabetical
// =============================================================================

export function isValidGitHubRepoItem(data: unknown): data is GitHubRepoItem {
  return GitHubRepoItemSchema.safeParse(data).success;
}

export function isValidGitHubTreeItem(data: unknown): data is GitHubTreeItem {
  return GitHubTreeItemSchema.safeParse(data).success;
}

export function isValidThemeEntry(data: unknown): data is ThemeEntry {
  return ThemeEntrySchema.safeParse(data).success;
}

export function isValidThemeMeta(data: unknown): data is ThemeMeta {
  return ThemeMetaSchema.safeParse(data).success;
}

export function isValidThemeVariant(data: unknown): data is ThemeVariant {
  return ThemeVariantSchema.safeParse(data).success;
}
