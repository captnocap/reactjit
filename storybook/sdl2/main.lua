--[[
  Storybook runner for SDL2.

  Mirrors storybook/love/main.lua but uses the SDL2 run loop instead of
  Love2D callbacks. Run from the repo root, storybook/, or storybook/sdl2/:

    luajit storybook/sdl2/main.lua   (CWD = repo root)
    luajit sdl2/main.lua             (CWD = storybook/, used by the CLI)
    cd storybook/sdl2 && luajit main.lua   (CWD = storybook/sdl2/)

  The SDL2 bundle is built with: reactjit build sdl2
  Output lands at: storybook/sdl2/bundle.js (set as the sdl2 target output)
]]

-- Support three invocation styles by searching up for lua/sdl2_init.lua
package.path = package.path .. ";?.lua;?/init.lua;../?.lua;../?/init.lua;../../?.lua;../../?/init.lua"

-- Detect bundle path relative to CWD
local function findBundle()
  local candidates = {
    "bundle.js",           -- CWD = storybook/sdl2/
    "sdl2/bundle.js",      -- CWD = storybook/
    "storybook/sdl2/bundle.js",  -- CWD = repo root
  }
  for _, path in ipairs(candidates) do
    local f = io.open(path, "r")
    if f then f:close(); return path end
  end
  return "sdl2/bundle.js"  -- fallback to CLI convention
end

require("lua.sdl2_init").run({
  bundle = findBundle(),
  title  = "ReactJIT Storybook (SDL2)",
  width  = 800,
  height = 600,
})
