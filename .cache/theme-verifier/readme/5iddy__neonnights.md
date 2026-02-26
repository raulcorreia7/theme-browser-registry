# neonnights
A colorful and vibrant neon theme for vim. No more dull colors.

Here is a screenshot.

![Screenshot_2020-09-06_10-57-57.png](https://github.com/5iddy/neonnights/blob/master/screenshots/Screenshot_2020-09-06_10-57-57.png)

![screenshots/Screenshot_2020-09-06_11-09-40.png](https://github.com/5iddy/neonnights/blob/master/screenshots/Screenshot_2020-09-06_11-09-40.png)

Place the colors/neonnights.vim file in ~/.vim/colors/
If there is no colors folder. Just create it. It will work fine. 

This theme also supports lightline. Just place the lightline/neonnights.vim in autoload/lightline/colorscheme folder. 

And place this in .vimrc:
```
set termguicolors
colorscheme neonnights 

if !has('gui_running')
  set t_Co=256
endif

let g:lightline = {
      \ 'colorscheme': 'neonnights',
      \ }
```

If you want syntax highlighting just like mine in python. Use [vim-python](https://github.com/vim-python/python-syntax). Its tested with vundle and vim-python.

It is by default made to be transperant. If you dont want transperancy.

change this line in the colors/neonnights.vim
```
hi Normal guibg=NONE guifg=#2496FF gui=NONE cterm=NONE
```
to this:
```
hi Normal guibg=#170020 guifg=#2496FF gui=NONE cterm=NONE
```

All the colors in this theme use xterm-256color scheme. So there's that.


the lightline theme is a modified version of onehalfdark lightline theme
