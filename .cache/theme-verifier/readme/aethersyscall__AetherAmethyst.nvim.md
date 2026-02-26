<div align="center">

# AetherAmethyst.nvim

> **Psychological Monochrome for Neovim.**  
> Engineered for flow. Drift into the **Eclipse** or wake up to **Bliss**.
> **This is port of [AetherAmethyst](https://aethersyscall.github.io/AetherAmethyst) colorscheme**

</div>

<pre>
    Eclipse 
<img width="1876" height="980" alt="image" src="https://github.com/user-attachments/assets/608ac99b-23af-48f1-a142-f45342c6ac41" />
    Bliss
<img width="1876" height="980" alt="image" src="https://github.com/user-attachments/assets/d9b08023-6834-4e9b-946c-db026d3bcaa1" />
</pre>

## 🔮 Philosophy

Most themes are random. **AetherAmethyst** is cognitive.
*   **Logic (Keywords)** is Blue-Violet.
*   **Action (Functions)** is Neon Pink.
*   **Structure (Operators/Delimiters)** is Vivid Cyan.
*   **Data (Strings/Types)** is Lavender & Rose.

## 📦 Installation

### [lazy.nvim](https://github.com/folke/lazy.nvim)

```lua
{
    "AetherSyscall/AetherAmethyst.nvim",
    priority = 1000,
    config = function()
        require("aetheramethyst").setup({
            transparent = false, -- Enable transparent background
            styles = {
                comments = { italic = true },
                keywords = { italic = true },
                functions = { bold = true },
                variables = {},
            }
        })
        
        -- Load the variant: 'eclipse' (dark) or 'bliss' (light)
        vim.cmd("colorscheme aetheramethyst-eclipse")
    end,
}
```

### [packer.nvim](https://github.com/wbthomason/packer.nvim)

```lua
use {
    "AetherSyscall/AetherAmethyst.nvim",
    config = function()
        vim.cmd("colorscheme aetheramethyst-eclipse")
    end
}
```

## ⚙️ Configuration

The default configuration is robust, but you can override specific styles:

```lua
require("aetheramethyst").setup({
    transparent = false, -- Disable background for transparent terminals
    terminal_colors = true, -- Set vim.g.terminal_color_*
    styles = {
        comments = { italic = true },
        keywords = { italic = true },
        functions = { bold = true },
        variables = {},
        sidebars = "dark", -- style for sidebars (see below)
        floats = "dark", -- style for floating windows
    },
    sidebars = { "qf", "help", "neo-tree" }, -- Set a darker background on sidebar-like windows
})
```

## 🧩 Supported Plugins

AetherAmethyst ships with hand-tuned support for:
*   **Treesitter** (Native & semantic)
*   **LSP Diagnostics**
*   **Neo-tree**
*   **Telescope**
*   **Dashboard / Alpha**
*   **GitSigns**
*   **Lazy.nvim**
*   **Mason**
*   **Cmp**
*   **WhichKey**

---

<div align=center>

`Enjoy AetherAmethyst colorscheme beauty either you drift into the Eclipse or wake up to Bliss.`

</div>
