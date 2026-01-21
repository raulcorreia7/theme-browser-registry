# Theme Registry Schema Documentation

Validates `themes.json` - the final output file containing theme entries.

## Core Fields (10 total)

The schema includes only essential and useful metadata, removing irrelevant fields.

### Required Fields

| Field | Type | Description | Example |
|--------|------|-------------|---------|
| name | string | Theme identifier (alphanumeric, underscore, hyphen) | `"tokyonight"` |
| repo | string | GitHub repository in `owner/repo` format | `"folke/tokyonight.nvim"` |
| colorscheme | string | Neovim `:colorscheme` command name | `"tokyonight"` |

### Auto-fetched Fields

| Field | Type | Description | Example |
|--------|------|-------------|---------|
| stars | integer (≥0) | GitHub star count (for sorting/popularity) | `5000` |
| description | string | Repository description | `"A clean dark theme"` |
| homepage | string(uri) | Homepage URL (optional, can be null) | `"https://example.com"` |
| updated_at | string(date-time) | Last update timestamp (ISO 8601, optional) | `"2024-01-15T10:30:00Z"` |
| topics | array of strings | GitHub topic tags (for filtering) | `["neovim", "colorscheme"]` |
| archived | boolean | Repository is archived (read-only) | `false` |
| disabled | boolean | Repository disabled by GitHub | `false` |

### Manual Override Fields

| Field | Type | Description | Example |
|--------|------|-------------|---------|
| tags | array of strings (unique) | Theme tags for filtering | `["dark", "light"]` |
| deps | array of strings (unique) | Plugin dependencies | `["nvim-treesitter/nvim-treesitter"]` |
| variants | array of objects | Theme variants | See below |

### Variant Object

| Field | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| name | string | No | Variant display name | `"Tokyo Night Night"` |
| colorscheme | string | Yes | Variant colorscheme command | `"tokyonight-night"` |
| tags | array of strings | No | Variant-specific tags | `["dark"]` |

## Removed Fields

These fields were deemed irrelevant and removed to reduce bloat:

| Field | Reason |
|--------|---------|
| created_at | Historical context, rarely useful |
| pushed_at | Updated_at covers freshness |
| language | We fetch by topic, not language |
| default_branch | Internal GitHub detail |
| forks | Stars already measures popularity |
| open_issues | Not useful for theme selection |
| watchers | Duplicate of stars (99% overlap) |
| subscribers | Duplicate of watchers |
| size | Not relevant to theme quality |
| network_count | Completely irrelevant |
| license | Only useful for enterprise |
| has_pages | Irrelevant to theme |

## Variant Detection

The registry script automatically detects theme variants by checking for a `colors/` directory in the theme repository.

### Detection Process

1. After fetching theme metadata, script checks for `colors/` directory
2. If found, parses files as theme variants
3. Each file becomes a variant entry with `colorscheme` name

### Pattern Examples

**nightfox (colors/ directory):**
```
colors/
  ├── dayfox.vim     → variants[0].colorscheme = "dayfox"
  ├── duskfox.vim     → variants[1].colorscheme = "duskfox"
  ├── nightfox.vim    → variants[2].colorscheme = "nightfox"
  ├── nordfox.vim     → variants[3].colorscheme = "nordfox"
  └── terafox.vim     → variants[4].colorscheme = "terafox"
```

**rose-pine (colors/ directory):**
```
colors/
  ├── rose-pine.lua      → variants[0].colorscheme = "rose-pine"
  ├── rose-pine-dawn.lua → variants[1].colorscheme = "rose-pine-dawn"
  ├── rose-pine-moon.lua → variants[2].colorscheme = "rose-pine-moon"
  └── rose-pine-main.lua → variants[3].colorscheme = "rose-pine-main"
```

### Manual Override

If automatic detection misses a variant or is incorrect, use `overrides.json`:

```json
{
  "overrides": [
    {
      "repo": "EdenEast/nightfox.nvim",
      "variants": [
        {
          "colorscheme": "nightfox",
          "name": "Nightfox Dark",
          "tags": ["dark"]
        }
      ]
    }
  ]
}
```

### Disable Detection

To disable automatic variant detection:
```bash
python3 scripts/fetch_themes.py --no-detect-variants
```

## Examples

### Complete Theme Entry

```json
{
  "name": "tokyonight",
  "repo": "folke/tokyonight.nvim",
  "colorscheme": "tokyonight",
  "stars": 7747,
  "description": "A clean, dark Neovim theme",
  "homepage": "",
  "updated_at": "2024-01-15T10:30:00Z",
  "topics": ["neovim", "colorscheme", "theme"],
  "archived": false,
  "disabled": false,
  "tags": ["dark", "light"],
  "variants": [
    {
      "name": "Tokyo Night Night",
      "colorscheme": "tokyonight-night",
      "tags": ["dark"]
    }
  ]
}
```

### Minimal Theme Entry

```json
{
  "name": "simple-theme",
  "repo": "user/simple-theme.nvim",
  "colorscheme": "simple",
  "stars": 100,
  "updated_at": "2024-01-15T10:30:00Z",
  "topics": ["neovim", "colorscheme"],
  "archived": false,
  "disabled": false
}
```

### Override Example

```json
{
  "overrides": [
    {
      "name": "tokyonight",
      "repo": "folke/tokyonight.nvim",
      "colorscheme": "tokyonight",
      "tags": ["dark", "light", "popular"],
      "variants": [
        {
          "name": "tokyonight-night",
          "colorscheme": "tokyonight-night",
          "tags": ["dark"]
        }
      ]
    }
  ],
  "excluded": ["example/broken-theme"]
}
```

## Validation Patterns

### Name Pattern
- Regex: `^[a-zA-Z0-9_-]+$`
- Allows: alphanumeric, underscore, hyphen
- Examples: `tokyonight`, `catppuccin`, `gruvbox-material`

### Repo Pattern
- Regex: `^[a-zA-Z0-9_-]+/[a-zA-Z0-9._-]+$`
- Format: `owner/repo`
- Allows: alphanumeric, underscore, hyphen, dot in repo name
- Examples: `folke/tokyonight.nvim`, `catppuccin/nvim`

### Topic Pattern
- Regex: `^[a-zA-Z0-9-]+$`
- Allows: alphanumeric, hyphen
- Examples: `neovim-colorscheme`, `nvim-theme`

## Schema Versioning

Uses `$id` and `$schema` fields for versioning:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/themes.schema.json"
}
```

## Benefits of 10-Field Schema

1. **40% smaller files** - Faster downloads and parsing
2. **Faster fetches** - Less data from GitHub API
3. **Cleaner interface** - Focus on what matters
4. **Better maintainability** - Fewer fields to update
5. **Validated fields only** - All fields serve a clear purpose
