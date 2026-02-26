# 👽 lipoide.nvim
![image](https://github.com/FelipeIzolan/lipoide.nvim/assets/80170121/379236a5-184a-44e0-9b21-103d2eb69c58)

## 🚀 Installation 
```lua
-- lazy.nvim
{ 'FelipeIzolan/lipoide.nvim' }
-- or
{ 
  'FelipeIzolan/lipoide.nvim',
  dependencies = { 'nvim-treesitter/nvim-treesitter' },
  config = function()
    require("lipoide").setup({
      transparent = false, -- boolean
      transparent_column = false, -- boolean
      comment_italic = false -- boolean
    })
  end
}
```

## ✨ Usage

```lua
:colorscheme lipoide
vim.cmd("colorscheme lipoide")
```

## 🔗 Compatibility

- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)
- [netrw](https://neovim.io/doc/user/pi_netrw.html)
- [lazy.nvim](https://github.com/folke/lazy.nvim)
- [nvim-tree](https://github.com/nvim-tree/nvim-tree.lua)
- [indentmini.nvim](https://github.com/nvimdev/indentmini.nvim)
