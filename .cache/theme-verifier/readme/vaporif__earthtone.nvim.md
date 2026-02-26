# earthtone.nvim

A warm, natural colorscheme for Neovim — light & dark.

Most themes optimize for looking good in screenshots. earthtone optimizes for staring at code all day — natural material colors (terracotta, moss, sandstone, driftwood) on warm backgrounds. Our eyes have been looking at dirt, leaves, and rocks for a few million years, so these are easy to process for hours. Distinct enough to tell your keywords from your strings, muted enough to stay comfortable.

Inspired by [everforest](https://github.com/sainnhe/everforest) — earthtone takes the same gentle approach but shifts warmer (parchment bg instead of green-gray, clay/amber syntax instead of botanical greens) and adds per-language tuning for Rust, TypeScript, Go, Python, C/C++, Lua, Nix, Bash, JSON, and YAML.
<img width="1717" height="1053" alt="Screenshot 2026-02-15 at 12 23 12" src="https://github.com/user-attachments/assets/8acef1ae-4e30-428c-b66e-8e7298855e34" />
<img width="1714" height="1053" alt="Screenshot 2026-02-15 at 12 24 10" src="https://github.com/user-attachments/assets/217c1de6-828b-4cc4-a2a2-937464ce2d11" />


## Install

### [lazy.nvim](https://github.com/folke/lazy.nvim)

```lua
{
  'vaporif/earthtone.nvim',
  lazy = false,
  priority = 1000,
  config = function()
    require('earthtone').setup({
      -- Your config here
    })
  end,
}
```

### Dark variant

```lua
{
  'vaporif/earthtone.nvim',
  lazy = false,
  priority = 1000,
  config = function()
    require('earthtone').setup({ background = 'dark' })
  end,
}
```

### Lualine

```lua
require('lualine').setup {
  options = { theme = 'earthtone' },
}
```

## Configuration

`setup()` accepts options and loads the colorscheme automatically.

```lua
require('earthtone').setup({
  background = 'auto',  -- 'light', 'dark', or 'auto' (default)
  palette = {},          -- override individual palette colors
  overrides = {},        -- override highlight groups
})
```

| Option | Default | Description |
|--------|---------|-------------|
| `background` | `'auto'` | `'light'`, `'dark'`, or `'auto'` (follows `vim.o.background`) |
| `palette` | `{}` | Merge overrides into the selected palette |
| `overrides` | `{}` | Override highlight groups after all groups are applied |

## Palette

### Light (`#e8dcc6` background)

| Name | Hex | Role |
|------|-----|------|
| `bg` | `#e8dcc6` | Background |
| `fg` | `#3e474d` | Foreground |
| `keyword_warm` | `#ae5418` | Keywords |
| `function_deep` | `#264d8a` | Functions |
| `type_deep` | `#1c9047` | Types |
| `rosewood` | `#6e3a7a` | Constants, numbers |
| `moss` | `#42632a` | Strings |
| `charcoal` | `#534241` | Operators |
| `driftwood` | `#565047` | Variables |
| `plum` | `#8c3f65` | Macros |
| `coral` | `#a03935` | Errors |
| `toffee` | `#725926` | Warnings |
| `olive` | `#607530` | Success |

### Dark (`#2b2826` background)

| Name | Hex | Role |
|------|-----|------|
| `bg` | `#2b2826` | Background |
| `fg` | `#d3c6aa` | Foreground |
| `keyword_warm` | `#c08a64` | Keywords |
| `function_deep` | `#6d9ab5` | Functions |
| `type_deep` | `#7bab94` | Types |
| `rosewood` | `#b28388` | Constants, numbers |
| `moss` | `#8da47a` | Strings |
| `charcoal` | `#9c8b89` | Operators |
| `driftwood` | `#8aa89e` | Variables |
| `plum` | `#a88596` | Macros |
| `coral` | `#d07574` | Errors |
| `toffee` | `#c9a56c` | Warnings |
| `olive` | `#a0b26e` | Success |

Override palette colors or highlight groups via `setup()`:

```lua
require('earthtone').setup({
  background = 'dark',
  palette = { bg = '#1e1c1a' },
  overrides = { Comment = { fg = '#8a9a8e', italic = false } },
})
```

## Plugin support

blink.cmp, diffview, flash, fzf-lua, gitsigns, lazy, lualine, neo-tree, neotest, noice, nvim-dap/dap-ui, nvim-ufo, render-markdown, telescope, todo-comments, trouble, which-key, yanky

Full LSP support (semantic tokens, inlay hints, diagnostics) and treesitter coverage with per-language overrides.

## Extras

Terminal and system themes in `extras/`:
- **WezTerm (light)** — copy `extras/wezterm.toml` to `~/.config/wezterm/colors/earthtone.toml`
- **WezTerm (dark)** — copy `extras/wezterm_dark.toml` to `~/.config/wezterm/colors/earthtone-dark.toml`
- **Base16 (light)** — `extras/base16-earthtone-light.toml` (for Stylix, base16-shell, etc.)
- **Base16 (dark)** — `extras/base16-earthtone-dark.toml`

## Development

```bash
just setup-hooks    # enable git hooks
just check          # selene + stylua + typos + actionlint
just validate       # test colorscheme loads in headless nvim
just fmt            # format lua
```

CI runs `just check` and `just validate` on push/PR via GitHub Actions.

## Requirements

Neovim >= 0.9.0

## License

MIT
