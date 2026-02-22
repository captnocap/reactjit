--[[
  Storybook runner for SDL2.

  Mirrors storybook/love/main.lua but uses the SDL2 run loop instead of
  Love2D callbacks. Run from the repo root:

    luajit storybook/sdl2/main.lua

  The SDL2 bundle is built with: reactjit build sdl2
  Output lands at: storybook/sdl2/bundle.js (set as the sdl2 target output)
]]

-- Support three invocation styles:
--   luajit storybook/sdl2/main.lua   (CWD = repo root)
--   luajit sdl2/main.lua             (CWD = storybook/, used by the CLI)
--   luajit main.lua                  (CWD = storybook/sdl2/)
package.path = package.path .. ";?.lua;?/init.lua;../?.lua;../?/init.lua;../../?.lua;../../?/init.lua"

require("lua.sdl2_init").run({
  bundle = "sdl2/bundle.js",
  title  = "ReactJIT Storybook (SDL2)",
  width  = 800,
  height = 600,
})
