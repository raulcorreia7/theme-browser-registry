# Contributing to @theme-browser/registry

This package discovers Neovim colorschemes from GitHub and generates the
registry artifacts consumed by `theme-browser.nvim`.

For cross-repo work (coordinated releases, root automation), use the
`theme-browser-monorepo` root `make` targets instead of package commands.

## Prerequisites

- Node.js 20+
- pnpm 10+
- A GitHub token (commands that hit the GitHub API require it)

## Setup

```bash
cp .env.example .env      # set GITHUB_TOKEN=...
pnpm install
pnpm verify               # tests + validation against current artifacts
```

## Make your change

1. Fork the repo and create a branch from `master`.
2. Make your change in `src/`, `tasks/`, or `config/`.
3. Run the same checks CI runs:

```bash
pnpm typecheck
pnpm lint
pnpm format:check         # fix with: pnpm format
pnpm test
pnpm build
```

4. Push your branch and open a pull request against `master`.

## Running the pipeline

`pnpm verify` only checks existing artifacts; it does not regenerate them.
To exercise the generator without touching curated sources or normal outputs:

```bash
pnpm pipeline:testing     # full pipeline into artifacts/testing/ and reports/testing/
```

Debug a single stage with `pnpm sync`, `pnpm detect:dry-run`, `pnpm merge`,
`pnpm themes`, `pnpm top50`, `pnpm manifest`, or `pnpm bundle`.

## Curating data

- Runtime config: `config/registry.json`
- Curated overrides: `config/overrides.json`
- Manual hints: `config/sources/hints.json`
- Deny-list/editorial tracking: `config/excluded.json`

Do not hand-edit files under `artifacts/` or `reports/`; they are generated.

## Tests

Tests live in `tests/` and run with Vitest. Add a test with every behavior
change to `src/`; run a single file with `pnpm vitest run tests/<path>`.
