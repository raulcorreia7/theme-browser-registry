# @theme-browser/registry

Theme discovery and artifact generation for `theme-browser.nvim`.

It discovers Neovim colorschemes from GitHub and produces the generated data
used by the plugin.

## Quick Start

From `packages/registry`:

```bash
go build ./...
export GITHUB_TOKEN=...   # required for GitHub API access
go test ./...
go run ./cmd/registry validate
```

## Requirements

- Go (see `go.mod`)
- GitHub token for GitHub API access (`GITHUB_TOKEN`)

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

Testing mode (`--testing`) writes isolated outputs under `artifacts/testing/`
and `reports/testing/`.

## Building

```bash
go build -o bin/registry ./cmd/registry
```

## Subcommands

| Command | Purpose |
|---------|---------|
| `sync` | Discover and index theme repositories |
| `detect` | Detect load strategies from READMEs and trees |
| `merge` | Merge strategy sources into the overrides artifact |
| `build` | Build the optimized themes artifact |
| `bundle` | Select themes for the Lua plugin bundle |
| `manifest` | Write manifest.json with checksum for the themes artifact |
| `validate` | Validate the themes artifact against publication gates |
| `pipeline` | Run the full registry pipeline |
| `publish` | Sync once then commit+push artifacts per config.publish |
| `export` | Dump cache payloads as JSON |

Common flags: `-c/--config` (config file), `--testing` (isolated local
outputs), `-f/--force` (force sync refresh), `--no-detect-apply` (inspect
detect output without applying patches). Run `go run ./cmd/registry <cmd>
--help` for per-command flags.

## Notes

- Use the root `make` targets for cross-repo work.
- `validate` checks existing outputs; it does not regenerate artifacts.
- `pipeline --testing` keeps curated sources untouched and redirects bundle
  output to `artifacts/testing/registry.json`.
- For scheduled refresh runs, prefer the root runbooks and helpers in
  `../../docs/automation.md` and `../../scripts/registry-refresh.sh`.

## Configuration

- Main runtime config: `config/registry.json`
- Curated overrides: `config/overrides.json`
- Manual hints: `config/sources/hints.json`
