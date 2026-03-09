# @theme-browser/registry

Theme registry indexer for `theme-browser.nvim`.

It discovers Neovim colorschemes from GitHub and produces:

- `artifacts/themes.json`
- `artifacts/manifest.json`
- `artifacts/themes-top-50.json`

## Entry Points

For cross-repo work, use the root `make` targets documented in the root README.

From `packages/registry`, the main local commands are:

```bash
pnpm pipeline
pnpm pipeline:testing
pnpm verify
pnpm validate
pnpm test
```

## Setup

- Node.js >= 20
- pnpm
- GitHub token for GitHub API access

```bash
cp .env.example .env
# set GITHUB_TOKEN=...
```

## Stage Commands

Use these when you need to debug a specific stage:

```bash
pnpm sync
pnpm detect
pnpm merge
pnpm themes
pnpm bundle
pnpm top50
pnpm manifest
pnpm validate
```

## Notes

- Use `pnpm pipeline:testing` for isolated outputs without mutating curated sources.
- Use `pnpm verify` for the local preflight before release or pipeline changes.
- Pass other pipeline flags directly to `pnpm pipeline` (for example `pnpm pipeline --force`).

## Configuration

Detailed configuration lives under `config/`, with `config/registry.json` as the main runtime entry point.
