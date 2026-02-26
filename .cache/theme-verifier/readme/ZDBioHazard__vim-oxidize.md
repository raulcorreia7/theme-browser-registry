vim-oxidize
-----------

`vim-oxidize` is a dark Vim color scheme inspired by the old "Oblivion" [GtkSourceView][] ([gedit][]) style at some point.

![Screenshot](/screenshots/oxidize_default.png)
*(Shown here with [ALE][], [GitGutter][], [Indent Guides][], [lualine][], [NvimTree][], and [python-syntax][].)*

#### Features:
  * Support for GUI colors, `termguicolors`, and `xterm-256colors`.
  * Based on the [Tango][] color palette, custom fit to the `xterm-256colors` palette.
  * Primarily designed for use with Python, Shell, HTML/etc., and YAML.
  * Configurable background brightness, for use in different lighting conditions.
  * Theming for plugins: [ALE][], [GitGutter][], [Indent Guides][], [lualine], [NERDTree][], [NvimTree][], [python-syntax][], and [Syntastic][].

  [GtkSourceView]: https://wiki.gnome.org/Projects/GtkSourceView
  [gedit]: https://wiki.gnome.org/Apps/Gedit
  [Tango]: http://tango.freedesktop.org

  [ALE]: https://github.com/dense-analysis/ale
  [GitGutter]: https://github.com/airblade/vim-gitgutter
  [Indent Guides]: https://github.com/nathanaelkane/vim-indent-guides
  [lualine]: https://github.com/nvim-lualine/lualine.nvim
  [NERDTree]: https://github.com/scrooloose/nerdtree
  [NvimTree]: https://github.com/kyazdani42/nvim-tree.lua
  [python-syntax]: https://github.com/vim-python/python-syntax
  [Syntastic]: https://github.com/vim-syntastic/syntastic


Installation
------------

This is a Vim plugin. Install it with any of
[the](https://github.com/wbthomason/packer.nvim)
[usual](https://github.com/junegunn/vim-plug)
[plugin](https://github.com/VundleVim/Vundle.vim)
[managers](https://github.com/tpope/vim-pathogen).

Once `vim-oxidize` is installed, activate it with:
```vim
:colorscheme oxidize
```

Configuration
-------------

There are a few configuration options available.
The color scheme must be reloaded for options to take effect.

### Background brightness
```vim
let g:oxidize_brightness = 2
```
The `g:oxidize_brightness` option changes the background/UI brightness.
Valid range is between `0` and `8`.

  * `0` is black
  * `2` is the default
  * `5` is equivalent to the original "Oblivion" brightness (Tango "slate dark")

![Screenshot of brightness options](/screenshots/oxidize_brightness.png)

**:warning: Note:** Increasing the brightness will not change the text color - this is still a "dark theme."

### Transparent background
```vim
let g:oxidize_transparent = 0
```
Setting `g:oxidize_transparent = 1` leaves the primary background color undefined (`'none'`), allowing your natural terminal background to show through.
Everything else still follows the `g:oxidize_brightness` setting.

### Bold and italic
```vim
let g:oxidize_use_bold = 1
let g:oxidize_use_italic = 1
```
These simply enable or disable the bold and/or italic styles, if that's your jam.

Contributing
------------

While this is my own theme for my own personal style, I'm open to suggestions for other languages or plugins I don't frequent.
