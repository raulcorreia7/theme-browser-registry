# AetherGlow.nvim

<p align="center">
  <img src="https://img.shields.io/badge/Neovim-0.8+-92c2ff.svg?style=for-the-badge&logo=Neovim&logoColor=white" alt="Neovim"/>
  <img src="https://img.shields.io/github/stars/binbandit/aetherglow.nvim?style=for-the-badge&color=e0b8ff" alt="Stars"/>
  <img src="https://img.shields.io/badge/themes-7%20variants-ff00ff?style=for-the-badge" alt="Themes"/>
  <img src="https://img.shields.io/badge/plugins-60%2B%20supported-00ff7f?style=for-the-badge" alt="Plugins"/>
</p>

<p align="center">
  <b>Code under the northern lights: Ethereal, glowing, and endlessly shareable.</b>
</p>

<p align="center">
  <a href="#showcase">Showcase</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#variants">Variants</a> •
  <a href="#extras">Extras</a>
</p>

---

**AetherGlow** is a from-scratch Neovim theme inspired by cosmic auroras and nebulae. With mystical purples, teals, and subtle neon accents, it delivers a hypnotic, premium feel that's built for 2025 trends. Whether you prefer soothing pastels or vibrant neon, AetherGlow adapts to your vibe with automatic light/dark switching and 5 stunning variants.

> **Why developers love it:** Stunning screenshots that pop on socials, buttery smooth usability, and that "coding in space" aesthetic. Built for both marathon coding sessions and quick screenshot shares.

## Showcase

<table>
  <tr>
    <td width="50%">
      <img src="screenshots/dark_soft.png" alt="Dark Soft Variant"/>
      <p align="center"><b>Dark Soft</b> - Eye-friendly low contrast</p>
    </td>
    <td width="50%">
      <img src="screenshots/neon_glow.png" alt="Neon Glow Variant"/>
      <p align="center"><b>Neon Glow</b> - Cyberpunk vibes</p>
    </td>
  </tr>
</table>

## Features
- **7 Variants**: Dark Soft (low-contrast), Dark Bold (vibrant), Neon Glow (cyberpunk), Aurora Burst (vivid aurora), Light Dawn (warm light), Siren Seduction (sultry neon), Light Sunset (warm sunset)
- **WCAG AA Compliant**: All colors meet 4.5:1+ contrast ratios for accessibility
- **Smart Auto-Switching**: Watches `vim.o.background` changes and updates theme in real-time
- **Advanced Transparency**: Four levels from none to full transparency with smart floating window handling
- **Semantic Token Support**: Full LSP semantic highlighting with type-specific modifiers
- **Deep Customization**: `on_colors` palette hook and `on_highlights` for granular control
- **60+ Plugin Support**: Including Treesitter, LSP, AI assistants, modern utilities, and more
- **Terminal Themes**: Kitty, Alacritty, WezTerm, Ghostty, iTerm, Fish
- **Blazing Performance**: Compiled highlight caching for instant startups

## Installation

### Via [Lazy.nvim](https://github.com/folke/lazy.nvim):
```lua
{
  "binbandit/aetherglow.nvim",
  priority = 1000,
  config = function()
    require("aetherglow").setup({
      -- Your config here
    })
    vim.cmd.colorscheme "aetherglow"
  end,
}
```

### Via [vim-plug](https://github.com/junegunn/vim-plug):
```vim
Plug 'binbandit/aetherglow.nvim'
```

### Via [mini.deps](https://github.com/echasnovski/mini.deps):
```lua
add({ source = "binbandit/aetherglow.nvim" })
```

### Via [Packer](https://github.com/wbthomason/packer.nvim):
```lua
use {
  "binbandit/aetherglow.nvim",
  config = function()
    require("aetherglow").setup()
    vim.cmd.colorscheme "aetherglow"
  end
}
```

## Quick Start

Just want to try it out? After installation:

```vim
:colorscheme aetherglow
```

## Configuration

### Basic Setup
```lua
require("aetherglow").setup({
  variant = "auto",  -- "dark_soft", "dark_bold", "neon_glow", "aurora_burst", "light_dawn", or "auto"
  transparent = false,  -- false, true, "partial", "full"
  dim_inactive = true,
  styles = { comments = { italic = true }, keywords = { bold = true } },
  terminal_colors = true,
  compile = true,  -- Enable cached highlights for faster startup
})
```

