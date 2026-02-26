# My custom colorscheme.
## Rationale
I have a script that manages all my tools' palette. For this reason, I wanted a colorscheme
that changed accordingly too. This accomplishes just that, while also never changing
the actual colorscheme: the color "green" will change, but what is displayed as "green" will not.

## How to use
To use this, you have to call setup with a lua path to you palette: if your palette
is in `$XDG_CONFIG_HOME/nvim/lua/config/palette.lua`, then (using lazy.nvim) you would call
```lua
return {
    "https://codeberg.org/davidegreco/custom16",
    lazy = false,
    priority = 1000,
    opts = {
        palette_path = "config.palette",
    },
},
```

Here is an example of a palette:
```lua
-- must return the palette
return {
    -- base 16 colors
    main = {
        "#141410",
        "#cc241d",
        "#98971a",
        "#d79921",
        "#458588",
        "#b16286",
        "#24837b",
        "#d5c18e",

        "#282828",
        "#792329",
        "#98971a",
        "#d65d0e",
        "#7daea3",
        "#8f3f71",
        "#689d6a",
        "#ebdbb2",
    },
    extras = {
        accent         = "#24837b", -- used to display some things like current line nr, LSP server..
        inactivelinenr = "#877b5b", -- color for numbers other than current line
        comment = "#746a4f",        -- comments color
        split = "#9b8d67",          -- color for split separator
        cursorline = "#15221c",     -- color for cursorline. I like to set it same as accent, but dimmed
    }
}
```

Note that this supports hot reloading, so if you change the palette and then set again the colorscheme (e.g. `:colorscheme custom16<CR>`), it will update the colors immediately.
