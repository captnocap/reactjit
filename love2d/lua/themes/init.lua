local defaults = require('lua.themes.defaults')
local registry = {}
local families = {
  'catppuccin', 'dracula', 'nord', 'gruvbox',
  'tokyo-night', 'one-dark', 'solarized', 'rose-pine'
}
for _, name in ipairs(families) do
  local ok, family = pcall(require, 'lua.themes.' .. name)
  if ok and type(family) == 'table' then
    for id, theme in pairs(family) do
      -- Merge default typography/spacing/radii into each theme
      theme.typography = theme.typography or defaults.typography
      theme.spacing = theme.spacing or defaults.spacing
      theme.radii = theme.radii or defaults.radii
      registry[id] = theme
    end
  end
end
return registry
