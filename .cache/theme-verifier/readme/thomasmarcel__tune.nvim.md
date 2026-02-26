# tune.nvim

A simple theme switcher for people that like to mix it up from time to time!

## Installation

### With lazy.nvim

```lua
{
  ‘thomasmarcel/tune.nvim’,
  config = function()
    require('tune').setup({
      -- Set up a default colorscheme
      default_colorscheme = 'rose-pine'
    })
  end,
  priority = 10,
}
```

## Usage

tune.nvim provide the following commands:
- `:Tune <colorscheme>` to select a colorscheme
- `:TuneRandom` to select a random colorscheme

## Tips and Tricks

### Select a random colorscheme at startup

```lua
{
  ‘thomasmarcel/tune.nvim’,
  config = function()
    local tune = require 'tune'
    tune.setup()
    tune.pick_random_colorscheme()
  end,
  priority = 10,
}
```

## TODO

- [ ] Pass a list of colorschemes to pick from
- [ ] Define GUI font family and size
- [ ] Autocomplete colorscheme names
