![dwarf.vim](https://imgur.com/izNbqOO.png)

# Installation
```VimL
Plug 'ysdexlic/dwarf.vim'  " or other package manager
"...
set termguicolors          " enable true colors support
let dwarfcolor="forge"     " for default theme
let dwarfcolor="iron"      " for rustic theme
let dwarfcolor="steel"     " for dark theme
let dwarfcolor="obsydian"  " for high contrast theme
colorscheme dwarf
```

Also has lightline support, add this to your lightline config:

```VimL
let g:lightline = {
      " ...
      \ 'colorscheme': 'dwarf',
      " ...
      \ }
```
