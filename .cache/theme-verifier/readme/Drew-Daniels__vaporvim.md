```
██╗   ██╗ █████╗ ██████╗  ██████╗ ██████╗ ██╗   ██╗██╗███╗   ███╗
██║   ██║██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██║   ██║██║████╗ ████║
██║   ██║███████║██████╔╝██║   ██║██████╔╝██║   ██║██║██╔████╔██║
╚██╗ ██╔╝██╔══██║██╔═══╝ ██║   ██║██╔══██╗╚██╗ ██╔╝██║██║╚██╔╝██║
 ╚████╔╝ ██║  ██║██║     ╚██████╔╝██║  ██║ ╚████╔╝ ██║██║ ╚═╝ ██║
  ╚═══╝  ╚═╝  ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝  ╚═══╝  ╚═╝╚═╝     ╚═╝
```

### _A E S T H E T I C · C O D I N G_

> _It's not just a colorscheme. It's a mass-produced commodity packaged as an authentic experience._

[![Neovim](https://img.shields.io/badge/Neovim-0.8+-57A143?style=flat&logo=neovim&logoColor=white)](https://neovim.io)
[![License](https://img.shields.io/badge/License-MIT-ff69b4)](LICENSE)
[![Aesthetic](https://img.shields.io/badge/Aesthetic-100%25-00ffff)](https://www.youtube.com/watch?v=cU8HrO7XuiE)

---

═══[ あなたのコードは美しい ]═════════════════════════

Remember when you used to code at the mall? Neither do we. But wouldn't it have been _aesthetic_?

**vaporvim** brings the mass-market nostalgia of a mass-market nostalgia movement directly to your terminal. Bathe your functions in neon pink. Watch your variables shimmer in gold. Let your errors scream in colors that would make a 1987 Lamborghini Countach jealous.

<p align="center">
  <img src="https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3Nmh4aTZ6bjZjMGg2OTY1azBkZTlwcXg3Z2tuc3B1MDk2bXJkd2hlNyZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/QWMkjyAZ0f1xVcsIma/giphy.gif" width="300">
</p>

═══[ FEATURES ]═══════════════════════════════════════

- Colors scientifically formulated to trigger mass nostalgia for an era you may not have experienced
- Full treesitter support (the trees are synthetic, like everything else)
- LSP semantic tokens (because even Language Servers deserve to feel something)
- 50+ plugin integrations (Telescope, NvimTree, nvim-cmp, and your other corporate masters)
- Carefully curated to look good at 2 AM when you should be sleeping

═══[ INSTALLATION ]═══════════════════════════════════

**lazy.nvim (Recommended™)**

```lua
{
  "Drew-Daniels/vaporvim",
  lazy = false,
  priority = 1000, -- load before other things, like your responsibilities
  config = function()
    vim.cmd.colorscheme("vaporvim")
  end,
}
```

**packer.nvim**

```lua
use({
	"Drew-Daniels/vaporvim",
	config = function()
		vim.cmd.colorscheme("vaporvim")
	end,
})
```

**vim-plug**

```vim
Plug 'Drew-Daniels/vaporvim'

" Then, in the comfort of your own home:
colorscheme vaporvim
```

<p align="center">
  <img src="https://media.giphy.com/media/PCbbTEkATqZM4xYanM/giphy.gif" width="300">
</p>

═══[ THE PALETTE ]════════════════════════════════════

| Color       | Hex       | Vibe                                           |
| ----------- | --------- | ---------------------------------------------- |
| **Pink**    | `#f92aad` | Main character energy                          |
| **Magenta** | `#b141f1` | Mysterious stranger at the synthesizer         |
| **Cyan**    | `#58c7e0` | Poolside at a hotel that doesn't exist anymore |
| **Green**   | `#54e484` | The exit sign you'll never use                 |
| **Gold**    | `#e0b401` | Late capitalism, but make it pretty            |
| **Purple**  | `#9d7bca` | The glow of a CRT at 3 AM                      |

═══[ CONFIGURATION ]══════════════════════════════════

```lua
require("vaporvim").setup({
	transparent = false, -- let the void show through
	italic_comments = true, -- comments deserve to lean
	italic_keywords = false,
	bold_functions = false,
})
```

═══[ SCREENSHOTS ]════════════════════════════════════

_Imagine the most beautiful code you've ever seen. Now add more pink._

<p align="center">
  <img src="screenshots/demo.gif" width="700">
</p>

═══[ CREDITS ]════════════════════════════════════════

- Ported from [Kabukicho](https://github.com/victoriadrake/kabukicho-vscode) by Victoria Drake
- Inspired by mass-produced nostalgia and the inexorable march of time
- Dedicated to everyone who's ever mass-highlighted a file just to see the colors

═══[ LICENSE ]════════════════════════════════════════

MIT - Free as in "free continental breakfast at a hotel that closed in 1994"

---

<p align="center">
  <i>「あなたはすでにコーディングしています」</i>
  <br>
  <sub>You are already coding.</sub>
</p>

<p align="center">
  <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExazlyb2lqZDJxOWZjbGNiYml0cWxjeXUya2kwdnFjOW9ienN4N3Z5ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/TJUQcejkfYAKGndgET/giphy.gif" width="300">
</p>
