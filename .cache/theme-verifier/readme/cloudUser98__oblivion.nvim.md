# oblivion.nvim

This is a port of gedit's Oblivion theme, originally created by Paolo Borelli, for Neovim using [lush.nvim](https://github.com/rktjmp/lush.nvim).

# Requirements
- Neovim v0.8.0

# Installation
Using packer.nvim

```lua
-- The colorscheme needs lush.nvim to work
use {
    "cloudUser98/oblivion.nvim",
    requires = "rktjmp/lush.nvim"
}
```

# Usage

From your init.lua:

```lua
vim.opt.termguicolors = true
vim.o.background = "dark"

vim.cmd("colorscheme oblivion.nvim")
```
