# circus_show.nvim

Inspired by Atom's One Dark, and subsequent [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) [variants](https://github.com/olimorris/onedarkpro.nvim/tree/main), circus_show attempts to preserve the colorful and easily distinguishable syntax highlighting with slight tweaks to improve readabililty and contrast.

<img width="910" height="846" alt="image" src="https://github.com/user-attachments/assets/3ef5dc4c-7769-4ed1-aac8-151195c43918" />

---
The color scheme may not be comprehensive, so language servers/treesitter grammars that rely on less common tokens may not be fully handled. Not many plugins are supported either.

Most things have been changed to one degree or another. To note a few:
 - Maintains a wide-ranging color palette to help distiguishing token types at a glance, while reducing direct color-to-color contrast. The palette has largely been tweaked so colors work better together;
 - Some types of tokens that are often used together were changed to use less similar colors compared to the original One Dark scheme. Some examples:
    - Documentation comments (e.g. `@class`, `@return`), as well as popular ad hoc annotations (e.g. `TODO`, `ERROR`, `FIX`) stand out from standard comments;
    - Variables, properties and methods use different colors to highlight the difference between things like `foo.bar.do()` and `foo.bar.do`;
 - Status colors (e.g. diagnostics, git diff) often use a separate set of colors to better distinguish them compared to syntax highlighting;

## Features
 - Fully configurable palette;
 - Extensive palette, providing more than the common 16-color palette. The red you want to use for foreground highlights is most likely not the same you want to use for background highlights, so a variety of colors are made available;
 - To help maintaining uniformity with your own custom highlights, the palette circus_show is using can be easily obtained with `require("circus_show").get_colors()`, allowing you to only configure any color changes once.

The setup step is optional, but all colors can be configured by:
```lua
require("circus_show").setup({
    colors = {
        red = "#ff0000"
        -- ...
    }
})
```


The colors the used by default:
```lua
local color_palette = {
    bg = "#202025",
    comment = "#5f7096",
    selection = "#3a3530",
    bg_light = "#303035",
    bg_dark = "#1a1a22",
    picker_bg = "#19191d",
    fg = "#abb2bf",
    gray = "#434852",
    neutral_gray = "#858585",
    mid_gray = "#656565",
    red = "#f54e70",
    orange = "#f79559",
    yellow = "#e5c777",
    blue = "#80a6f0",
    cyan = "#a6dbff",
    green = "#9edeaa",
    purple = "#af87d7",
    electric_pink = "#D13472",
    magenta = "#d585d5",
    black = "#000000",
    red_bg = "#3c272f",
    blue_bg = "#2c313f",
    statusred = "#f55973",
    statusyellow = "#e5c07b",
    statusgreen = "#89ca78",
    info_blue = "#61afef",
    hint_blue = "#2bbac5",
    none = "NONE",
}

```

