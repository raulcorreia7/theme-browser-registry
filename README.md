# nvim-theme-registry

Local registry generator for Neovim themes.

## What it does
- Queries GitHub for theme repos by topic.
- Builds `themes.json` (and optional variants).
- Merges `overrides.json` for manual fixes and variants.

## Quick start
```bash
# optional but recommended to avoid rate limits
export GITHUB_TOKEN=your_token_here

python scripts/fetch_themes.py
```

Fetch a single repo:
```bash
python scripts/fetch_themes.py --repo nyoom-engineering/oxocarbon.nvim
```

This writes:
- `themes.json`
- Uses `overrides.json` (if present)

## Config
Edit `config.json`:
- `topics`: list of GitHub topics to search.
- `max_pages`: number of pages per topic. Use `0` to fetch all pages.
- `per_page`: results per page (max 100).
- `rate_limit_delay`: delay (ms) between page requests.
- `detect_variants`: attempt to detect colors in `colors/`.

## Overrides
Use `overrides.json` to fix or add entries and variants.
This is where adapter metadata can live for Theme Browser (e.g., `meta.adapter`, `meta.module`).

## Curated sources
- `curated/dotfyle-top50.json`: curated registry artifact from Dotfyle top colorschemes (pages 1 and 2), including strategy metadata.

## Validate existing output
```bash
make validate
```

## Notes
- The script prefers `GITHUB_TOKEN` from the environment; without a token, the GitHub API is heavily rate limited.
- The generator is intentionally simple and local.
