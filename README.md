# @theme-browser/registry

> ⚠️ **ALPHA - NOT for PRODUCTION USE**
> 
> This registry indexer is under active development. APIs, schema, and behavior may change without notice.
> Use at your own risk.

TypeScript theme registry indexer for [theme-browser.nvim](https://github.com/anomalyco/theme-browser.nvim).

Discovers Neovim colorschemes from GitHub and produces a searchable `themes.json` index.

## Setup

### Requirements

- Node.js >= 20
- npm
- GitHub token (for API access)

### Installation

```bash
cd theme-browser-registry-ts
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

| Command | Description |
|--------|-------------|
| `index` | Index themes once |
| `watch` | Continuous indexing |
| `publish` | Index and push to git |
| `export` | Export database to JSON |

```bash
npx tsx src/index.ts index      # Index once
npx tsx src/index.ts watch      # Continuous
npx tsx src/index.ts publish    # Index + git push
npx tsx src/index.ts export     # Export DB
```

**Output:**
- `themes.json` — Theme index
- `artifacts/latest.json` — Run metadata
- `artifacts/db-export.json` — Database export

## npm Scripts

```bash
npm run index      # Index once
npm run watch      # Continuous
npm run publish    # Index + git push
npm run export     # Export DB
npm run test       # Run tests
npm run clean      # Remove artifacts
```

## Monorepo

```bash
make registry-index      # Index once
make registry-watch      # Continuous
make registry-test       # Run tests
```

## Configuration

See [indexer.config.json](indexer.config.json) for all options.

Key options:

| Option | Default | Description |
|--------|---------|-------------|
| `topics` | `["neovim-colorscheme", ...]` | GitHub topics to search |
| `include_repos` | `[]` | Always include these repos |
| `request_delay_ms` | `250` | Delay between API requests |
| `batch_size` | `50` | Repos per batch (writes checkpoint after each) |
| `scan_interval_seconds` | `1800` | Watch interval (30 min) |
| `stale_after_days` | `14` | Days before re-fetching |
| `publish_enabled` | `false` | Enable git publishing |

## Testing

```bash
npm test
npm run test:coverage
```

## Architecture

```
src/
├── index.ts       # CLI entry point
├── runner.ts      # Index orchestration
├── config.ts      # Configuration loading
├── github-client.ts  # GitHub API client
├── parser.ts      # Theme metadata extraction
├── merge.ts       # Override merging
├── state.ts       # SQLite state store
├── publish.ts     # Git publishing
└── types.ts       # TypeScript types
```

Data flow:
1. Discover repos via GitHub topics
2. Fetch metadata and parse themes
3. Store in SQLite (incremental)
4. Write `themes.json` after each batch
5. Optionally publish to git

## License

MIT
