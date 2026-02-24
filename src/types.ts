import { z } from "zod";

export const LoadStrategySchema = z.enum([
  "colorscheme_only",
  "setup_colorscheme",
  "vimg_colorscheme",
  "setup_load",
  "load",
]);

export const LoadAdapterSchema = z.enum(["load", "setup_load", "use"]);

export const BackgroundSchema = z.enum(["dark", "light"]);

export const ThemeMetaSchema = z.object({
  strategy: LoadStrategySchema.optional(),
  adapter: LoadAdapterSchema.optional(),
  module: z.string().optional(),
  args: z.array(z.string()).optional(),
  opts: z.record(z.unknown()).optional(),
  opts_g: z.record(z.string()).optional(),
  opts_o: z.record(z.unknown()).optional(),
  background: BackgroundSchema.optional(),
});

export const ThemeVariantSchema = z.object({
  name: z.string().min(1),
  colorscheme: z.string().min(1),
  variant: z.string().optional(),
  meta: ThemeMetaSchema.optional(),
});

export const ThemeEntrySchema = z.object({
  name: z.string().min(1),
  repo: z.string().regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/),
  colorscheme: z.string().min(1),
  description: z.string().optional(),
  stars: z.number().int().nonnegative().optional(),
  topics: z.array(z.string()).optional(),
  updated_at: z.string().optional(),
  archived: z.boolean().optional(),
  disabled: z.boolean().optional(),
  homepage: z.string().optional(),
  meta: ThemeMetaSchema.optional(),
  variants: z.array(ThemeVariantSchema).optional(),
  aliases: z.array(z.string()).optional(),
  deps: z.array(z.string()).optional(),
});

export const ThemeRegistrySchema = z.array(ThemeEntrySchema);

export const ManifestSchema = z.object({
  count: z.number().int().nonnegative(),
  generated_at: z.string(),
  sha256: z.string().optional(),
});

export const GitHubRepoItemSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  topics: z.array(z.string()).optional(),
  updated_at: z.string(),
  archived: z.boolean(),
  disabled: z.boolean(),
  html_url: z.string(),
  default_branch: z.string().optional(),
});

export const GitHubTreeItemSchema = z.object({
  path: z.string(),
  mode: z.string(),
  type: z.enum(["blob", "tree", "commit"]),
  sha: z.string(),
  size: z.number().optional(),
  url: z.string(),
});

export const RepoCacheEntrySchema = z.object({
  repo: z.string(),
  updated_at: z.string(),
  scanned_at: z.number(),
  payload: ThemeEntrySchema.or(z.record(z.unknown())).nullable(),
  parse_error: z.string().nullable(),
});

export const DbExportEntrySchema = z.object({
  repo: z.string(),
  updated_at: z.string(),
  scanned_at: z.number(),
  payload: ThemeEntrySchema.or(z.record(z.unknown())).nullable(),
  parse_error: z.string().nullable(),
});

export const DbExportSchema = z.object({
  exported_at: z.string(),
  count: z.number().int().nonnegative(),
  entries: z.array(DbExportEntrySchema),
});

export const RunStatsSchema = z.object({
  discovered: z.number().int().nonnegative(),
  scheduled: z.number().int().nonnegative(),
  batches: z.number().int().nonnegative(),
  fetched: z.number().int().nonnegative(),
  cached: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  written: z.number().int().nonnegative(),
});

export type LoadStrategy = z.infer<typeof LoadStrategySchema>;
export type LoadAdapter = z.infer<typeof LoadAdapterSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type ThemeMeta = z.infer<typeof ThemeMetaSchema>;
export type ThemeVariant = z.infer<typeof ThemeVariantSchema>;
export type ThemeEntry = z.infer<typeof ThemeEntrySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type GitHubRepoItem = z.infer<typeof GitHubRepoItemSchema>;
export type GitHubTreeItem = z.infer<typeof GitHubTreeItemSchema>;
export type RepoCacheEntry = z.infer<typeof RepoCacheEntrySchema>;
export type DbExportEntry = z.infer<typeof DbExportEntrySchema>;
export type DbExport = z.infer<typeof DbExportSchema>;
export type RunStats = z.infer<typeof RunStatsSchema>;

export function createThemeMeta(data: Partial<ThemeMeta> = {}): ThemeMeta {
  return ThemeMetaSchema.parse(data);
}

export function createThemeVariant(name: string, colorscheme: string, meta?: ThemeMeta): ThemeVariant {
  return ThemeVariantSchema.parse({ name, colorscheme, meta });
}

export function createThemeEntry(
  name: string,
  repo: string,
  colorscheme: string,
  options: Partial<Omit<ThemeEntry, "name" | "repo" | "colorscheme">> = {}
): ThemeEntry {
  return ThemeEntrySchema.parse({ name, repo, colorscheme, ...options });
}

export function createRepoCacheEntry(
  repo: string,
  updated_at: string,
  scanned_at: number,
  payload: ThemeEntry | Record<string, unknown> | null,
  parse_error: string | null = null
): RepoCacheEntry {
  return RepoCacheEntrySchema.parse({ repo, updated_at, scanned_at, payload, parse_error });
}

export const validateThemeEntry = ThemeEntrySchema.safeParse.bind(ThemeEntrySchema);
export const validateRegistry = ThemeRegistrySchema.safeParse.bind(ThemeRegistrySchema);
export const validateManifest = ManifestSchema.safeParse.bind(ManifestSchema);
export const validateGitHubRepoItem = GitHubRepoItemSchema.safeParse.bind(GitHubRepoItemSchema);
export const validateGitHubTreeItem = GitHubTreeItemSchema.safeParse.bind(GitHubTreeItemSchema);
export const validateRepoCacheEntry = RepoCacheEntrySchema.safeParse.bind(RepoCacheEntrySchema);

export function isValidThemeEntry(data: unknown): data is ThemeEntry {
  return ThemeEntrySchema.safeParse(data).success;
}

export function isValidThemeVariant(data: unknown): data is ThemeVariant {
  return ThemeVariantSchema.safeParse(data).success;
}

export function isValidThemeMeta(data: unknown): data is ThemeMeta {
  return ThemeMetaSchema.safeParse(data).success;
}

export function isValidGitHubRepoItem(data: unknown): data is GitHubRepoItem {
  return GitHubRepoItemSchema.safeParse(data).success;
}

export function isValidGitHubTreeItem(data: unknown): data is GitHubTreeItem {
  return GitHubTreeItemSchema.safeParse(data).success;
}
