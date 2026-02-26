# Ash

A dark theme for Neovim.

<img src="https://github.com/user-attachments/assets/b49e456d-559d-4fb8-b849-a4d985d617e1" />
<img src="https://github.com/user-attachments/assets/1538ef93-958f-48c2-a80c-4159a650b9c0" />

## Installation

[lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
    "drewxs/ash.nvim",
    lazy = false,
    priority = 1000,
}
```

[packer.nvim](https://github.com/wbthomason/packer.nvim):

```lua
use { "drewxs/ash.nvim" }
```

## Usage

lua:

```lua
vim.cmd([[colorscheme ash]])
```

## Configuration

Uses the following defaults:

```lua
{
    compile_path = vim.fn.stdpath("cache") .. "/ash",

    transparent = false, -- transparent background
    term_colors = false, -- terminal colors (e.g. g:terminal_color_x)
    no_italic = false, -- disable italics
    no_bold = false, -- disable bold
    no_underline = false, -- disable underlines

    -- override highlight groups [function/table]
    -- e.g. highlights = function(colors)
    --     return {
    --         Comment = { fg = colors.red },
    --         CmpBorder = { fg = colors.none },
    --     }
    -- end
    highlights = {},

    -- override style groups
    -- e.g. comments = { "italic", "bold" }
    styles = {
        comments = {},
        conditionals = {},
        loops = {},
        functions = {},
        keywords = {},
        strings = {},
        variables = {},
        numbers = {},
        booleans = {},
        properties = {},
        types = {},
        operators = {},
    },
}
```

## Contributions

Are welcome!

---

Credits for code structure: [Catppuccin](https://github.com/catppuccin/nvim)

[License](LICENSE), [License-MIT](LICENSE-MIT)
