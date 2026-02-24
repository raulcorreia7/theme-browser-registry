# @theme-browser/registry

> ⚠️ **ALPHA - NOT FOR PRODUCTION USE**
> 
> This registry indexer is under active development. APIs, schema, and behavior may change without notice.
> Use at your own risk.

TypeScript theme registry indexer for [theme-browser.nvim](https://github.com/anomalyco/theme-browser.nvim).

Discovers Neovim colorschemes from GitHub and produces a searchable `themes.json` index.

## Setup

### Requirements

- Node.js >= 20
- npm

### Installation

```bash
cd theme-browser-registry-ts
npm install
```

### GitHub Token (Required)

The indexer requires a GitHub token for API access. Without a token, you'll be rate-limited to ~60 requests/hour.

**Create a token:**

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token (fine-grained)"
3. Set token name (e.g., "theme-browser-registry")
4. Set expiration as needed
5. Repository access: "Public repositories (read-only)"
6. Permissions: No additional scopes needed for public repos
7. Click "Generate token" and copy it

**Configure the token:**

```bash
# Option 1: Environment variable (recommended for local dev)
cp .env.example .env
# Edit .env and add your token:
# GITHUB_TOKEN=ghp_your_token_here
source .env

# Option 2: Pass directly (one-off runs)
GITHUB_TOKEN=ghp_your_token_here npx tsx src/index.ts run-once
```

## Running the Indexer

### One-time Index

Run once to index all repositories and exit:

```bash
# From this directory
GITHUB_TOKEN=ghp_xxx npx tsx src/index.ts run-once

# Or if .env is sourced
npx tsx src/index.ts run-once
```

Output:
- `themes.json` — Theme index
- `artifacts/latest.json` — Run metadata

### Continuous Index (Loop)

Run continuously, reindexing at configured intervals:

```bash
GITHUB_TOKEN=ghp_xxx npx tsx src/index.ts run-loop
```

Default interval: 30 minutes (configurable via `scan_interval_seconds`).

### Index and Publish

Index once and commit/push artifacts to git:

```bash
GITHUB_TOKEN=ghp_xxx npx tsx src/index.ts run-once-publish
```

Requires `publish_enabled: true` in config.

### From Monorepo Root

```bash
# From theme-browser-monorepo root
make registry-index-once    # Run once
make registry-index-loop    # Run in loop
make registry-test          # Run tests
make registry-clean         # Clean artifacts
```

## Testing

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
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

## CI/CD

### GitHub Actions (Automatic)

The workflow (`.github/workflows/registry.yml`) runs daily at 06:00 UTC.

It uses `secrets.GITHUB_TOKEN` automatically:
- Created by GitHub Actions
- Read access to public repositories
- Rate-limited to ~1,000 requests/hour

### Higher Rate Limits (Optional)

For heavy indexing, create a Personal Access Token:

1. Create token as described in [GitHub Token](#github-token-required)
2. Add as repository secret: `REGISTRY_GITHUB_TOKEN`
3. Update workflow to use `${{ secrets.REGISTRY_GITHUB_TOKEN }}`

Rate limits with PAT: ~5,000 requests/hour.

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
├── publish.ts        # Git publish workflow
└── logger.ts         # Structured logging with Pino
```

### Data Flow

1. **Discovery**: Search GitHub by topics, plus `include_repos` list
2. **Fetch**: Get repo metadata, README, and theme files
3. **Parse**: Extract colorscheme names and metadata from Lua
4. **Merge**: Apply manual overrides from `overrides.json`
5. **Output**: Write `themes.json` and manifest
6. **Publish**: (Optional) Commit and push artifacts

## Troubleshooting

### Rate Limited

```
GitHubRequestError: HTTP 403 for https://api.github.com/...
```

Solution: Wait and retry, or add a GitHub token for higher rate limits.

### Token Unauthorized

```
GitHubRequestError: github authorization failed; check GITHUB_TOKEN
```

Solution: Verify your token is valid and has correct permissions.

### No Themes Found

Check that:
- Topics in config match GitHub repositories
- `include_repos` contains valid owner/name format
- Network connectivity is working

## License

MIT
