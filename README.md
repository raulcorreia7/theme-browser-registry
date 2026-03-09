# @theme-browser/registry

Theme discovery and artifact generation for `theme-browser.nvim`.

It discovers Neovim colorschemes from GitHub and produces the generated data
used by the plugin.

## Quick Start

From `packages/registry`:

```bash
cp .env.example .env
# set GITHUB_TOKEN=...
pnpm install
pnpm verify
```

## Requirements

- Node.js 20+
- pnpm 10+
- GitHub token for GitHub API access

## Outputs

Normal pipeline outputs:

| Path | Purpose |
|------|---------|
| `artifacts/index.json` | Raw synced theme index |
| `artifacts/themes.json` | Main registry artifact consumed by the plugin |
| `artifacts/themes-top-50.json` | Ranked top-themes artifact |
| `artifacts/manifest.json` | Checksum and generated-at metadata |
| `../plugin/lua/theme-browser/data/registry.json` | Bundled registry snapshot for the plugin |
| `reports/detection.json` | Detect-stage report |
| `reports/variant-coverage.json` | Variant coverage report |

Testing mode writes isolated outputs under `artifacts/testing/` and
`reports/testing/`.

## Day-To-Day Commands

| Command | Use it when |
|---------|-------------|
| `pnpm pipeline` | Run the full registry pipeline against normal outputs |
| `pnpm pipeline:testing` | Run the full pipeline with isolated testing outputs |
| `pnpm verify` | Run tests plus registry validation against current outputs |
| `pnpm test` | Run Vitest only |
| `pnpm validate` | Validate an already-generated registry artifact |
| `pnpm lint` | Run ESLint on `src/` |
| `pnpm typecheck` | Run TypeScript type checks |
| `pnpm build` | Compile the package |

## Stage Commands

Use these when you need to debug one stage without running the full pipeline.

| Command | Purpose |
|---------|---------|
| `pnpm sync` | Fetch and update the raw theme index |
| `pnpm detect` | Infer theme strategies and optionally apply patches |
| `pnpm detect:dry-run` | Inspect detect output without applying patches |
| `pnpm merge` | Merge curated source files into overrides |
| `pnpm themes` | Generate `artifacts/themes.json` |
| `pnpm top50` | Generate `artifacts/themes-top-50.json` |
| `pnpm manifest` | Generate `artifacts/manifest.json` |
| `pnpm bundle` | Write the plugin's bundled `registry.json` |

## Notes

- Use the root `make` targets for cross-repo work.
- `pnpm verify` checks existing outputs; it does not regenerate artifacts.
- `pnpm pipeline:testing` keeps curated sources untouched and redirects bundle
  output to `artifacts/testing/registry.json`.
- Legacy `pnpm task:*` aliases still exist for older local automation.

## Configuration

- Main runtime config: `config/registry.json`
- Curated overrides: `config/overrides.json`
- Manual hints: `config/sources/hints.json`
- Optional deny-list and editorial tracking: `config/excluded.json`

## Related Docs

- `../../README.md` - root workflows and shared commands
- `../../docs/README.md` - doc map and freshness rules
- `../../docs/theme-detection.md` - stage-by-stage debugging guide
- `../../docs/theme-detection-heuristics.md` - scoring, tie-breaks, and hint rules
- `../../docs/automation.md` - scheduled refresh runner guide
