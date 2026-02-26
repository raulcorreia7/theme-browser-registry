# mithrandir

A clean, dark Neovim theme written in Lua, with support for some plugins.

Inspired by my custom Xcode theme.

## Install (lazy.nvim)

```lua
{
  "yourname/nvim-mithrandir",
  lazy = false,
  priority = 1000,
  opts = {
    transparent = false,
    italics = { comments = true, keywords = false, functions = false, variables = false },
    plugins = { treesitter = true, lsp = true, telescope = true, cmp = true, gitsigns = true },
  },
  config = function(_, opts)
    require("mithrandir").setup(opts)
    vim.cmd.colorscheme("mithrandir")
  end,
}
```

happy vimming!! :D
