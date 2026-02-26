# Atrolite

Atrolite is a desaturated, simplistic color scheme for NVim inspired by
the [Atropoeia pixel art palette](https://lospec.com/palette-list/atropoeia). It provides
basic integration with `lualine.nvim` and `nvim-tree`.

## Screenshot

![screenshot](./assets/demo.png)

## Installation

#### lazy.nvim 
```lua
{
  "vex-i/atrolite.nvim",
  lazy=false,
  priority=1000,
}
```

## Configuration
```lua 
require('atrolite').setup({
    transparent = true, --removes background
})
```

