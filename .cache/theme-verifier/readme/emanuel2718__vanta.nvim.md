<h1 align="center" style="font-size: 6rem;">
vanta.nvim
</h1>

<p align="center">
    <a href="#install">Install</a>
    ·
    <a href="#usage">Usage</a>
    ·
    <a href="#configuration">Configuration</a>
    ·
    <a href="#looks">Looks</a>
  </p>
</p>

<img width="1332" alt="Image" src="https://github.com/user-attachments/assets/aa79fdae-4d9f-4e0d-a315-921ec432c5c9" />

# Prerequisites

Neovim 0.8.0+

# Install

> [!Warning]
> This is nowhere near completion. Expect broken colors.

[lazy.nvim](https://github.com/folke/lazy.nvim)

```lua
{ "emanuel2718/vanta.nvim", priority = 1000, config = true, opts = ...  }
```

# Usage

```lua
-- neovim
vim.cmd.colorscheme("vanta")
```

# Configuration (Defaults)

```lua
require("vanta").setup({
  -- Enable terminal colors (recommended)
  terminal_colors = true,

  -- Style options
  undercurl = false,  -- Use undercurls for diagnostics and spellcheck
  underline = false,  -- Use underlines for references and matching words
  bold = true,        -- Use bold for headings, keywords, and UI elements

  -- Window appearance
  dim_inactive = false,  -- Dim text in inactive windows
  transparent = false,   -- Use transparent backgrounds

  -- Italic options
  italic = {
    strings = false,    -- Italicize strings
    comments = true,    -- Italicize comments
    operators = false,  -- Italicize operators
    emphasis = false,   -- Italicize emphasized text
    folds = true,       -- Italicize fold markers
  },
})
```
