--[[
  target_sdl2.lua -- SDL2 + OpenGL target implementation

  Drop-in replacement for target_love2d.lua. Provides the same
  { name, measure, painter } interface backed by FreeType + OpenGL
  instead of Love2D's graphics APIs.

  The sdl2 target has no Love2D dependency. It runs via:
    luajit sdl2_init.lua   (from the project root)
]]

local Target = {}

Target.name    = "sdl2"
Target.measure = require("lua.sdl2_measure")
Target.painter = require("lua.sdl2_painter")
Target.images  = require("lua.sdl2_images")
Target.videos  = require("lua.sdl2_videos")

return Target
