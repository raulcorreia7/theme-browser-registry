# undefined.nvim

Dark colorscheme for neovim written in lua. Works with lsp, treesitter and lualine.

![undefined colorscheme](https://raw.githubusercontent.com/al3x-13/undefined.nvim/refs/heads/main/undefined.png)

__DISCLAIMER__: this was mostly vibe-coded.

## Installation

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  "al3x-13/undefined.nvim",
  lazy = false,
  priority = 1000,
  config = function()
    vim.cmd([[colorscheme undefined]])
  end,
}
```

Using [packer.nvim](https://github.com/wbthomason/packer.nvim):

```lua
use {
  "al3x-13/undefined.nvim",
  config = function()
    vim.cmd([[colorscheme undefined]])
  end,
}
```

## Configuration

The theme supports multiple variants and transparent backgrounds:

```lua
require("undefined").setup({
  variant = "base", -- "base", "darker", or "light"
  transparent_background = false,
})
```

### Variants

- `base` - Original dark theme with balanced contrast (default)
- `darker` - Darker variant for reduced eye strain
- `light` - Light theme for daytime use

### Switching Variants

You can switch between variants using commands:

```vim
:UndefinedVariant light  " Switch to light variant
:UndefinedVariant base   " Switch to base variant
:UndefinedVariant darker " Switch to darker variant
:UndefinedToggle         " Toggle between base and darker
```

Or programmatically:

```lua
require("undefined").set_variant("light")
```

## Lualine

To use the lualine theme:

```lua
require('lualine').setup {
  options = {
    theme = 'undefined'
  }
}
```
