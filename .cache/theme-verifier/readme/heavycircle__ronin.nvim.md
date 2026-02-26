# ronin.nvim — Masked Ronin colorscheme

A dark [Neovim](https://github.com/neovim/neovim) theme written in Lua.

![Ronin Sample](https://github.com/user-attachments/assets/7da2e094-63f1-4c07-ad09-7fc4303f628d)

## Features

- Support for the [latest](https://github.com/neovim/neovim/releases/tag/latest) Neovim features.
- Terminal colors.
- [Easy Configuration](https://github.com/heavycircle/dotfiles) with other applications.

<details>
<summary>Supported Plugins</summary>

| **Plugin**                                                            | **Support**                                      |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| [blink.cmp](https://github.com/saghen/blink.cmp)                      | [`blink`](lua/ronin/plugins/blink.lua)           |
| [nvim-cmp](https://github.com/hrsh7th/nvim-cmp)                       | [`cmp`](lua/ronin/plugins/cmp.lua)               |
| [dashboard-nvim](https://github.com/nvimdev/dashboard-nvim)           | [`dashboard`](lua/ronin/plugins/dashboard.lua)   |
| [gitsigns.nvim](https://github.com/lewis6991/gitsigns.nvim)           | [`gitsigns`](lua/ronin/plugins/gitsigns.lua)     |
| [lualine.nvim](https://github.com/nvim-lualine/lualine.nvim)          | [`lualine`](lua/ronin/plugins/lualine.lua)       |
| [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim)    | [`telescope`](lua/ronin/plugins/telescope.lua)   |
| [treesitter.nvim](https://github.com/nvim-treesitter/vnim-treesitter) | [`treesitter`](lua/ronin/plugins/treesitter.lua) |

</details>

## Install

### Using lazy.nvim

```lua
{
  "heavycircle/ronin.nvim",
  lazy = false, priority = 1000,
  opts = {},
}
```

### Using `vim.pack` (Neovim 0.12.0 - Nightly)

```lua
vim.pack.add({
    { src = "https://github.com/heavycircle/ronin.nvim" }
})

require("ronin").setup()
vim.cmd.colorscheme("ronin")
```

## Usage

```lua
vim.cmd.colorscheme "ronin"
```

## Default Configuration

```lua
---@class ronin.Config
M.defaults = {
    transparent = false,                    -- Use a transparent background
    styles = {
        comments = { italic = true },       -- Comments are italic
        keywords = { italic = true },       -- Functions are italic
        functions = {},
        variables = {},
    },
    plugins = {
        all = false,                        -- Enable all plugin support with 'all = true'
        lualine = true,                     -- Enable individual plugin support
    }
}
```

## Contributing

_Pull requests are welcome._

Plugins that I don't use aren't on the priority list for me to do, so integrations of other plugins would be greatly appreciated!

---

MIT © heavycircle
