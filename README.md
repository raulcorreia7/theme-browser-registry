# @theme-browser/registry

> ⚠️ **ALPHA - NOT for PRODUCTION USE**
>
> This registry indexer is under active development. APIs, schema, and behavior may change without notice.
> Use at your own risk.

TypeScript theme registry indexer for [theme-browser.nvim](https://github.com/raulcorreia7/theme-browser.nvim).

Discovers Neovim colorschemes from GitHub and produces a searchable `themes.json` index.

## Setup

### Requirements

- Node.js >= 20
- pnpm
- GitHub token (for API access)

### Installation

```bash
cd packages/registry
pnpm install
```

### GitHub Token

Create a fine-grained token with "Public repositories (read-only)" access:
https://github.com/settings/tokens?type=beta

```bash
cp .env.example .env
# Edit .env: GITHUB_TOKEN=ghp_your_token_here
source .env
```

## Commands

| Command                 | Description                                   |
| ----------------------- | --------------------------------------------- |
| `pnpm task:sync`        | Sync themes from GitHub                       |
| `pnpm task:detect`      | Detect strategies from README/source patterns |
| `pnpm task:merge`       | Merge curated sources into overrides          |
| `pnpm task:build`       | Generate `artifacts/themes.json`              |
| `pnpm task:bundle`      | Generate bundled plugin registry (top themes) |
| `pnpm task:pipeline`    | Run full pipeline end-to-end                  |
| `pnpm task:validate`    | Validate output quality and constraints       |

```bash
pnpm task:sync
pnpm task:detect -- --apply
pnpm task:merge
pnpm task:build
pnpm task:validate
```

Full pipeline with local testing outputs:

```bash
pnpm task:pipeline -- --testing
```

Override local registry output path for testing:

```bash
pnpm task:pipeline -- --local-registry artifacts/registry.local.json
```

**Output:**

- `artifacts/themes.json` — Theme index
- `artifacts/manifest.json` — Run metadata (count, checksum, timestamp)
- `artifacts/themes-top-50.json` — Top 50 bundled themes

**Optional:**

- `artifacts/db-export.json` — Database export (via `pnpm export -o artifacts/db-export.json`)

Count semantics:

- `themes` = top-level theme objects
- `variants` = nested entries inside each theme (not added to `themes`)

## Monorepo

From the monorepo root, use make commands:

```bash
make sync       # Sync once
make pipeline   # Full pipeline
make test       # Run tests
```

## Configuration

See [config.json](config.json) for all options.

Key options:

| Option                  | Default                       | Description                                    |
| ----------------------- | ----------------------------- | ---------------------------------------------- |
| `topics`                | `["neovim-colorscheme", ...]` | GitHub topics to search                        |
| `include_repos`         | `[]`                          | Always include these repos                     |
| `request_delay_ms`      | `250`                         | Delay between API requests                     |
| `batch_size`            | `50`                          | Repos per batch (writes checkpoint after each) |
| `concurrency`           | `5`                           | Parallel requests within batch                 |
| `scan_interval_seconds` | `1800`                        | Watch interval (30 min)                        |
| `stale_after_days`      | `14`                          | Days before re-fetching                        |
| `publish_enabled`       | `false`                       | Enable git publishing                          |

## Safety and Exclusions

- Exclusions are enforced at discovery (`config.json` → `discovery.excludeRepos`)
- Dotfiles/config repositories are filtered by heuristic (`config.json` → `filters.dotfiles`)
- Curated deny-list is maintained in `excluded.json`
- Repos with non-theme side effects (for example writing `~/.config/*`) are removed from the catalog

## Testing

```bash
pnpm test
pnpm test:coverage
```

## Architecture

```
src/
├── cli.ts              # CLI entry point
├── cmd/                # Command handlers
│   └── commands/       # Individual commands (sync, publish, export, watch)
├── sync/               # Theme synchronization
│   ├── indexer.ts      # Main indexer
│   ├── github.ts       # GitHub API client
│   └── parser.ts       # Theme metadata extraction
├── detect/             # Strategy detection
│   ├── strategy.ts     # Detection algorithms
│   └── variant.ts      # Variant handling
├── merge/              # Source merging
│   └── apply.ts        # Override application
├── build/              # Output generation
│   └── themes.ts       # themes.json builder
├── push/               # Git publishing
│   └── git.ts          # Git operations
├── db/                 # Database layer
│   └── sqlite.ts       # SQLite state store
├── lib/                # Shared utilities
│   ├── config.ts       # Configuration loading
│   ├── logger.ts       # Logging (consola)
│   └── types.ts        # TypeScript types
├── validate/           # Validation
│   └── registry.ts     # Output validation
└── lint/               # Linting utilities
tasks/
├── 01-sync.ts          # Sync themes from GitHub
├── 02-detect.ts        # Detect loading strategies
├── 03-merge.ts         # Merge sources
├── 04-build.ts         # Generate themes.json
├── 05-bundle.ts        # Bundle plugin registry
├── 06-manifest.ts      # Generate manifest
├── 07-top-themes.ts    # Generate top themes list
├── pipeline.ts         # Full pipeline runner
└── validate/           # Validation tasks
```

Data flow:

1. Discover repos via GitHub topics
2. Fetch metadata and parse themes
3. Store in SQLite (incremental)
4. Write `themes.json` after each batch
5. Optionally publish to git

## Related

- [theme-browser.nvim](https://github.com/raulcorreia7/theme-browser.nvim) — Neovim theme gallery plugin

## License

MIT
