# lucid.nvim

A minimal, muted color scheme for [Neovim](https://neovim.io/) inspired by
clarity and restraint. The design philosophy of Lucid is to give focus to the
language structure and control flow with colors while keeping the code’s body
text plain.

<!-- prettier-ignore-start -->
> [!NOTE]
> The color scheme is still being developed, and the colors may evolve while I’m
> testing the color scheme. Suggestion are of course welcome!
<!-- prettier-ignore-end -->

## Installation

You can install the color scheme using your preferred package manager:

```lua
vim.pack.add({"https://github.com/anttikivi/lucid.nvim"})
```

## Usage

Enable the color scheme using Lua:

```lua
vim.cmd.colorscheme("lucid")
```

You can also enable the color scheme using Vimscript:

```vim
colorscheme lucid
```

There is no need to configure Lucid. The colors are selected according to
`vim.o.background`.

## License

Copyright (c) 2025 Antti Kivi

Reginald is licensed under the Apache-2.0 license. See the [LICENSE](LICENSE)
file for more information.

Please see the [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES) for full attribution
and license information.
