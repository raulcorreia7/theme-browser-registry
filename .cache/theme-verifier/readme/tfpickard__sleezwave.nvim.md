# 🌊 sleezwave.nvim

<div align="center">

**A synthwave-inspired Neovim colorscheme that's easy on the eyes**

*Bringing that retro-futuristic aesthetic to your terminal while maintaining excellent readability for long coding sessions*

[![Neovim](https://img.shields.io/badge/NeoVim-%2357A143.svg?&style=for-the-badge&logo=neovim&logoColor=white)](https://neovim.io/)
[![Lua](https://img.shields.io/badge/lua-%232C2D72.svg?style=for-the-badge&logo=lua&logoColor=white)](https://www.lua.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

## ✨ Features

- 🎨 **Synthwave aesthetic** with electric blues, hot pinks, and neon accents
- 👁️ **Easy on the eyes** - carefully muted variants for better readability
- 🔌 **Comprehensive plugin support** - 25+ popular Neovim plugins with hand-crafted highlights
- ⚡ **Optimized performance** - lazy-loaded integrations and efficient highlighting
- 🎯 **Highly configurable** - customize styles, transparency, and individual plugin integrations
- 🌙 **Dark theme ready** (light theme coming soon)
- 📦 **Zero dependencies** - pure Lua implementation
- 🎭 **Multiple loading methods** - works with any plugin manager or manual installation

## 📸 Gallery

<!-- Add screenshots here -->
```
🖼️ Screenshots coming soon!
- Main editing interface
- Telescope integration
- Git integration
- Completion menu
- Terminal colors
```

## 🎨 Color Palette

<table>
<tr><td>

**Core Colors**
- Background: `#1a0d2e`
- Foreground: `#c9a9dd` 
- Hot Pink: `#ff6bcb`
- Electric Blue: `#3d5afe`
- Electric Cyan: `#00e5ff`
- Electric Green: `#69ff94`
- Neon Yellow: `#ffeb3b`

</td><td>

**Usage**
- Deep purple-black base
- Soft purple-white text
- Strings, selections
- Keywords, statements  
- Constants, numbers
- Types, success states
- Special chars, warnings

</td></tr>
</table>

## 🚀 Installation

### [lazy.nvim](https://github.com/folke/lazy.nvim) (Recommended)

```lua
{
  "tfpickard/sleezwave.nvim",
  name = "sleezwave",
  lazy = false,
  priority = 1000,
  config = function()
    require("sleezwave").setup({
      -- Configuration options (see below)
    })
    vim.cmd.colorscheme("sleezwave")
  end,
}
```

### [packer.nvim](https://github.com/wbthomason/packer.nvim)

```lua
use {
  "tfpickard/sleezwave.nvim",
  config = function()
    require("sleezwave").setup()
    vim.cmd.colorscheme("sleezwave")
  end
}
```

### [vim-plug](https://github.com/junegunn/vim-plug)

```vim
Plug 'tfpickard/sleezwave.nvim'

" After plug#end()
lua << EOF
require("sleezwave").setup()
vim.cmd.colorscheme("sleezwave")
EOF
```

### Manual Installation

```bash
git clone https://github.com/tfpickard/sleezwave.nvim.git \
  ~/.config/nvim/pack/sleezwave/start/sleezwave.nvim
```

Then add to your `init.lua`:
```lua
require("sleezwave").setup()
vim.cmd.colorscheme("sleezwave")
```

## ⚙️ Configuration

### Default Configuration

```lua
require("sleezwave").setup({
  variant = "dark",           -- "dark" or "light" (light coming soon)
  transparent = false,        -- disable background for transparent terminals
  terminal_colors = true,     -- set terminal colors (0-15)
  styles = {
    comments = { italic = true },
    keywords = { bold = false },
    functions = { bold = false },
    variables = { bold = false },
  },
  integrations = {
    -- Core
    treesitter = true,
    lsp = true,
    
    -- UI & Navigation  
    telescope = true,
    nvim_tree = true,
    neo_tree = true,
    which_key = true,
    trouble = true,
    
    -- Status & Tabs
    lualine = true,
    bufferline = true,
    
    -- Git
    gitsigns = true,
    
    -- Completion
    cmp = true,
    
    -- Motion
    hop = true,
    leap = true,
    flash = true,
    
    -- Development
    dap = true,
    mason = true,
    lazy = true,
    
    -- Notifications & UI
    notify = true,
    noice = true,
    alpha = true,
    dashboard = true,
    
    -- Formatting
    indent_blankline = true,
    
    -- Mini.nvim
    mini = true,
  },
})
```

### Configuration Examples

**Transparent Background**
```lua
require("sleezwave").setup({
  transparent = true,
})
```

**Custom Styles**
```lua
require("sleezwave").setup({
  styles = {
    comments = { italic = true },
    keywords = { bold = true },
    functions = { bold = true },
    variables = { bold = false },
  },
})
```

**Minimal Integrations**
```lua
require("sleezwave").setup({
  integrations = {
    treesitter = true,
    lsp = true,
    telescope = true,
    -- Disable others
    nvim_tree = false,
    which_key = false,
    -- ... etc
  },
})
```

## 🔌 Plugin Integrations

sleezwave.nvim includes carefully crafted highlights for 25+ popular plugins:

<details>
<summary><strong>📁 UI & Navigation (6 plugins)</strong></summary>

- [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim) - Fuzzy finder with custom borders and highlights
- [nvim-tree.lua](https://github.com/nvim-tree/nvim-tree.lua) - File explorer with git status colors
- [neo-tree.nvim](https://github.com/nvim-neo-tree/neo-tree.nvim) - Modern file explorer
- [which-key.nvim](https://github.com/folke/which-key.nvim) - Keybinding hints
- [trouble.nvim](https://github.com/folke/trouble.nvim) - Diagnostics and quickfix
- [alpha-nvim](https://github.com/goolord/alpha-nvim) - Start screen

</details>

<details>
<summary><strong>🎨 Status & UI (4 plugins)</strong></summary>

- [lualine.nvim](https://github.com/nvim-lualine/lualine.nvim) - Statusline with custom theme
- [bufferline.nvim](https://github.com/akinsho/bufferline.nvim) - Buffer tabs
- [nvim-notify](https://github.com/rcarriga/nvim-notify) - Notifications
- [noice.nvim](https://github.com/folke/noice.nvim) - Command line UI

</details>

<details>
<summary><strong>🔧 Development Tools (6 plugins)</strong></summary>

- [nvim-cmp](https://github.com/hrsh7th/nvim-cmp) - Completion with all CmpItemKind highlights
- [nvim-dap](https://github.com/mfussenegger/nvim-dap) - Debug adapter protocol
- [mason.nvim](https://github.com/williamboman/mason.nvim) - LSP installer
- [lazy.nvim](https://github.com/folke/lazy.nvim) - Plugin manager UI
- [gitsigns.nvim](https://github.com/lewis6991/gitsigns.nvim) - Git decorations
- [indent-blankline.nvim](https://github.com/lukas-reineke/indent-blankline.nvim) - Indentation guides

</details>

<details>
<summary><strong>🏃 Motion & Search (3 plugins)</strong></summary>

- [hop.nvim](https://github.com/phaazon/hop.nvim) - Jump to anywhere
- [leap.nvim](https://github.com/ggandor/leap.nvim) - Motion plugin
- [flash.nvim](https://github.com/folke/flash.nvim) - Navigate with search labels

</details>

<details>
<summary><strong>🔥 Core & Language (3 plugins)</strong></summary>

- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) - Syntax highlighting
- Built-in LSP - Language server protocol
- Built-in diagnostics - Error/warning highlighting

</details>

<details>
<summary><strong>🎯 Mini.nvim Suite (1 meta-plugin)</strong></summary>

- [mini.nvim](https://github.com/echasnovski/mini.nvim) - Complete suite with statusline, tabline, starter, and more

</details>

**Each integration can be individually toggled** in the configuration, so you only load highlighting for plugins you actually use.

## 🎭 Usage Examples

### Basic Usage

```lua
-- Simple setup with defaults
require("sleezwave").setup()
vim.cmd.colorscheme("sleezwave")
```

### With Lualine Theme

```lua
-- Use the included lualine theme
require('lualine').setup {
  options = {
    theme = 'sleezwave'
  }
}
```

### Get Colors Programmatically

```lua
-- Access colors for custom highlighting
local colors = require("sleezwave").get_colors()
print(colors.electric_cyan) -- #00e5ff

-- Use in your own highlights
vim.api.nvim_set_hl(0, "MyCustomGroup", {
  fg = colors.hot_pink,
  bg = colors.darker_purple,
})
```

### Development Hot Reload

```lua
-- Enable auto-reload during development
require("sleezwave").dev_reload()
-- Now the colorscheme reloads when you edit sleezwave files
```

## 🛠️ Development

### Building from Source

```bash
git clone https://github.com/tfpickard/sleezwave.nvim.git
cd sleezwave.nvim

# Test in Neovim
nvim -u NONE -c "set runtimepath+=. | lua require('sleezwave').setup() | colorscheme sleezwave"
```

### Contributing

We welcome contributions! Please:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Test your changes** with multiple plugins
4. **Commit your changes** (`git commit -m 'Add amazing feature'`)
5. **Push to the branch** (`git push origin feature/amazing-feature`)
6. **Open a Pull Request**

### Adding New Plugin Integration

1. Add the integration function to `lua/sleezwave/highlights.lua`
2. Add the integration toggle to the default config in `lua/sleezwave/init.lua`
3. Test with the actual plugin installed
4. Update the README plugin list

## 🐛 Issues & Support

- **🐛 Bug Reports**: [GitHub Issues](https://github.com/tfpickard/sleezwave.nvim/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/tfpickard/sleezwave.nvim/discussions)
- **❓ Questions**: Check existing issues or start a discussion

Please include your Neovim version, plugin manager, and minimal config when reporting issues.

## 🌟 Related Projects

Complete your synthwave terminal setup:

- **[sleezwave tmux](https://github.com/tfpickard/sleezwave-tmux)** - Matching tmux theme with status bar
- **[sleezwave ghostty](https://github.com/tfpickard/sleezwave-ghostty)** - Terminal colorscheme
- **[sleezwave alacritty](https://github.com/tfpickard/sleezwave-alacritty)** - Alacritty terminal colors

## 📄 License

[MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

**Inspiration:**
- The synthwave/outrun/vaporwave aesthetic movement
- [rose-pine](https://github.com/rose-pine/neovim) for the eye-friendly philosophy
- [gruvbox](https://github.com/morhetz/gruvbox) for readability principles
- [tokyonight](https://github.com/folke/tokyonight.nvim) for plugin integration patterns

**Community:**
- The dope Neovim community
- Plugin authors who make Neovim slap
- Beta testers and contributors

---

<div align="center">

**[⬆ Back to Top](#-sleezwavenvim)**

*Made with 💜 for the terminal • Star ⭐ if you like it!*

</div>
