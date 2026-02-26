# Submerged

![BSD 2-Clause License](https://img.shields.io/github/license/higherkinded/vim-colors-submerged?style=flat-square)

## Basic commentary

Submerged is a theme based on darker tones of green and cyan. It was initially
inspired by Muon but removes the opposing accent colors and tries to be easy on
the user's eyes while maintaining a decent contrast in order to enable usage in
well-lit environments. I can't verify the latter though. :P

## Configuration

Submerged reads its options from the `g:submerged_theme` dictionary. For now
there's not a lot of switches but I suppose that some configurability will be
brought in gradually come up with something that makes sense configuring. So to
bring it in, just do this before you do `colorscheme submerged`:

```viml
let g:submerged_theme = {}
```

### Disable italics

You can disable italics if you don't like them or find that your terminal
emulator or font doesn't support them (reverses the highlighting instead of
italicizing). It's done by setting the field `disable_italics` in the
configuration dictionary:

```
let g:submerged_theme.disable_italics = 1
```

## And how does it look anyway?

Here's how it looks:
 
![Looks like this](https://github.com/higherkinded/repo-images/blob/master/vim-colors-submerged/submerged-looks.png?raw=true "Some QMK source as lorem ipsum")

Enjoy.

&mdash; hk
