import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

// =============================================================================
// Zod Schemas for Config Validation (with graceful fallback to defaults)
// =============================================================================

const DiscoveryPaginationSchema = z.object({
  perPage: z.number().int().min(1).max(100).catch(100),
  maxPagesPerTopic: z.number().int().min(0).max(50).catch(5),
});

const DiscoverySchema = z.object({
  topics: z.array(z.string()).catch(["neovim-colorscheme", "nvim-theme", "vim-colorscheme"]),
  includeRepos: z.array(z.string()).catch([]),
  pagination: DiscoveryPaginationSchema.catch({ perPage: 100, maxPagesPerTopic: 5 }),
});

const GithubRateLimitSchema = z.object({
  delayMs: z.number().int().min(0).catch(250),
  retryLimit: z.number().int().min(1).max(10).catch(3),
});

const GithubSchema = z.object({
  rateLimit: GithubRateLimitSchema.catch({ delayMs: 250, retryLimit: 3 }),
});

const ProcessingBatchSchema = z.object({
  size: z.number().int().min(1).catch(50),
  pauseMs: z.number().int().min(0).catch(0),
});

const ProcessingSchema = z.object({
  batch: ProcessingBatchSchema.catch({ size: 50, pauseMs: 0 }),
  concurrency: z.number().int().min(1).max(20).catch(5),
  maxReposPerRun: z.number().int().min(0).catch(0),
});

const FiltersSchema = z.object({
  minStars: z.number().int().min(0).catch(0),
  skipArchived: z.boolean().catch(true),
  skipDisabled: z.boolean().catch(true),
  staleAfterDays: z.number().int().min(1).catch(14),
  dotfiles: z
    .object({
      enabled: z.boolean().catch(true),
      topics: z
        .array(z.string())
        .catch(["dotfiles", "dotfile", "nvim-config", "neovim-config", "vim-config", "vimrc"]),
      nameTokens: z.array(z.string()).catch(["dotfiles", "dotfile"]),
      descriptionTokens: z.array(z.string()).catch(["dotfiles", "dotfile"]),
    })
    .catch({
      enabled: true,
      topics: ["dotfiles", "dotfile", "nvim-config", "neovim-config", "vim-config", "vimrc"],
      nameTokens: ["dotfiles", "dotfile"],
      descriptionTokens: ["dotfiles", "dotfile"],
    }),
});

const OutputSchema = z.object({
  index: z.string().catch("artifacts/index.json"),
  themes: z.string().catch("artifacts/themes.json"),
  manifest: z.string().catch("artifacts/manifest.json"),
  cache: z.string().catch(".state/indexer.db"),
});

// Preprocess logLevel to uppercase for case-insensitive matching
const LogLevelSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toUpperCase() : val),
  z.enum(["DEBUG", "INFO", "WARNING", "ERROR"]).catch("INFO"),
);

const RuntimeSchema = z.object({
  scanIntervalSeconds: z.number().int().min(60).catch(1800),
  logLevel: LogLevelSchema,
});

const SortSchema = z.object({
  by: z.enum(["stars", "updated_at", "name"]).catch("stars"),
  order: z.enum(["asc", "desc"]).catch("desc"),
});

const PublishGitSchema = z.object({
  remote: z.string().catch("origin"),
  branch: z.string().catch("master"),
  message: z.string().catch("chore(registry): publish latest index artifacts"),
});

const PublishSchema = z.object({
  enabled: z.boolean().catch(false),
  git: PublishGitSchema.catch({
    remote: "origin",
    branch: "master",
    message: "chore(registry): publish latest index artifacts",
  }),
});

export const ConfigSchema = z.object({
  version: z.string().catch("2.0.0"),
  discovery: DiscoverySchema.catch({
    topics: ["neovim-colorscheme", "nvim-theme", "vim-colorscheme"],
    includeRepos: [],
    pagination: { perPage: 100, maxPagesPerTopic: 5 },
  }),
  github: GithubSchema.catch({ rateLimit: { delayMs: 250, retryLimit: 3 } }),
  processing: ProcessingSchema.catch({
    batch: { size: 50, pauseMs: 0 },
    concurrency: 5,
    maxReposPerRun: 0,
  }),
  filters: FiltersSchema.catch({
    minStars: 0,
    skipArchived: true,
    skipDisabled: true,
    staleAfterDays: 14,
    dotfiles: {
      enabled: true,
      topics: ["dotfiles", "dotfile", "nvim-config", "neovim-config", "vim-config", "vimrc"],
      nameTokens: ["dotfiles", "dotfile"],
      descriptionTokens: ["dotfiles", "dotfile"],
    },
  }),
  output: OutputSchema.catch({
    index: "artifacts/index.json",
    themes: "artifacts/themes.json",
    manifest: "artifacts/manifest.json",
    cache: ".state/indexer.db",
  }),
  overrides: z.string().catch("overrides.json"),
  runtime: RuntimeSchema.catch({ scanIntervalSeconds: 1800, logLevel: "INFO" }),
  sort: SortSchema.catch({ by: "stars", order: "desc" }),
  publish: PublishSchema.catch({
    enabled: false,
    git: {
      remote: "origin",
      branch: "master",
      message: "chore(registry): publish latest index artifacts",
    },
  }),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Config = z.infer<typeof ConfigSchema>;

// =============================================================================
// Default Config
// =============================================================================

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

// =============================================================================
// Config Loader
// =============================================================================

export function loadConfig(path: string): Config {
  let raw: unknown = {};

  if (existsSync(path)) {
    try {
      const content = readFileSync(path, "utf-8");
      raw = JSON.parse(content);
    } catch {
      raw = {};
    }
  }

  // Ensure raw is an object before parsing
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    raw = {};
  }

  return ConfigSchema.parse(raw);
}
