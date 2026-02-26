import { z } from "zod";

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
  sources: z.string().default("sources"),
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
  sources: z.string().default("sources"),
  output: z.string().default("overrides.json"),
});

export const BuildCliOptionsSchema = BaseTaskOptionsSchema.extend({
  index: z.string().default("artifacts/index.json"),
  overrides: z.string().default("overrides.json"),
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

export type SyncCliOptions = z.infer<typeof SyncCliOptionsSchema>;
export type DetectCliOptions = z.infer<typeof DetectCliOptionsSchema>;
export type MergeCliOptions = z.infer<typeof MergeCliOptionsSchema>;
export type BuildCliOptions = z.infer<typeof BuildCliOptionsSchema>;
export type BundleCliOptions = z.infer<typeof BundleCliOptionsSchema>;
export type ValidateCliOptions = z.infer<typeof ValidateCliOptionsSchema>;
