# binary.nvim

A over-minimal Neovim color scheme using **only two colors** for a plain text editor experience.

![binary](https://github.com/user-attachments/assets/ae43318c-28a1-4a16-80ae-3c7e1893f5d1)

Check [here](https://github.com/jackplus-xyz/binary.nvim/discussions/2) for inspirations!

> [!WARNING]
> This is an extreme color scheme that:
>
> - Eliminates ALL colors
> - Removes ALL font styles

> [!TIP]
> If you are not sure if you have the strength, consider:
>
> - Neovim's built-in `quiet` color scheme
> - Checking [vim-no-color-collections](https://github.com/mcchrish/vim-no-color-collections) for alternatives

## Features

- Uses only foreground and background colors
  - No syntax highlighting
  - No special highlighting for diagnostics, search results, or UI elements

## Installation

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
    "jackplus-xyz/binary.nvim",
    opts = {
        -- Add your configuration here
    }
}
```

## Configuration

`binary.nvim` comes with the following default configuration:

```lua
{
  style = "system", -- Theme style: "system" | "light" | "dark"
  colors = {        -- Colors used for the "light" theme; reversed automatically for "dark"
    fg = "#000000", -- Foreground color
    bg = "#ffffff", -- Background color
  },
  use_default_reversed_group = true, -- Use the default `reversed_group` for a better startup experience
  reversed_group = {}, -- Highlight groups with reversed `fg` and `bg` (e.g., `Search`, `Visual`)
}
```

The default reversed_group includes commonly used highlight groups, with `fg` and `bg` reversed for better visibility:

```lua
-- default reversed_group
{
  -- Editor UI
  Cursor = true,
  IncSearch = true,
  MatchParen = true,
  PmenuSel = true,
  QuickFixLine = true,
  Search = true,
  Substitute = true,
  TabLineSel = true,
  TermCursor = true,
  TermCursorNC = true,
  Visual = true,
  VisualNOS = true,
  WildMenu = true,

  -- LSP
  LspReferenceText = true,
  LspReferenceRead = true,
  LspReferenceWrite = true,
  LspSignatureActiveParameter = true,

  -- Telescope
  TelescopePromptTitle = true,
  TelescopePreviewTitle = true,
  TelescopeResultsTitle = true,
  TelescopeSelection = true,
  TelescopeSelectionCaret = true,
}
```

**Example configuration with `lazy.nvim`:**

```lua
require("lazy").setup({
  {
    "jackplus-xyz/binary.nvim",
    opts = {
      style = "light",
      colors = {
        fg = "#FFB400",
      },
      -- Customize the reversed groups
      reversed_group = {
        Title = true,  -- Add a new reversed group
        Search = false, -- Disable a default reversed group
      },
    },
  },
})
```

## Usage

Once installed, simply set the color scheme in your Neovim configuration:

```
vim.cmd("colorscheme binary")
```

You can dynamically change the style and colors by updating the configuration:

```lua
require("binary").setup({
  style = "dark",
  colors = {
    fg = "#ffffff",
    bg = "#000000",
  },
})
```

## How it works

`binary.nvim` brute force a two-color scheme by:

1. Overrides all highlight groups to use only the configured `fg` and `bg`.
2. Allows selected groups to reverse their colors for improved readability.
3. Adapts to different styles (light or dark) by swapping fg and bg.

## Credits

- [zenbones-theme/zenbones.nvim](https://github.com/zenbones-theme/zenbones.nvim): A collection of calming color schemes, including my favorite daily driver: `zenwritten`.
- [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim?tab=readme-ov-file): A clean and super well maintained color scheme, where I learn how to setup the project.
- [vim-no-color-collections](https://github.com/mcchrish/vim-no-color-collections): A collection of color schemes with minimal colors.
- [Swordfish90/cool-retro-term](https://github.com/Swordfish90/cool-retro-term): A retro terminal emulator which was the inspiration of this plugin.

## License

MIT
