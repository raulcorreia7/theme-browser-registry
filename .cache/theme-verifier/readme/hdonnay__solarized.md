# Solarized for Neovim

This is a port of [solarized] for Neovim.

Lightly tested on neovim `0.9.5` and `0.10.0`.

## Installation

```
(
    d=$HOME/.local/share/nvim/site/pack/themes/opt
    mkdir -p $d && cd $d
    git clone https://github.com/hdonnay/solarized.git
)
```

The theme `solarized` should be available for use with `:colorscheme`.

## Configuration

To configure the color scheme, it must be loaded manually or a derivative color
scheme created. For example, given this lua file:

```lua
-- ~/.config/nvim/colors/my-solarized.lua
vim.cmd.packadd('solarized')
require('solarized').init {
  force_sync = false,
  disable_format = { 'bold', 'italic' },
}
```

Then `:colorscheme my-solarized` would load the color scheme without bold and
italic formatting attributes.

See the annotations in the lua for the valid configuraiton options.

## Choices

- Only uses the terminal colors.

## Improvements

- There may be some colors hard-coded for the dark variant.
- More modules welcome.

[solarized]: https://github.com/altercation/solarized
