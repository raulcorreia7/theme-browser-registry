# repl69

Monochrome colorscheme with decent accents for neovim.

## Getting started

Setup with basic configuration:

```lua
require("repl69").setup()
vim.cmd("colorscheme repl69")
```

### [lazy.nvim](https://lazy.folke.io/installation)

```lua
-- lua/plugins/colorscheme.lua
return {
  {
    "repl6669/repl69",
    name = "repl69",
    lazy = false,
    priority = 1000,
  },

  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "repl69",
    },
  }
}
```

## Screenshots

![repl69 colorscheme preview 01](images/repl69_01.png)
![repl69 colorscheme preview 02](images/repl69_02.png)
![repl69 colorscheme preview 03](images/repl69_03.png)
![repl69 colorscheme preview 04](images/repl69_04.png)

## Options

```lua
require("repl69").setup({
    -- Core settings
    transparent = false,
    terminal_colors = true,

    -- Styling options
    styles = {
        comments = { italic = true },
        keywords = { bold = true },
        functions = { bold = true },
        variables = {},
    },

    -- Plugin support
    plugins = {
        auto = true,  -- Auto-detect and enable installed plugins
        -- Or enable specific plugins:
        -- telescope = true,
        -- cmp = true,
        -- treesitter = true,
    },

    -- Legacy support
    enable = {
        -- Set terminal colors (legacy)
        terminal = true,
    },

    -- Custom highlight overrides
    on_highlights = function(highlights, colors)
        -- Override specific highlights
        -- highlights.Comment = { fg = colors.gray600, italic = true }
    end,
})

vim.cmd("colorscheme repl69")
```

## Plugins

`repl69` has evolved to support a comprehensive ecosystem of popular Neovim plugins, providing consistent theming across your entire workflow. The plugin system automatically detects installed plugins and applies appropriate highlights.

### Auto-detection

```lua
require("repl69").setup({
    plugins = {
        auto = true,  -- Automatically detect and style installed plugins
    }
})
```

### Manual Configuration

```lua
require("repl69").setup({
    plugins = {
        -- Core editing
        telescope = true,
        cmp = true,
        treesitter = true,

        -- Modern tools
        blink = true,
        flash = true,
        aerial = true,

        -- Development
        dap = true,
        gitsigns = true,
        neotest = true,

        -- UI enhancements
        alpha = true,
        noice = true,
    }
})
```

For a complete list of supported plugins and detailed configuration options, see [PLUGINS.md](docs/PLUGINS.md).

## Credits

- Architecture inspiration from [@folke](https://github.com/folke) and [tokyonight.nvim](https://github.com/folke/tokyonight.nvim)
- Initially inspired by [presto.vim](https://github.com/ewilazarus/preto/blob/master/colors/preto.vim)
