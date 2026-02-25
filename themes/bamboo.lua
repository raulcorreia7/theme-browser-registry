-- themes/bamboo.lua - Custom loader for bamboo.nvim
---@param entry table Theme entry
---@param vim_opts table { g: {}, o: {} }
return function(entry, vim_opts)
  if vim_opts.g then
    for key, value in pairs(vim_opts.g) do vim.g[key] = value end
  end
  if vim_opts.o then
    for key, value in pairs(vim_opts.o) do vim.o[key] = value end
  end
  
  local ok, mod = pcall(require, "bamboo")
  if ok and mod.setup then
    mod.setup({})
  end
  vim.cmd.colorscheme(entry.colorscheme or "bamboo")
end
