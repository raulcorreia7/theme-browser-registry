# @theme-browser/registry

> ⚠️ **ALPHA - NOT FOR PRODUCTION USE**
> 
> This registry indexer is under active development. APIs, schema, and behavior may change without notice.
> Use at your own risk.

TypeScript theme registry indexer for [theme-browser.nvim](https://github.com/anomalyco/theme-browser.nvim).

Discovers Neovim colorschemes from GitHub and produces a searchable `themes.json` index.

## Quick Start

```bash
npm install
GITHUB_TOKEN=xxx npx tsx src/index.ts run-once
```

## Configuration

Configuration is loaded from `indexer.config.json`:

| Option | Default | Description |
|--------|---------|-------------|
| `topics` | `["neovim-colorscheme", ...]` | GitHub topics to search |
| `include_repos` | `[]` | Always include these repos (owner/name) |
| `output_path` | `themes.json` | Output file for theme index |
| `manifest_path` | `artifacts/latest.json` | Metadata about last run |
| `overrides_path` | `overrides.json` | Manual theme overrides |
| `state_db_path` | `.state/indexer.db` | SQLite database for state |
| `per_page` | `100` | Results per GitHub API page |
| `max_pages_per_topic` | `5` | Max pages to fetch per topic |
| `request_delay_ms` | `250` | Delay between API requests |
| `retry_limit` | `3` | Retries for failed requests |
| `batch_size` | `50` | Repos to process per batch |
| `batch_pause_ms` | `0` | Pause between batches |
| `max_repos_per_run` | `0` | Limit repos (0 = unlimited) |
| `scan_interval_seconds` | `1800` | Loop interval (30 min) |
| `stale_after_days` | `14` | Days before repo is stale |
| `min_stars` | `0` | Minimum stars to include |
| `skip_archived` | `true` | Skip archived repos |
| `skip_disabled` | `true` | Skip disabled repos |
| `sort_by` | `"stars"` | Sort field (stars, updated, etc.) |
| `sort_order` | `"desc"` | Sort direction |
| `log_level` | `"INFO"` | Log level (DEBUG, INFO, WARN, ERROR) |
| `publish_enabled` | `false` | Auto-publish to git |
| `publish_remote` | `"origin"` | Git remote for publishing |
| `publish_branch` | `"master"` | Branch for publishing |
| `publish_commit_message` | `"chore(registry): ..."` | Commit message template |

## CI/CD Setup

### GitHub Actions (Automatic)

The workflow uses `secrets.GITHUB_TOKEN` automatically. This built-in token:
- Is created automatically by GitHub Actions
- Has read access to public repositories
- Is rate-limited to ~1,000 requests/hour per repository

For most registries, this is sufficient.

### Higher Rate Limits (Optional)

For heavy indexing, create a Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Create a token with `public_repo` scope (read-only for public repos)
3. Add as repository secret: `REGISTRY_GITHUB_TOKEN`
4. Update workflow to use `${{ secrets.REGISTRY_GITHUB_TOKEN }}` instead of `${{ secrets.GITHUB_TOKEN }}`

Rate limits with PAT: ~5,000 requests/hour.

## Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run tests with Vitest |
| `npm run build` | Compile TypeScript to `dist/` |
| `npx tsx src/index.ts run-once` | Index repos once, then exit |
| `npx tsx src/index.ts run-loop` | Index continuously at `scan_interval_seconds` |
| `npx tsx src/index.ts run-once-publish` | Index once and publish to git |

## Architecture

```
src/
├── index.ts          # CLI entry point with Commander
├── runner.ts         # Orchestration: fetch → parse → merge → output
├── config.ts         # Load and validate indexer.config.json
├── github-client.ts  # GitHub API client with rate limiting
├── parser.ts         # Parse Neovim theme metadata from repos
├── merge.ts          # Merge results with overrides
├── state.ts          # SQLite state management
├── models.ts         # TypeScript types and interfaces
├── types.ts          # Shared type definitions
└── logger.ts         # Structured logging with Pino
```

### Data Flow

1. **Discovery**: Search GitHub by topics, plus `include_repos` list
2. **Fetch**: Get repo metadata, README, and theme files
3. **Parse**: Extract colorscheme names and metadata from Lua
4. **Merge**: Apply manual overrides from `overrides.json`
5. **Output**: Write `themes.json` and manifest
6. **Publish**: (Optional) Commit and push artifacts

## License

MIT
