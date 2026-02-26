# About
This neovim theme is heavily inspired by [gruber-darker](https://github.com/rexim/gruber-darker-theme) theme
but I wanted to only highlight keywords with the same color pallete.

This theme highlights only **keywords**, **string literals** and **comments**

# Sceenshots
![image](https://github.com/ring0-rootkit/ring0-dark.nvim/assets/111735837/5b461fc7-6299-4273-9c4c-49cca824f965)
![image](https://github.com/ring0-rootkit/ring0-dark.nvim/assets/111735837/2c286af8-ccc1-412b-9f51-c46167f09191)
![image](https://github.com/ring0-rootkit/ring0-dark.nvim/assets/111735837/30bde356-a19c-40dd-af53-2b09b42dec05)

# Installation
Lazy:
```
{
    "ring0-rootkit/ring0-dark.nvim",
    priority = 1000, -- Make sure to load this before all the other start plugins.
    init = function()
        vim.cmd.colorscheme("ring0dark")
    end,
},
```

# Note
This plugin is really simple, feel free to fork it and change colors however you want, or maybe even send your pull request to make this theme better.
P.S.: if you want to know what color type specific word has just put your cursor on the word you wanna check and write `:Inspect`
