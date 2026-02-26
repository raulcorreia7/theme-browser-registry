# black_electron.nvim

To use black_electron.nvim:

Lazy:
```lua
    "oneElectron/black_electron.nvim",
    lazy = false,
    priority = 1000,
    dependencies = { "rktjmp/lush.nvim" },
    config = function()
	    vim.cmd([[colorscheme black_electron]])
    end,
```

