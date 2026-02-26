export * from "./types";
export * from "./strategy";
export * from "./variant";

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { detectFromText, inspectSource, type FileTreeItem } from "./strategy";
import { detectVariantModesFromNames, applyVariantHints, type VariantInput } from "./variant";
import type { DetectionRow, StrategyType, VariantModeResult } from "./types";
import { CONFIG } from "./types";
import type { LoadStrategy, ThemeEntry, ThemeMode } from "@/lib/types";
import type { GitHubClient } from "@/sync/github";
import type { RepoCache } from "@/db/sqlite";

export interface DetectOptions {
  sourcesDir: string;
  outputDir: string;
  indexFile: string;
  cacheDir: string;
  sample?: number;
  repo?: string;
  theme?: string;
  apply: boolean;
  noCache: boolean;
  concurrency?: number;
}

export interface DetectDeps {
  github: GitHubClient;
  cache: RepoCache | null;
}

export interface PatchEntry {
  repo: string;
  strategy: LoadStrategy;
  confidence: number;
}

export interface VariantCoverageReport {
  generated_at: string;
  summary: {
    total_repos_with_variants: number;
    total_variants: number;
    with_mode: number;
    need_detection: number;
    coverage_percent: number;
  };
  by_source: {
    pattern: number;
    hint: number;
    readme: number;
    unknown: number;
  };
  repos_needing_attention: Array<{
    repo: string;
    total: number;
    withMode: number;
    coverage: number;
    unknownVariants: string[];
  }>;
}

export interface ExtendedDetectionRow extends DetectionRow {
  variants?: {
    total: number;
    withMode: number;
    detected: VariantModeResult[];
    coverage: number;
  };
}

export interface DetectResult {
  rows: ExtendedDetectionRow[];
  patch: PatchEntry[];
  variantReport: VariantCoverageReport;
}

type SourcesFile = {
  overrides: ThemeEntry[];
  builtin?: ThemeEntry[];
};

type Hint = {
  repo: string;
  strategy: StrategyType;
  variantModes?: Record<string, ThemeMode>;
  reason?: string;
};

type HintsFile = {
  hints: Hint[];
};

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function loadSources(sourcesDir: string): SourcesFile {
  const overridesPath = path.join(sourcesDir, "overrides.json");
  if (existsSync(overridesPath)) {
    return readJsonFile<SourcesFile>(overridesPath);
  }

  const allThemes: ThemeEntry[] = [];
  const builtin: ThemeEntry[] = [];

  const strategyFiles = ["setup.json", "load.json", "colorscheme.json", "builtin.json"];

  for (const file of strategyFiles) {
    const filePath = path.join(sourcesDir, file);
    if (!existsSync(filePath)) continue;

    const data = readJsonFile<{ themes: ThemeEntry[]; strategy?: string }>(filePath);
    if (!data?.themes) continue;

    if (file === "builtin.json") {
      builtin.push(...data.themes);
    } else {
      allThemes.push(...data.themes);
    }
  }

  return { overrides: allThemes, builtin };
}

function loadHints(sourcesDir: string): Map<string, StrategyType> {
  const hintsPath = path.join(sourcesDir, "hints.json");
  if (!existsSync(hintsPath)) {
    return new Map();
  }

  try {
    const data = readJsonFile<HintsFile>(hintsPath);
    return new Map(data.hints.map((h) => [h.repo, h.strategy]));
  } catch {
    return new Map();
  }
}

function loadVariantHints(sourcesDir: string): Map<string, Record<string, ThemeMode>> {
  const hintsPath = path.join(sourcesDir, "hints.json");
  if (!existsSync(hintsPath)) {
    return new Map();
  }

  try {
    const data = readJsonFile<HintsFile>(hintsPath);
    const hintMap = new Map<string, Record<string, ThemeMode>>();

    for (const hint of data.hints) {
      if (hint.repo && hint.variantModes) {
        hintMap.set(hint.repo, hint.variantModes);
      }
    }

    return hintMap;
  } catch {
    return new Map();
  }
}

