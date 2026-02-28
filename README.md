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
- npm
- GitHub token (for API access)

### Installation

```bash
cd packages/registry
npm install
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
| `npm run task:sync`     | Sync themes from GitHub                       |
| `npm run task:detect`   | Detect strategies from README/source patterns |
| `npm run task:merge`    | Merge curated sources into overrides          |
| `npm run task:build`    | Generate `artifacts/themes.json`              |
| `npm run task:bundle`   | Generate bundled plugin registry (top themes) |
| `npm run task:pipeline` | Run full pipeline end-to-end                  |
| `npm run task:validate` | Validate output quality and constraints       |

```bash
npm run task:sync
npm run task:detect -- --apply
npm run task:merge
npm run task:build
npm run task:validate
```

Full pipeline with local testing outputs:

```bash
npm run task:pipeline -- --testing
```

Override local registry output path for testing:

```bash
npm run task:pipeline -- --local-registry artifacts/registry.local.json
```

**Output:**

- `artifacts/themes.json` — Theme index
- `artifacts/manifest.json` — Run metadata (count, checksum, timestamp)
- `artifacts/db-export.json` — Database export (via `export`)

Count semantics:

- `themes` = top-level theme objects
- `variants` = nested entries inside each theme (not added to `themes`)

## Monorepo

```bash
make registry-sync       # Sync once
make registry-watch      # Continuous
make registry-test       # Run tests
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
npm test
npm run test:coverage
```

## Architecture

```
src/
├── cli.ts              # CLI entry point
├── cmd/                # Command handlers
│   ├── commands/       # Individual commands (sync, publish, export, watch)
│   └── index.ts        # Command router
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
└── validate/           # Validation
    └── registry.ts     # Output validation
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
