# vim-desertBJ

A color scheme based on the default `desert.vim`, motivated by
[desertEx](https://github.com/mbbill/desertex) by Mingbai.


## Installation

Install using your favorite plugin manager. For example with
[Vundle](https://github.com/VundleVim/Vundle.vim), place this in your vimrc:
```vim
Plugin 'BeomjoonGoh/vim-desertBJ'
```
then run the following in Vim:
```vim
:source %
:PluginInstall
```

Otherwise copy `desertBJ.vim` file to `.vim/colors` directory to install manually.


## Usage

Place the following in your `vimrc` to use this color scheme:
```vim
set background=dark " or light
colorscheme desertBJ
```

This color scheme provides 16 ANSI colors for the terminal window.  If you want
to use the ANSI colors of the underling terminal or use your own (see `:help
g:terminal_ansi_colors`), set `g:desertBJ_terminal` to 0 (default 1):
```vim
let g:desertBJ_terminal = 0
```
