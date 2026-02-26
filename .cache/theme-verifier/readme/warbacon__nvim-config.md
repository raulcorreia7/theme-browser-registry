<h1 align="center">⌨️ Miovim</h1>

<p align="center">
  <i>
    From the Spanish word <strong>"mío"</strong>, meaning <em>"mine"</em> —<br/>
    because this is <strong>my</strong> way of using Vim.
  </i>
</p>

<p align="center">
  A no-nonsense Neovim setup for people who just want to sit down and code.
</p>

> [!WARNING]
> **Miovim** isn't compatible with **Neovim versions earlier than 0.12** Make
> sure you are running nightly.

## 🤨 Why Miovim?

**Miovim** is built to be simple.

If a piece of configuration is hard to understand or maintain, it doesn't belong
here. There are no clever tricks, no hidden abstractions, just a clean Neovim
setup that stays out of your way and lets you focus on writing code.

Miovim ships with `pino.nvim`, a modern and simple colorscheme inspired by
*rose-pine*, tuned for minimal visual fatigue and ANSI-compatible terminal
colors. For now, `pino.nvim` is exclusive to Miovim, but it will be released
soon once it feels polished enough.

## 📦 Dependencies

> [!IMPORTANT]
> **Miovim deliberately avoids
> [Mason.nvim](https://github.com/mason-org/mason.nvim).** Language servers and
> external tools are expected to be installed by you, either manually or through
> your system's package manager.

Before using Miovim, make sure you have:

- A **C compiler**
  - Any standard compiler on Linux/macOS
  - **MSVC** on Windows
- [`tree-sitter`](https://github.com/tree-sitter/tree-sitter)
- `fzf`
- [`ripgrep`](https://github.com/BurntSushi/ripgrep) and
  [`fd`](https://github.com/sharkdp/fd) (optional)

## 🛠️ Installation

### 🐧 Unix-like systems (Linux, macOS, WSL...)

```bash
git clone https://github.com/warbacon/nvim-config "$HOME/.config/nvim"
```

### 🪟 Windows

> [!IMPORTANT]
> Neovim runs slower on Windows. Using
> [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) is highly
> recommended.

```bash
git clone https://github.com/warbacon/nvim-config "$HOME\AppData\Local\nvim"
```
