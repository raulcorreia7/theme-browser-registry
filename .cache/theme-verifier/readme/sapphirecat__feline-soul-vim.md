# Feline Soul colorscheme for Vim

A gentle modification of the `default` color scheme that ships with Vim.

This is a mature theme; no further updates are anticipated.

# Features

- Responds to `set background` in GVim to provide a light/dark background
- Function is distinct from Identifier (dark green and cyan in terminals,
  respectively)
- Makes Perl HEREDOC syntax stand out a little more
- Various modifications to contrast that I liked

# Installation Options

1. Your favorite package manager, e.g.: `Plug sapphirecat/feline-soul-vim` with
   [vim-plug](https://github.com/junegunn/vim-plug)
2. Manual installation: put the [feline\_soul.vim](./colors/feline_soul.vim)
   file in a `colors` directory on the runtime path, e.g.
   `~/.vim/colors/feline_soul.vim` or
   `C:\Users\...\vimfiles\colors\feline_soul.vim`

With the file in place or the plugin loaded, turn it on with `colorscheme
feline_soul` in your vimrc.  Or try it with `:colo feline_soul` in your editing
session.

For more information on these files, check `:help runtime` and `:help vimrc` in
vim.

# Configuration

- `let g:feline_soul_perl_quotes=0`: do not set colors for `perlStringStartEnd`

# Author

Sapphire Cat &lt;devel@sapphirepaw.org&gt;

# License

The Unlicense.  If it breaks, you get to keep the pieces.
