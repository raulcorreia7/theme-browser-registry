# theme-browser-registry

Public registry builder for `theme-browser.nvim`.

It runs as a long-lived indexer, discovers Neovim themes from GitHub, parses likely colorschemes, applies curated overrides, and publishes versioned artifacts.

## Outputs

- `themes.json`: registry consumed by plugin/runtime tooling
- `artifacts/latest.json`: manifest with checksum + generation metadata

## Quick Start

```bash
export GITHUB_TOKEN=your_token_here
pip install -r requirements-indexer.txt

# one run
make index-once

# loop forever
make index-loop

# run once and push changed artifacts to origin/master
make index-publish
```

Container mode:

```bash
docker compose -f docker-compose.indexer.yml up -d --build
```

## Config

Edit `indexer.config.json`:

- discovery: `topics`, `include_repos`, `per_page`, `max_pages_per_topic`
- crawl control: `request_delay_ms`, `retry_limit`, `stale_after_days`
- quality gate: `min_stars`, `skip_archived`, `skip_disabled`
- outputs: `output_path`, `manifest_path`, `overrides_path`, `state_db_path`
- publish: `publish_enabled`, `publish_remote`, `publish_branch`, `publish_commit_message`

## Publish Workflow

- `scripts/indexer.py run-once-publish` updates artifacts, commits changed files, and pushes
- no commit is made when `themes.json` and `artifacts/latest.json` are unchanged

## Development

```bash
make all
```

`make all` runs index-once + schema validation.