function buildRepoIndex(themes: ThemeEntry[]): Map<string, ThemeEntry[]> {
  const map = new Map<string, ThemeEntry[]>();
  for (const t of themes) {
    if (!t.repo) continue;
    const arr = map.get(t.repo) ?? [];
    arr.push(t);
    map.set(t.repo, arr);
  }
  return map;
}

function findCurrentStrategy(repo: string, sources: SourcesFile): StrategyType | "missing" {
  const entry = sources.overrides.find((o) => o.repo === repo);
  return (entry?.meta?.strategy?.type as StrategyType | undefined) ?? "missing";
}

function cachePath(base: string, kind: "readme" | "tree", repo: string, ext: string): string {
  const slug = repo.replace("/", "__");
  return path.join(base, kind, `${slug}.${ext}`);
}

async function fetchReadme(
  repo: string,
  github: GitHubClient,
  cache: RepoCache | null,
  opts: DetectOptions,
): Promise<string> {
  if (cache && !opts.noCache) {
    try {
      const cached = await cache.readReadme(repo);
      if (cached) {
        return cached.content;
      }
    } catch {
      // Fall through to file cache
    }
  }

  const cpath = cachePath(opts.cacheDir, "readme", repo, "md");
  if (!opts.noCache && existsSync(cpath)) {
    return readFileSync(cpath, "utf-8");
  }

  const readme = await github.fetchReadme(repo);
  if (!readme) {
    throw new Error("README content missing");
  }

  if (!opts.noCache) {
    ensureDir(path.dirname(cpath));
    writeFileSync(cpath, readme, "utf-8");
  }

  return readme;
}

async function fetchRepoTree(
  repo: string,
  github: GitHubClient,
  opts: DetectOptions,
): Promise<FileTreeItem[]> {
  const cpath = cachePath(opts.cacheDir, "tree", repo, "json");
  if (!opts.noCache && existsSync(cpath)) {
    return readJsonFile<FileTreeItem[]>(cpath);
  }

  const tree = await github.fetchRepositoryTree(repo, "HEAD");
  const items: FileTreeItem[] = tree.map((t) => ({ path: t.path, type: t.type }));

  if (!opts.noCache) {
    writeJsonFile(cpath, items);
  }

  return items;
}

