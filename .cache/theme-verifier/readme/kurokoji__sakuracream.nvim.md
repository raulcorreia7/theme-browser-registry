# sakuracream.nvim

Soft pink light colorscheme for Neovim.

## Usage

Place this repo on your `runtimepath`, then:

```vim
colorscheme sakuracream
```

## Setup (optional)

```lua
require("sakuracream").setup({
  italic = true,
  italic_comments = true,
  bold = true,
  lualine = true,
  transparent = false,
  palette = {
    -- override any color from the palette
    -- accent = "#c15886",
  },
})

vim.cmd.colorscheme("sakuracream")
```

## Lualine theme

```lua
require("lualine").setup({
  options = {
    theme = "sakuracream",
  },
})
```

## Notes

- Designed for `background=light`.
- Uses subtle pinks with muted contrast to stay easy on the eyes.

## Previews

<img width="1227" height="843" alt="image" src="https://github.com/user-attachments/assets/206574f5-bd7c-4457-8b27-9dee8593d6cc" />
