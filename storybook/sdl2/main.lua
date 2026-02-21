--[[
  Storybook runner for SDL2.

  Mirrors storybook/love/main.lua but uses the SDL2 run loop instead of
  Love2D callbacks. Run from the repo root:

    luajit storybook/sdl2/main.lua

  The SDL2 bundle is built with: reactjit build sdl2
  Output lands at: storybook/sdl2/bundle.js (set as the sdl2 target output)
]]

-- From storybook/sdl2/, two levels up is the repo root where lua/ lives.
package.path = package.path .. ";../../?.lua;../../?/init.lua"

require("lua.sdl2_init").run({
  bundle = "bundle.js",
  title  = "ReactJIT Storybook (SDL2)",
  width  = 800,
  height = 600,
})
