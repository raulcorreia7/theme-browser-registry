# NVIM Theme Registry

Decoupled theme registry for lazy-theme-browser plugin. Automatically fetches Neovim colorscheme themes from GitHub topics with comprehensive metadata.

## Quick Start

```bash
# Generate themes.json (uses default config.json)
python3 scripts/fetch_themes.py

# Specify custom config file
python3 scripts/fetch_themes.py -c my-config.json

# Validate output against schema
python3 -c "from jsonschema import validate; import json; validate(instance=json.load(open('themes.json')), schema=json.load(open('themes.schema.json')))"
```

## File Structure

```
nvim-theme-registry/
├── themes.json          # Auto-generated output (commit this)
├── themes.schema.json   # JSON Schema for validation
├── config.json          # Configuration
├── config.schema.json   # Schema for config validation
├── overrides.json       # Manual curation
├── overrides.schema.json # Schema for overrides validation
├── scripts/
│   └── fetch_themes.py # Main fetch script (Python)
└── docs/
    ├── README.md        # This file
    ├── SCHEMA.md        # Schema documentation
    └── CONTRIBUTING.md   # How to contribute
```

## Configuration

Edit `config.json`:

```json
{
  "topics": ["neovim-colorscheme", "nvim-theme"],
  "max_pages": 5,
  "per_page": 100,
  "github_token": "",
  "output_path": "themes.json",
  "overrides_path": "overrides.json",
  "schema_path": "themes.schema.json",
  "sort_by": "stars",
  "sort_order": "desc",
  "rate_limit_delay": 1000,
  "max_retries": 3
}
```

### Options

- **topics**: GitHub topics to search (required)
- **max_pages**: Maximum pages per topic (1-100)
- **per_page**: Results per page (1-100)
- **github_token**: GitHub token for higher rate limits (optional, use env var GITHUB_TOKEN)
- **output_path**: Output file path (default: themes.json)
- **overrides_path**: Override file path (default: overrides.json)
- **schema_path**: Schema file for validation (default: themes.schema.json)
- **sort_by**: Sort field (stars, forks, updated)
- **sort_order**: Sort order (desc, asc)
- **rate_limit_delay**: Delay between API requests in ms (0-60000)
- **max_retries**: Retry attempts for failed requests (0-10)

## Theme Entry Schema

### Required Fields

- **name**: Theme identifier (e.g., "tokyonight")
- **repo**: GitHub repository (e.g., "folke/tokyonight.nvim")
- **colorscheme**: Neovim command name (e.g., "tokyonight")

### Basic Metadata

- **stars**: GitHub star count
- **description**: Repository description
- **homepage**: Homepage URL
- **updated_at**: Last update timestamp (ISO 8601)

### Repository Statistics

- **forks**: Number of forks
- **watchers**: Number of watchers
- **subscribers**: Number of subscribers
- **network_count**: Number of network forks
- **open_issues**: Number of open issues
- **size**: Repository size in kilobytes

### Timestamps

- **created_at**: Repository creation timestamp (ISO 8601)
- **pushed_at**: Last commit push timestamp (ISO 8601)
- **updated_at**: Last GitHub API update timestamp (ISO 8601)

### Repository Status

- **archived**: Whether repository is archived (read-only)
- **disabled**: Whether repository is disabled by GitHub
- **has_pages**: Whether GitHub Pages is enabled

### Code Metadata

- **language**: Primary programming language (Lua, VimL, etc.)
- **default_branch**: Default branch name (main, master, etc.)
- **license**: License name (MIT, Apache-2.0, etc.)

### GitHub Topics

- **topics**: Array of GitHub topic tags

### Theme Configuration

- **tags**: Theme tags for filtering (dark, light, minimal, etc.)
- **deps**: Array of plugin dependencies (owner/repo format)
- **variants**: Array of theme variants
  - **name**: Variant display name
  - **colorscheme**: Variant colorscheme command (required)
  - **tags**: Variant-specific tags

## Manual Overrides

Edit `overrides.json` to add or modify theme entries:

```json
{
  "overrides": [
    {
      "name": "tokyonight",
      "repo": "folke/tokyonight.nvim",
      "colorscheme": "tokyonight",
      "tags": ["dark", "light", "popular"],
      "deps": [],
      "variants": [
        {
          "name": "tokyonight-night",
          "colorscheme": "tokyonight-night",
          "tags": ["dark"]
        }
      ]
    }
  ],
  "excluded": [
    "example/broken-theme",
    "deprecated/old-theme"
  ]
}
```

### Override Behavior

- **overrides**: Replace/add theme entries (matched by `repo` field)
- **excluded**: Remove themes from registry completely

All override fields replace auto-fetched values entirely (no partial merge).

## GitHub API Rate Limits

- **Unauthenticated**: 60 requests/hour
- **Authenticated**: 5,000 requests/hour

To increase rate limits:

1. Create a GitHub personal access token
2. Set `GITHUB_TOKEN` environment variable or add to `config.json`
3. Never commit tokens to version control

## Validation

All JSON files have corresponding schemas:

```bash
# Validate config
jq -f config.schema.json config.json

# Validate overrides
jq -f overrides.schema.json overrides.json

# Validate themes output
jq -f themes.schema.json themes.json
```

## Using with Plugin

Update plugin configuration:

```lua
require("lazy_theme_browser").setup({
  index = {
    source = "https://raw.githubusercontent.com/yourusername/nvim-theme-registry/main/themes.json"
  }
})
```

## Development

### Requirements

- Python 3.6+
- jsonschema (optional, for validation)
  ```bash
  pip install jsonschema
  ```

### Usage

```bash
# Basic usage with default config
python3 scripts/fetch_themes.py

# Custom config file
python3 scripts/fetch_themes.py -c my-config.json

# Override topics from command line
python3 scripts/fetch_themes.py -t neovim-colorscheme

# Dry run without writing output
python3 scripts/fetch_themes.py --dry-run

# Verbose output
python3 scripts/fetch_themes.py -v

# Combine options
python3 scripts/fetch_themes.py -c config.json -t nvim-theme --per-page 50 -n -v

# Disable automatic variant detection
python3 scripts/fetch_themes.py --no-detect-variants
```

### CLI Options

```
-c, --config CONFIG          Path to configuration file (default: config.json)
-o, --output OUTPUT          Output file path (overrides config.output_path)
-t, --topics TOPICS          GitHub topics to fetch (overrides config.topics)
--max-pages MAX_PAGES          Maximum pages per topic (overrides config.max_pages)
--per-page PER_PAGE           Results per page (overrides config.per_page)
--sort-by FIELD            Sort field: stars, updated (overrides config.sort_by)
--sort-order ORDER          Sort order: desc, asc (overrides config.sort_order)
-n, --dry-run                Validate and process without writing output file
-v, --verbose                Verbose output with detailed information
--no-detect-variants        Disable automatic variant detection from colors/ directory
-h, --help                   Show help message
```

### Variant Detection

The script automatically detects variants by checking for a `colors/` directory in the theme repository. If found, it parses files as theme variants.

**Themes with variants (examples):**
- nightfox - nightfox, dayfox, duskfox, nordfox, terafox
- rose-pine - rose-pine, rose-pine-dawn, rose-pine-moon, rose-pine-main
- catppuccin - catppuccin-latte, -frappe, -macchiato, -mocha

To disable automatic detection, use `--no-detect-variants` flag.

## Contributing

1. Add themes via `overrides.json`
2. Fix metadata errors in `overrides.json`
3. Exclude broken themes in `excluded` array
4. Submit pull request with changes

## License

MIT