async function detectRepo(
  repo: string,
  repoThemes: ThemeEntry[],
  sources: SourcesFile,
  github: GitHubClient,
  cache: RepoCache | null,
  opts: DetectOptions,
  hintsMap: Map<string, StrategyType>,
  variantHintsMap: Map<string, Record<string, ThemeMode>>,
): Promise<ExtendedDetectionRow> {
  try {
    const readme = await fetchReadme(repo, github, cache, opts);
    let det = detectFromText(readme);

    if (det.needsSourceInspection) {
      const tree = await fetchRepoTree(repo, github, opts);
      const src = inspectSource(tree);
      const mergedSignals = [...det.signals, ...(src.signals ?? [])];

      if (
        (det.detected === "unknown" && src.detected) ||
        (det.confidence < CONFIG.HIGH_CONFIDENCE_THRESHOLD &&
          src.detected &&
          src.detected !== "unknown")
      ) {
        det = {
          detected: src.detected ?? det.detected,
          confidence: Math.max(det.confidence, src.confidence ?? 0),
          signals: mergedSignals,
          needsSourceInspection: false,
        };
      } else {
        det = { ...det, signals: mergedSignals };
      }
    }

    if (hintsMap.has(repo)) {
      const hintedStrategy = hintsMap.get(repo)!;
      det = {
        detected: hintedStrategy,
        confidence: 1.0,
        signals: [
          ...det.signals,
          { strategy: hintedStrategy, score: 10, reason: "Manual hint override" },
        ],
        needsSourceInspection: false,
      };
    }

    const current = findCurrentStrategy(repo, sources);
    const status: DetectionRow["status"] =
      current === "missing" ? "missing-meta" : current === det.detected ? "match" : "mismatch";

    const allVariants = repoThemes.flatMap((t) => t.variants ?? []);
    let variantResults: VariantModeResult[] = [];
    let variantCoverage = 0;

    if (allVariants.length > 0) {
      variantResults = detectVariantModesFromNames(
        allVariants.map((v) => ({
          name: v.name,
          colorscheme: v.colorscheme,
          mode: v.mode as string | undefined,
          meta: v.meta as { strategy?: unknown } | undefined,
        })) as VariantInput[],
      );

      if (variantHintsMap.has(repo)) {
        variantResults = applyVariantHints(variantResults, variantHintsMap.get(repo)!);
      }

      const withMode = variantResults.filter((r) => r.detectedMode).length;
      variantCoverage = Math.round((withMode / allVariants.length) * 100);
    }

    const result: ExtendedDetectionRow = {
      repo,
      themeNames: [...new Set(repoThemes.map((t) => t.name))],
      currentStrategy: current,
      detectedStrategy: det.detected,
      confidence: Number(det.confidence.toFixed(2)),
      status,
      signals: det.signals,
    };

    if (allVariants.length > 0) {
      result.variants = {
        total: allVariants.length,
        withMode: variantResults.filter((r) => r.detectedMode).length,
        detected: variantResults,
        coverage: variantCoverage,
      };
    }

    return result;
  } catch (err) {
    return {
      repo,
      themeNames: [...new Set(repoThemes.map((t) => t.name))],
      currentStrategy: findCurrentStrategy(repo, sources),
      detectedStrategy: "unknown",
      confidence: 0,
      status: "error",
      signals: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildPatch(rows: ExtendedDetectionRow[]): PatchEntry[] {
  return rows
    .filter(
      (r) =>
        (r.status === "mismatch" || r.status === "missing-meta") &&
        r.detectedStrategy !== "unknown" &&
        r.confidence >= CONFIG.HIGH_CONFIDENCE_THRESHOLD,
    )
    .map((r) => ({
      repo: r.repo,
      strategy: r.detectedStrategy as LoadStrategy,
      confidence: r.confidence,
    }));
}

function generateVariantCoverageReport(rows: ExtendedDetectionRow[]): VariantCoverageReport {
  const reposWithVariants = rows.filter((r) => r.variants && r.variants.total > 0);

  const totalVariants = reposWithVariants.reduce((sum, r) => sum + (r.variants?.total || 0), 0);
  const withMode = reposWithVariants.reduce((sum, r) => sum + (r.variants?.withMode || 0), 0);

  const bySource = {
    pattern: 0,
    hint: 0,
    readme: 0,
    unknown: 0,
  };

  for (const row of reposWithVariants) {
    for (const v of row.variants?.detected || []) {
      bySource[v.source]++;
    }
  }

  const reposNeedingAttention = reposWithVariants
    .filter((r) => r.variants && r.variants.coverage < 100)
    .map((r) => ({
      repo: r.repo,
      total: r.variants!.total,
      withMode: r.variants!.withMode,
      coverage: r.variants!.coverage,
      unknownVariants: r.variants!.detected.filter((v) => !v.detectedMode).map((v) => v.name),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_repos_with_variants: reposWithVariants.length,
      total_variants: totalVariants,
      with_mode: withMode,
      need_detection: totalVariants - withMode,
      coverage_percent: totalVariants > 0 ? Math.round((withMode / totalVariants) * 100) : 0,
    },
    by_source: bySource,
    repos_needing_attention: reposNeedingAttention.slice(0, 50),
  };
}

export async function run(options: DetectOptions, deps: DetectDeps): Promise<DetectResult> {
  const { github, cache } = deps;

  ensureDir(options.cacheDir);
  ensureDir(options.outputDir);

  const themes = readJsonFile<ThemeEntry[]>(options.indexFile);
  const sources = loadSources(options.sourcesDir);
  const hintsMap = loadHints(options.sourcesDir);
  const variantHintsMap = loadVariantHints(options.sourcesDir);

  const repoIndex = buildRepoIndex(themes);

  const excludedRepos = new Set(["veekram/vim"]);
  let repos = [...repoIndex.keys()].filter((r) => !excludedRepos.has(r)).sort();

  if (options.repo) repos = repos.filter((r) => r === options.repo);
  if (options.theme) {
    const theme = themes.find((t) => t.name === options.theme);
    if (theme?.repo) {
      repos = repos.filter((r) => r === theme.repo);
    }
  }
  if (options.sample && options.sample > 0) repos = repos.slice(0, options.sample);

  const concurrency = options.concurrency ?? 6;
  const limiter = pLimit(concurrency);

  const rows = await Promise.all(
    repos.map((repo) =>
      limiter(() =>
        detectRepo(
          repo,
          repoIndex.get(repo) ?? [],
          sources,
          github,
          cache,
          options,
          hintsMap,
          variantHintsMap,
        ),
      ),
    ),
  );

  rows.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));

  const patch = buildPatch(rows);
  patch.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));

  const variantReport = generateVariantCoverageReport(rows);

  return { rows, patch, variantReport };
}

