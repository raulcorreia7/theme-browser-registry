# nami.nvim

A dark Neovim colorscheme inspired by ocean waves at sunset. Deep blue-black depths meet vibrant teal, coral, and sunset orange.

![nami.nvim preview](https://github.com/josstei/nami.nvim/assets/preview.png)

## Features

- TreeSitter and LSP semantic token support
- Plugin integrations (Telescope, nvim-tree, GitSigns, nvim-cmp)
- Transparent background option
- Customizable syntax styles

## Installation

### lazy.nvim

```lua
{
  "josstei/nami.nvim",
  lazy = false,
  priority = 1000,
  config = function()
    require("nami").setup()
    vim.cmd.colorscheme("nami")
  end,
}
```

<details>
<summary>Other package managers</summary>

### packer.nvim

```lua
use {
  "josstei/nami.nvim",
  config = function()
    require("nami").setup()
    vim.cmd.colorscheme("nami")
  end
}
```

### vim-plug

```vim
Plug 'josstei/nami.nvim'
```

```lua
require("nami").setup()
vim.cmd.colorscheme("nami")
```

</details>

## Configuration

Defaults shown below:

```lua
require("nami").setup({
  transparent = false,
  dim_inactive = false,
  styles = {
    comments = { italic = true },
    keywords = { bold = false },
    functions = { bold = false },
    variables = {},
    types = {},
    strings = {},
  },
})
```

## Palette

| | Color | Hex | Role |
|---|-------|-----|------|
| ![#041220](https://placehold.co/16/041220/041220) | Background | `#041220` | Editor background |
| ![#e8dcc8](https://placehold.co/16/e8dcc8/e8dcc8) | Foreground | `#e8dcc8` | Text |
| ![#4fc9c9](https://placehold.co/16/4fc9c9/4fc9c9) | Teal | `#4fc9c9` | Strings |
| ![#ff7356](https://placehold.co/16/ff7356/ff7356) | Coral | `#ff7356` | Keywords |
| ![#ff9933](https://placehold.co/16/ff9933/ff9933) | Orange | `#ff9933` | Numbers |
| ![#ffcc55](https://placehold.co/16/ffcc55/ffcc55) | Yellow | `#ffcc55` | Functions |
| ![#7a9aca](https://placehold.co/16/7a9aca/7a9aca) | Blue | `#7a9aca` | Types |
| ![#5faf7f](https://placehold.co/16/5faf7f/5faf7f) | Green | `#5faf7f` | Booleans |
| ![#bb6b8b](https://placehold.co/16/bb6b8b/bb6b8b) | Purple | `#bb6b8b` | Special |
| ![#5dd9d9](https://placehold.co/16/5dd9d9/5dd9d9) | Cyan | `#5dd9d9` | Parameters |

## Plugin Support

Built-in highlights for:

- [Telescope](https://github.com/nvim-telescope/telescope.nvim)
- [nvim-tree](https://github.com/nvim-tree/nvim-tree.lua)
- [GitSigns](https://github.com/lewis6991/gitsigns.nvim)
- [nvim-cmp](https://github.com/hrsh7th/nvim-cmp)
- LSP diagnostics

<details>
<summary>Adding custom plugin support</summary>

```lua
require("nami").register_plugin("my_plugin", function(colors, config)
  return {
    MyPluginNormal = { fg = colors.palette.teal, bg = colors.palette.bg_alt },
    MyPluginBorder = { fg = colors.semantic.border },
  }
end)
```

</details>

## Advanced

<details>
<summary>Custom highlight overrides</summary>

```lua
require("nami").setup({
  on_highlights = function(colors, config)
    return {
      ["@comment.todo"] = { fg = colors.palette.orange, bold = true },
    }
  end,
})
```

</details>

<details>
<summary>API reference</summary>

| Function | Description |
|----------|-------------|
| `require("nami").setup(opts)` | Configure before loading |
| `require("nami").load()` | Load colorscheme |
| `require("nami").register_plugin(name, fn)` | Add plugin highlights |
| `require("nami").unregister_plugin(name)` | Remove plugin highlights |
| `require("nami").set_palette(name)` | Switch palettes |
| `require("nami").palettes()` | List available palettes |

</details>

<details>
<summary>Creating custom palettes</summary>

Create `lua/nami/palettes/<name>.lua`:

```lua
return {
  name = "my_palette",
  palette = {
    bg = "#041220",
    fg = "#e8dcc8",
    -- ... see lua/nami/palettes/nami.lua for full structure
  },
  semantic = {
    bg = "#041220",
    fg = "#e8dcc8",
    keyword = "#ff7356",
    -- ... see lua/nami/palettes/nami.lua for full structure
  },
}
```

Then:

```lua
require("nami").setup({ palette = "my_palette" })
```

</details>

## License

MIT
