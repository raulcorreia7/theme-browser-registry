# 1 %

A color scheme for (Neo)Vim based on the [onehalf](https://github.com/sonph/onehalf) theme. 99% of the theme
has been created by Son A. Pham. I just slightly modified its theme for my need, hence the oneperc name.


```
                        light     dark
0   normal  black       #383a42   #282c34
1   normal  red         #e45649   #e06c75
2   normal  green       #50a14f   #98c379
3   normal  yellow      #c18401   #e5c07b
4   normal  blue        #0184bc   #61afef
5   normal  magenta     #a626a4   #c678dd
6   normal  cyan        #0997b3   #56b6c2
7   normal  white       #fafafa   #dcdfe4
            foreground  #383a42   #dcdfe4
            background  #fafafa   #282828
```


## Installation & Usage
### Vim
Install with Plug then set `colorscheme` and `g:airline_theme`:

    Plug 'cedlemo/oneperc'
    colorscheme onehalflight
    let g:airline_theme='onehalfdark'

Or if you are using lightline, set `g:lightline.colorscheme`:

    let g:lightline.colorscheme='onehalfdark'

If you want your vim and terminal colors to match exactly, you must enable true colors in vim.
