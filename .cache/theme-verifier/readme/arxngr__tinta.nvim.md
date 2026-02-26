# tinta.nvim

`tinta.nvim` is a clean, dark Neovim colorscheme designed for focus and readability with a minimal color footprint. It features built-in support for transparency and a premium, modern aesthetic.

### tinta
<img width="3840" height="1991" alt="image" src="https://github.com/user-attachments/assets/a18aa95d-14d5-4d26-bd78-86834109fef5" />

### tinta-darker
<img width="3840" height="1991" alt="image" src="https://github.com/user-attachments/assets/a8003aec-c66a-4b9e-81e6-cf7455f2f6fc" />

### tinta-darker-cool
*A high-contrast, Tailwind-inspired variant featuring deep slate backgrounds and vibrant cyan/blue syntax highlights.*

---

## 📦 Installation

### lazy.nvim

```lua
{
  "arxngr/tinta.nvim",
  lazy = false,
  priority = 1000,
  config = function()
    require("tinta").setup({ 
      palette = "tinta-darker-cool", 
      guicursor = false 
    })
    vim.cmd("colorscheme tinta")
  end,
}
```

---

## 🔧 Configuration

```lua
require("tinta").setup({
  transparent = true,              -- Enable transparency
  palette = "tinta-darker-cool",   -- Options: "tinta", "tinta-darker", "tinta-darker-cool"
  rainbow_headings = false,         -- Enable rainbow headings for markdown
})
```