### Advanced Features

**Transparency Levels**
```lua
-- No transparency (default)
transparent = false

-- Basic transparency (main background only)
transparent = true

-- Partial transparency (keeps floating windows opaque)
transparent = "partial"

-- Full transparency (all backgrounds transparent)
transparent = "full"
```

**Color & Highlight Customization**
```lua
require("aetherglow").setup({
  -- Modify palette before use
  on_colors = function(colors)
    colors.bg = "#0a0b14"
    colors.purple = "#d4a5ff"
  end,
  
  -- Override specific highlights after setup
  on_highlights = function(hl, palette)
    hl("Normal", { fg = palette.fg, bg = "#000000" })
    hl("@keyword", { fg = palette.blue, bold = true, italic = true })
  end,
})
```

**Auto Theme Switching**
```lua
-- Automatically switches between light/dark based on vim.o.background
variant = "auto"
```

The theme watches for `background` changes and updates automatically.

### Accessibility & WCAG Compliance

AetherGlow is designed with accessibility in mind. All default color combinations meet WCAG AA standards (4.5:1 contrast ratio for normal text).

**Ensure WCAG Compliance**
```lua
require("aetherglow").setup({
  ensure_wcag = true,  -- Automatically adjust colors to meet WCAG AA
})
```

**Validate WCAG Compliance**
```lua
-- Check contrast ratios for a variant
local report = require("aetherglow").validate_wcag("dark_soft")
```

### Performance

AetherGlow uses compiled highlight caching (like Catppuccin) for blazing fast startups. The cache is stored in `vim.fn.stdpath("cache")/aetherglow/` and automatically invalidates when you change settings.

To clear the cache manually:
```lua
require("aetherglow").clear_cache()
```

## Variants

<table>
  <tr>
    <td><b>Dark Soft</b></td>
    <td>Low-contrast for long coding sessions</td>
  </tr>
  <tr>
    <td><b>Dark Bold</b></td>
    <td>Vibrant colors with high contrast</td>
  </tr>
  <tr>
    <td><b>Neon Glow</b></td>
    <td>Cyberpunk-inspired neon accents</td>
  </tr>
  <tr>
    <td><b>Aurora Burst</b></td>
    <td>Vivid aurora borealis colors - bright and energetic</td>
  </tr>
  <tr>
    <td><b>Light Dawn</b></td>
    <td>Warm, pastel light theme</td>
  </tr>
  <tr>
    <td><b>Siren Seduction</b></td>
    <td>Sultry theme with romantic pinks, crimson roses, and champagne gold</td>
  </tr>
  <tr>
    <td><b>Light Sunset</b></td>
    <td>Warm sunset theme with coral, amber, and golden tones on soft beige</td>
  </tr>
</table>

## Supported Plugins

AetherGlow provides first-class support for **60+ plugins** with meticulously crafted highlight groups.

**Highlights include:**
- Complete **Treesitter** & **LSP** integration
- **AI assistants** (Copilot, Codeium, Supermaven)
- **File explorers** (Telescope, NvimTree, neo-tree)
- **Navigation** (Flash, Hop, Leap)
- **UI enhancements** (Noice, WhichKey, Alpha, Dashboard)
- **Git tools** (Gitsigns, Neogit)
- **Completion** (nvim-cmp with kind-specific colors)
- **Debugging** (DAP-UI, Neotest)
- And many more...

📋 **[See the complete plugin list →](PLUGINS.md)**

## Extras

Terminal themes included for:
- **Kitty** - `extras/kitty/aetherglow.conf`
- **Alacritty** - `extras/alacritty/aetherglow.toml`
- **WezTerm** - `extras/wezterm/aetherglow.lua`
- **Ghostty** - `extras/ghostty/aetherglow`

## Contributing

PRs welcome! Add plugin support, new variants, or terminal themes.

## Show Your Support

If you love AetherGlow, give it a star on GitHub and share your setup on social media with **#AetherGlow**.

## License

MIT © 2025 binbandit
