--[[
  physics.lua -- Physics module for ReactJit

  Exposes a simple bridge to `love.physics` so that TypeScript
  can access native physics without a full game framework.
  Note: This is currently unsupported on the SDL2 backend.
]]

local Physics = {}
local worlds = {}

function Physics.init()
  if not love.physics then
    io.write("[physics] Not available on this backend (e.g. SDL2)\n")
    return
  end
  io.write("[physics] Initialized love.physics capabilities\n")
end

function Physics.createWorld(id, gravityX, gravityY, sleep)
  if not love.physics then return false end
  worlds[id] = love.physics.newWorld(gravityX or 0, gravityY or 9.81, sleep == nil and true or sleep)
  return true
end

function Physics.update(dt)
  if not love.physics then return end
  for _, world in pairs(worlds) do
    world:update(dt)
  end
end

function Physics.getWorld(id)
  return worlds[id]
end

return Physics
