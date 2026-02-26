# Installation

[lazy.nvim](https://github.com/folke/lazy.nvim)

```lua
{
    "Manicharan01/mdr.nvim",
    lazy = false,
    priority = 1000,
    config = function()
        require("mdr").setup()
    end
}
```

[packer.nvim](https://github.com/wbthomason/packer.nvim)

```lua
use {
    "Manicharan01/mdr.nvim",
    config = function()
        require("mdr").setup()
    end
}
```

# Usage

```vim
:colorscheme mdr
```
