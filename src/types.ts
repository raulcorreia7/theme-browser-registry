import { z } from "zod";

export const LoadStrategySchema = z.enum([
  "colorscheme_only",
  "setup_colorscheme",
  "vimg_colorscheme",
  "setup_load",
  "load",
]);

export const ThemeMetaSchema = z.object({
  strategy: LoadStrategySchema.optional(),
  module: z.string().optional(),
  args: z.array(z.string()).optional(),
  opts: z.record(z.unknown()).optional(),
  opts_g: z.record(z.unknown()).optional(),
  opts_o: z.record(z.unknown()).optional(),
  background: z.enum(["dark", "light"]).optional(),
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
  topics: z.array(z.string().min(1)).optional(),
  updated_at: z.string().optional(),
  archived: z.boolean().optional(),
  disabled: z.boolean().optional(),
  homepage: z.string().url().optional(),
  meta: ThemeMetaSchema.optional(),
  variants: z.array(ThemeVariantSchema).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  deps: z.array(z.string().regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/)).optional(),
});

export const ThemeRegistrySchema = z.array(ThemeEntrySchema);

export const ManifestSchema = z.object({
  count: z.number().int().nonnegative(),
  generated_at: z.string(),
  sha256: z.string().optional(),
});

export type LoadStrategy = z.infer<typeof LoadStrategySchema>;
export type ThemeMeta = z.infer<typeof ThemeMetaSchema>;
export type ThemeVariant = z.infer<typeof ThemeVariantSchema>;
export type ThemeEntry = z.infer<typeof ThemeEntrySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export const GitHubRepoItemSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  topics: z.array(z.string()),
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

export type GitHubRepoItem = z.infer<typeof GitHubRepoItemSchema>;
export type GitHubTreeItem = z.infer<typeof GitHubTreeItemSchema>;

export interface RepoCacheEntry {
  repo: string;
  updated_at: string;
  scanned_at: number;
  payload: ThemeEntry | Record<string, unknown> | null;
  parse_error: string | null;
}

export function validateThemeEntry(data: unknown): ThemeEntry | null {
  const result = ThemeEntrySchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}

export function validateRegistry(data: unknown): ThemeEntry[] | null {
  const result = ThemeRegistrySchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}

export function validateManifest(data: unknown): Manifest | null {
  const result = ManifestSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}
