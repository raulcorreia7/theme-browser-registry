<h1 align="center">pastelhash.nvim</h1>
<p align="center">clear focus on what matters</p>
<p align="center">
  <img src="assets/demo.png" alt="demo.png" />
</p>

## Palette

<table align="center">
  <thead>
    <tr>
      <th align="center">Token</th>
      <th align="center">Light</th>
      <th align="center">Dark</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><code>bg</code></td>
      <td align="center">
        <img src="assets/swatches/F7F7FF.svg" width="12" height="12" alt="#F7F7FF" />
        <code>#F7F7FF</code>
      </td>
      <td align="center">
        <img src="assets/swatches/252530.svg" width="12" height="12" alt="#252530" />
        <code>#252530</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>fg</code></td>
      <td align="center">
        <img src="assets/swatches/3F3F53.svg" width="12" height="12" alt="#3F3F53" />
        <code>#3F3F53</code>
      </td>
      <td align="center">
        <img src="assets/swatches/BDBDD9.svg" width="12" height="12" alt="#BDBDD9" />
        <code>#BDBDD9</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>bg-alt</code></td>
      <td align="center">
        <img src="assets/swatches/EEEEFC.svg" width="12" height="12" alt="#EEEEFC" />
        <code>#EEEEFC</code>
      </td>
      <td align="center">
        <img src="assets/swatches/202025.svg" width="12" height="12" alt="#202025" />
        <code>#202025</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>error</code></td>
      <td colspan="2" align="center">
        <img src="assets/swatches/EE5E66.svg" width="12" height="12" alt="#EE5E66" />
        <code>#EE5E66</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>warning</code></td>
      <td colspan="2" align="center">
        <img src="assets/swatches/FABD2F.svg" width="12" height="12" alt="#FABD2F" />
        <code>#FABD2F</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>ok</code></td>
      <td colspan="2" align="center">
        <img src="assets/swatches/79C779.svg" width="12" height="12" alt="#79C779" />
        <code>#79C779</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>info</code></td>
      <td colspan="2" align="center">
        <img src="assets/swatches/66AFEF.svg" width="12" height="12" alt="#66AFEF" />
        <code>#66AFEF</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>hint</code></td>
      <td colspan="2" align="center">
        <img src="assets/swatches/66B6C6.svg" width="12" height="12" alt="#66B6C6" />
        <code>#66B6C6</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>comment, delimiter</code></td>
      <td colspan="2" align="center">
        <img src="assets/swatches/7F879E.svg" width="12" height="12" alt="#7F879E" />
        <code>#7F879E</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>literal</code> (<code>String</code>, <code>Number</code>, <code>Boolean</code>, <code>Constant</code>)</td>
      <td colspan="2" align="center">
        <img src="assets/swatches/88B8FA.svg" width="12" height="12" alt="#88B8FA" />
        <code>#88B8FA</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>decl</code> (first declarations/initializations, imports)</td>
      <td colspan="2" align="center">
        <img src="assets/swatches/AF87D7.svg" width="12" height="12" alt="#AF87D7" />
        <code>#AF87D7</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>immutable</code> (<code>ReadOnly</code>, when enabled)</td>
      <td colspan="2" align="center">
        <img src="assets/swatches/AB7F49.svg" width="12" height="12" alt="#AB7F49" />
        <code>#AB7F49</code>
      </td>
    </tr>
    <tr>
      <td align="center"><code>keyword</code> (<code>Keyword</code>, <code>Statement</code>, etc., when enabled)</td>
      <td colspan="2" align="center">
        <img src="assets/swatches/CC7000.svg" width="12" height="12" alt="#CC7000" />
        <code>#CC7000</code>
      </td>
    </tr>
  </tbody>
</table>

## Configuration and default values

```lua
require('pastelhash').setup({
    variant = nil, -- 'light' | 'dark'; nil -> auto using vim.o.background
    deprecated_as_warn = false, -- true -> deprecated is colored as WARNING
    highlight_immutable = false, -- true -> readonly is colored #AB7F49
    highlight_keywords = false, -- true -> keyword groups are colored #CC7000
})
vim.cmd.colorscheme('pastelhash')
```

Vim:

```vim
" let g:pastelhash_variant = 'light' " or 'dark'; unset -> auto by &background
let g:pastelhash_deprecated_as_warn = 0
let g:pastelhash_highlight_immutable = 0
let g:pastelhash_highlight_keywords = 0
colorscheme pastelhash
```

## Notes

- Vim support is regex-syntax based. Declaration highlighting is best-effort and language dependent.
- Neovim includes extra Treesitter highlight groups when available.
- Expects truecolor (`termguicolors`).
