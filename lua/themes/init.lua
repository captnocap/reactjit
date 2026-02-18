local registry = {}
local families = {
  'catppuccin', 'dracula', 'nord', 'gruvbox',
  'tokyo-night', 'one-dark', 'solarized', 'rose-pine'
}
for _, name in ipairs(families) do
  local ok, family = pcall(require, 'lua.themes.' .. name)
  if ok and type(family) == 'table' then
    for id, theme in pairs(family) do
      registry[id] = theme
    end
  end
end
return registry
