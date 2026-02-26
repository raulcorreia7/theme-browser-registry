# Nano + Node → Nanode
Yet another colorscheme that aims to be beautiful, enjoyable, and comfortable for long sessions.

## Preview
![Code snippet of vimcolorschemes project](.docs/images/screenshot0.png)
![Rust preview (from piccolo project)](.docs/images/screenshot1.png)

## Features
- Balanced contrast ratio
- Enjoyable yet not dopamine-oriented
- Reduced visual pressure and loneliness

## Installation
- Ensure your Neovim supports Lua-based colorschemes (0.8+).
- Add the plugin via your preferred manager, e.g.

```lua
{
  "KijitoraFinch/nanode.nvim",
  priority = 1000,
  config = function()
    require("nanode").setup({
      transparent = false,
    })
    vim.cmd.colorscheme("nanode")
  end,
}
```
- Reload Neovim and run `:colorscheme nanode` if you skip the config block.