export function applyDetectionPatch(
  sources: { overrides: ThemeEntry[]; builtin?: ThemeEntry[] },
  patch: PatchEntry[],
  themes: ThemeEntry[],
): { overrides: ThemeEntry[]; builtin?: ThemeEntry[] } {
  const patchMap = new Map(patch.map((p) => [p.repo, p.strategy]));
  const existingRepos = new Set(sources.overrides.filter((o) => o.repo).map((o) => o.repo));

  const updated = sources.overrides.map((entry) => {
    if (!entry.repo) return entry;
    const detected = patchMap.get(entry.repo);
    if (!detected) return entry;

    const meta = entry.meta ?? {};
    const strategy = { ...(meta.strategy ?? {}) };
    strategy.type = detected;

    return {
      ...entry,
      meta: {
        ...meta,
        strategy,
      },
    };
  });

  const newEntries: ThemeEntry[] = [];
  for (const p of patch) {
    if (existingRepos.has(p.repo)) continue;

    const theme = themes.find((t) => t.repo === p.repo);
    if (!theme) continue;

    newEntries.push({
      name: theme.name,
      repo: p.repo,
      colorscheme: theme.colorscheme,
      meta: {
        strategy: {
          type: p.strategy,
        },
      },
    });
  }

  const allOverrides = [...updated, ...newEntries];
  allOverrides.sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()),
  );

  return {
    ...sources,
    overrides: allOverrides,
  };
}

export function saveSources(
  sourcesDir: string,
  sources: { overrides: ThemeEntry[]; builtin?: ThemeEntry[] },
): void {
  const byStrategy = {
    setup: [] as ThemeEntry[],
    load: [] as ThemeEntry[],
    colorscheme: [] as ThemeEntry[],
    builtin: sources.builtin ?? [],
  };

  const validStrategies = new Set(["setup", "load", "colorscheme", "builtin"]);

  for (const t of sources.overrides) {
    const rawStrategy = t.meta?.strategy?.type ?? "colorscheme";
    const strategy = validStrategies.has(rawStrategy) ? rawStrategy : "colorscheme";
    const bucket = byStrategy[strategy as keyof typeof byStrategy];
    if (bucket) {
      bucket.push(t);
    } else {
      byStrategy.colorscheme.push(t);
    }
  }

  for (const [strategy, themes] of Object.entries(byStrategy)) {
    if (themes.length === 0 || !validStrategies.has(strategy)) continue;

    const filePath = path.join(sourcesDir, `${strategy}.json`);

    writeJsonFile(filePath, {
      strategy,
      count: themes.length,
      themes: themes.sort((a, b) =>
        (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()),
      ),
    });
  }
}
