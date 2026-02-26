# persona5.nvim

**A Neovim colorscheme inspired by Persona 5's calling card**

[日本語READMEはこちら](./README.ja.md)

![Persona 5 Theme](https://img.shields.io/badge/Persona%205-Theme-E60012?style=for-the-badge)
> *"We will take your distorted desires without fail."*

## Installation

### lazy.nvim

```lua
{
  "r7sqtr/persona5.nvim",
  lazy = false,
  priority = 1000,
  opts = {
    transparent = true, -- Enable background transparency
  }
}
```

### packer.nvim

```lua
use {
  "r7sqtr/persona5.nvim",
  config = function()
    require("persona5").load()
  end,
}
```

### Transparency Settings
Background transparency is enabled by default.

```lua
require("persona5").setup({
  transparent = true,
})
```
---

**"Take Your Heart!"** 🎭
