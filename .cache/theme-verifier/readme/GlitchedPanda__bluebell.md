# Bluebell.nvim

![Preview](https://i.imgur.com/YWNs5Q3.png)

A nice and blue colorscheme for neovim.
## Installation

[lazy.nvim](https://github.com/folke/lazy.nvim)
```lua
{ "GlitchedPanda/bluebell", name = "bluebell", priority = 1000 }
```

[mini.deps](https://github.com/echasnovski/mini.nvim/blob/main/readmes/mini-deps.md)
```lua
add({ source = "GlitchedPanda/bluebell", name = "bluebell" })
```

[packer.nvim](https://github.com/wbthomason/packer.nvim)
```lua
use { "GlitchedPanda/bluebell", as = "bluebell" }
```

[vim-plug](https://github.com/junegunn/vim-plug)
```vim
Plug 'GlitchedPanda/bluebell', { 'as': 'bluebell' }
```

## Usage

```vim
colorscheme bluebell " bluebell-dark
```

```lua
vim.cmd.colorscheme "bluebell"
```

## Configuration

There is no need to call `setup` if you don't want to change the default options and settings.

```lua
require("bluebell").setup({
    flavour = "auto", -- dark
    background = { -- :h background
        light = "dark",
        dark = "dark",
    },
    transparent_background = false, -- disables setting the background color.
    float = {
        transparent = false, -- enable transparent floating windows
        solid = false, -- use solid styling for floating windows, see |winborder|
    },
    show_end_of_buffer = false, -- shows the '~' characters after the end of buffers
    term_colors = false, -- sets terminal colors (e.g. `g:terminal_color_0`)
    dim_inactive = {
        enabled = false, -- dims the background color of inactive window
        shade = "dark",
        percentage = 0.15, -- percentage of the shade to apply to the inactive window
    },
    no_italic = false, -- Force no italic
    no_bold = false, -- Force no bold
    no_underline = false, -- Force no underline
    styles = { -- Handles the styles of general hi groups (see `:h highlight-args`):
        comments = { "italic" }, -- Change the style of comments
        conditionals = { "italic" },
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
        -- miscs = {}, -- Uncomment to turn off hard-coded styles
    },
    color_overrides = {},
    custom_highlights = {},
    default_integrations = true,
    auto_integrations = false,
    integrations = {
        cmp = true,
        gitsigns = true,
        nvimtree = true,
        treesitter = true,
        notify = false,
        mini = {
            enabled = true,
            indentscope_color = "",
        },
    },
})

-- setup must be called before loading
vim.cmd.colorscheme "bluebell"
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
