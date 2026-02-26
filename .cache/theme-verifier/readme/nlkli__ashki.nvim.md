# Ashki Theme for Neovim

![Ashki Preview](https://github.com/nlkli/assetsrepo/blob/main/ashki.nvim/preview_rust.png)  

A minimal dark Neovim color scheme. Total black background.

## Installation

```lua
vim.pack.add({ "https://github.com/nlkli/ashki.nvim" })
require("ashki").setup()
require("ashki").load() -- or vim.cmd("colorscheme ashki")
```

### Using `lazy.nvim`

```lua
{
  "nlkli/ashki.nvim",
  lazy = false,
  priority = 1000,
  config = function()
    require("ashki").setup()
    require("ashki").load()
  end,
}
```

### Setup Params

```lua
require("ashki").setup({ 
    soft = 0, -- soft lvl 0..=2
    terminal = true, -- set terminal colors
    ak = "r", -- keyword color preset r|g|b|y|o|v|p
    colors = { -- set custom colors
        void = "#080705",
        cursor = "#E8E8DF",
        -- ...
    } 
})
```

![Ashki Preview Go](https://github.com/nlkli/assetsrepo/blob/main/ashki.nvim/preview_go.png)  

![Ashki Preview HTML](https://github.com/nlkli/assetsrepo/blob/main/ashki.nvim/preview_html.png)  

## Color Palette

| Name      | Hex       | Description                       |
|-----------|-----------|-----------------------------------|
| **Backgrounds** |           |                                   |
| void      | #000000   | Normal background                 |
| bg1       | #0D0D0D   | Main text background              |
| bg2       | #1F1D1A   | CursorLine / floating windows     |
| bg3       | #302D28   | Fold / popup / diff background   |
| visual    | #201E1A   | Visual selection                  |
| cursor    | #F0F7FA   | Cursor color                      |
| sline     | #4C4B49   | StatusLine background             |
| **Foreground Shades** |   |                                   |
| fg01      | #DCE9FB   | Light highlight text              |
| fg        | #CFCFCC   | Normal text                       |
| fg1       | #ABA9A8   | LineNr / CursorLineNr             |
| fg2       | #7A7775   | Fold / StatusLineNC               |
| fg3       | #494949   | Comments / NonText / EndOfBuffer |
| **Syntax Colors** |       |                                   |
| string    | #679CA2   | Strings                           |
| keyword   | #A94646   | Keywords                          |
| func      | #8E8EB4   | Functions                         |
| ttype     | #C8C3AB   | Types                             |
| const     | #86A1CF   | Constants                         |
| **Semantic / Special** |   |                                   |
| red       | #9E4941   | Red color                         |
| green     | #336C62   | Green color                       |
| yellow    | #D9B35B   | Yellow color                      |
| blue      | #748CAB   | Blue color                         |
| violet    | #61587A   | Violet color                      |
| pink      | #BA86A4   | Pink color                         |

