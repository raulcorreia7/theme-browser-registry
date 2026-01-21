# Contributing

Guide for contributing to the nvim-theme-registry.

## How to Add Themes

### Method 1: Manual Override (Recommended for specific themes)

Edit `overrides.json`:

```json
{
  "overrides": [
    {
      "name": "your-theme",
      "repo": "yourusername/your-theme.nvim",
      "colorscheme": "yourtheme",
      "tags": ["dark"],
      "deps": ["nvim-treesitter/nvim-treesitter"],
      "variants": [
        {
          "name": "Your Theme Light",
          "colorscheme": "yourtheme-light",
          "tags": ["light"]
        }
      ]
    }
  ],
  "excluded": []
}
```

### Method 2: Add GitHub Topic

Add the topic to the theme's GitHub repository, then update `config.json`:

```json
{
  "topics": ["neovim-colorscheme", "nvim-theme", "your-custom-topic"]
}
```

Regenerate the registry:

```bash
lua scripts/fetch_themes.lua config.json
```

## How to Fix Theme Metadata

If auto-fetched metadata is incorrect, add an override in `overrides.json`:

```json
{
  "overrides": [
    {
      "repo": "owner/theme.nvim",
      "colorscheme": "correct-scheme-name",
      "tags": ["dark", "minimal"],
      "deps": ["required/plugin"]
    }
  ],
  "excluded": []
}
```

Only the fields you specify will be replaced. Auto-fetched fields remain unchanged unless you override them.

## How to Remove Themes

Add to `excluded` array in `overrides.json`:

```json
{
  "overrides": [],
  "excluded": [
    "broken/theme.nvim",
    "deprecated/old-theme"
  ]
}
```

## Override Guidelines

### When to Use Overrides

- **Add missing metadata**: deps, variants, tags
- **Fix incorrect metadata**: wrong colorscheme name, missing deps
- **Add themes**: themes not found via topics
- **Exclude themes**: broken, deprecated, or low-quality themes

### Override Best Practices

1. **Match exact repo format**: Use `owner/repo` for matching
2. **Be specific**: Override only the fields that need changes
3. **Document changes**: Add comments in pull requests
4. **Test locally**: Run fetch script before submitting
5. **Validate**: Check output against schema

## Adding Variants

Variants are useful for themes with multiple color schemes:

```json
{
  "overrides": [
    {
      "name": "example-theme",
      "repo": "owner/example-theme.nvim",
      "colorscheme": "example",
      "variants": [
        {
          "name": "Example Dark",
          "colorscheme": "example-dark",
          "tags": ["dark"]
        },
        {
          "name": "Example Light",
          "colorscheme": "example-light",
          "tags": ["light"]
        },
        {
          "name": "Example Sepia",
          "colorscheme": "example-sepia",
          "tags": ["sepia", "warm"]
        }
      ]
    }
  ]
}
```

## Dependencies

Add required plugin dependencies:

```json
{
  "overrides": [
    {
      "repo": "owner/theme.nvim",
      "deps": [
        "nvim-treesitter/nvim-treesitter",
        "nvim-lualine/lualine.nvim"
      ]
    }
  ]
}
```

The plugin will ensure these are installed before loading the theme.

## Tags

Use standard tags for consistency:

### Theme Type
- `dark`: Dark background themes
- `light`: Light background themes
- `high-contrast`: High contrast themes

### Style
- `minimal`: Minimalist themes
- `classic`: Traditional color schemes
- `forest`: Green/nature-inspired themes
- `ocean`: Blue/sea-inspired themes
- `warm`: Warm-colored themes

### Features
- `tree-sitter`: Optimized for TreeSitter
- `lsp`: Optimized for LSP highlighting
- `diagnostics`: Special diagnostic colors
- `popular`: Highly popular themes

## Testing Changes Locally

1. Clone the registry:
   ```bash
   git clone https://github.com/yourusername/nvim-theme-registry
   cd nvim-theme-registry
   ```

2. Install dependencies (optional, for validation):
   ```bash
   pip install jsonschema
   ```

3. Make your changes to `overrides.json`

4. Test the fetch script:
   ```bash
   # Basic run
   python3 scripts/fetch_themes.py

   # Dry run to validate without writing
   python3 scripts/fetch_themes.py --dry-run

   # Verbose mode for debugging
   python3 scripts/fetch_themes.py --verbose
   ```

5. Validate the output:
   ```bash
   # Using Python jsonschema (recommended)
   python3 -c "from jsonschema import validate; import json; validate(instance=json.load(open('themes.json')), schema=json.load(open('themes.schema.json')))"

   # Using jq (alternative)
   jq -f themes.schema.json themes.json
   ```

6. Check your theme in the output:
   ```bash
   jq '.[] | select(.repo == "owner/theme.nvim")' themes.json
   ```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-change`
3. Edit `overrides.json` with your changes
4. Test locally (see above)
5. Commit changes: `git commit -am "Add theme: your-theme"`
6. Push to fork: `git push origin feature/your-change`
7. Open pull request

### PR Title Format

- Add theme: `theme-name`
- Fix metadata: `owner/theme-name`
- Remove theme: `owner/theme-name`
- Exclude: `owner/theme-name`
- Update: add/update/remove descriptions

Examples:
- `Add theme: cyberpunk.nvim`
- `Fix metadata: folke/tokyonight.nvim`
- `Remove: broken/old-theme.nvim`

## Common Issues

### Theme Not Found After Adding

Check that the `repo` field matches exactly:
- Correct: `"folke/tokyonight.nvim"`
- Incorrect: `"folke/tokyonight"` (missing `.nvim`)

### Override Not Applied

Ensure:
1. Repo format is correct (`owner/repo`)
2. JSON is valid (no trailing commas)
3. File is saved and committed

### Validation Errors

Validate your override JSON:
```bash
jq -f overrides.schema.json overrides.json
```

## GitHub API Rate Limits

If you encounter rate limit errors:

1. Set `GITHUB_TOKEN` environment variable
2. Or add to `config.json` (don't commit tokens)
3. Increase `rate_limit_delay` in config

## Questions or Issues

Open an issue on GitHub with:
- Theme name and repo
- Expected behavior
- Actual behavior
- Steps to reproduce
