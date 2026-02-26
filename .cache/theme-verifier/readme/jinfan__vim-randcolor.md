For the benefit of your eyes, you can use this to randomize the color schemes available.

Installation
------------

Basic install - very simple (*nix or cygwin install)

    mkdir ~/.vim
    git clone https://github.com/jinfan/vim-randcolor.git ~/.vim

if you [use vim + pathogen](http://vimcasts.org/episodes/synchronizing-plugins-with-git-submodules-and-pathogen/)

    cd ~/.vim
    git submodule add https://github.com/jinfan/vim-randcolor.git bundle/vim-randcolor

if you [use vim + vundle](https://github.com/gmarik/vundle)

    " add to .vimrc
    Plugin 'jinfan/vim-randcolor'
    :PluginInstall

if you aren't using any of these, then you should:)

Using
-----

To change the colorscheme of Vim, add to your `.vimrc` with this suggested key mapping:

    nnoremap <leader>c :RandColorScheme<CR>

Then you can push the combined key and let your eyes enjoy the different colors.

Please note that the current color scheme will be displayed in the command line.

Recommendation
--------------

I strongly encourage you to install more color scheme from [flazz/vim-colorschemes](https://github.com/flazz/vim-colorschemes).

