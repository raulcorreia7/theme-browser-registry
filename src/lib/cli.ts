import { z } from "zod";

export function normalizeCliArgv(argv: string[]): string[] {
  const normalized = [...argv];
  const separatorIndex = normalized.indexOf("--", 2);

  if (separatorIndex !== -1) {
    normalized.splice(separatorIndex, 1);
  }

  return normalized;
}

export const BaseTaskOptionsSchema = z.object({
  verbose: z.boolean().default(false),
  help: z.boolean().default(false),
});

export const SyncCliOptionsSchema = BaseTaskOptionsSchema.extend({
  config: z.string(),
  force: z.boolean().default(false),
});

export const DetectCliOptionsSchema = BaseTaskOptionsSchema.extend({
  index: z.string().default("artifacts/index.json"),
  sources: z.string().default("config/sources"),
  output: z.string().default("reports"),
  cache: z.string().default(".cache/theme-verifier"),
  dbCache: z.string().default(".cache/registry.db"),
  apply: z.boolean().default(false),
  sample: z.number().optional(),
  repo: z.string().optional(),
  theme: z.string().optional(),
  noCache: z.boolean().default(false),
});

export const MergeCliOptionsSchema = BaseTaskOptionsSchema.extend({
  sources: z.string().default("config/sources"),
  output: z.string().default("config/overrides.json"),
});

export const BuildCliOptionsSchema = BaseTaskOptionsSchema.extend({
  config: z.string().default("config/registry.json"),
  index: z.string().default("artifacts/index.json"),
  overrides: z.string().default("config/overrides.json"),
  output: z.string().default("artifacts/themes.json"),
  minify: z.boolean().default(false),
});

export const BundleCliOptionsSchema = BaseTaskOptionsSchema.extend({
  input: z.string().default("artifacts/themes.json"),
  output: z.string().default("../plugin/lua/theme-browser/data/registry.json"),
  count: z.number().default(50),
});

export const ValidateCliOptionsSchema = BaseTaskOptionsSchema.extend({
  themesPath: z.string().default("artifacts/themes.json"),
});

export const PipelineCliOptionsSchema = BaseTaskOptionsSchema.extend({
  config: z.string().default("config/registry.json"),
  index: z.string().default("artifacts/index.json"),
  themes: z.string().default("artifacts/themes.json"),
  sources: z.string().default("config/sources"),
  reports: z.string().default("reports"),
  overrides: z.string().default("config/overrides.json"),
  top50: z.string().default("artifacts/themes-top-50.json"),
  manifest: z.string().default("artifacts/manifest.json"),
  localRegistry: z.string().default("../plugin/lua/theme-browser/data/registry.json"),
  count: z.number().int().min(1).default(50),
  force: z.boolean().default(false),
  noCache: z.boolean().default(false),
  detectApply: z.boolean().default(true),
  testing: z.boolean().default(false),
});

export type SyncCliOptions = z.infer<typeof SyncCliOptionsSchema>;
export type DetectCliOptions = z.infer<typeof DetectCliOptionsSchema>;
export type MergeCliOptions = z.infer<typeof MergeCliOptionsSchema>;
export type BuildCliOptions = z.infer<typeof BuildCliOptionsSchema>;
export type BundleCliOptions = z.infer<typeof BundleCliOptionsSchema>;
export type ValidateCliOptions = z.infer<typeof ValidateCliOptionsSchema>;
export type PipelineCliOptions = z.infer<typeof PipelineCliOptionsSchema>;
