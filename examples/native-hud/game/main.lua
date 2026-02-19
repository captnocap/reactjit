--[[
  Example: Native HUD rendered via QuickJS + react-reconciler

  The React components (HealthBar, Score, Inventory) are written in JSX,
  bundled into bundle.js, and rendered as Love2D draw calls via the
  react-love native pipeline.

  This file just wires up the Love2D lifecycle to ReactLove and
  simulates some game state for the HUD to display.
]]

-- Add the project root to the require path so lua.* modules resolve
package.path = package.path .. ";../../?.lua;../../?/init.lua"

local ReactLove = require("lua.init")

local gameTime = 0
local playerHealth = 100
local playerMana = 80
local score = 0
local fps = 0

function love.load()
  ReactLove.init({
    mode = "native",
    bundlePath = "love/bundle.js",
  })
end

function love.update(dt)
  gameTime = gameTime + dt
  fps = love.timer.getFPS()

  -- Simulate game state changes
  playerHealth = 50 + 50 * math.sin(gameTime * 0.3)
  playerMana = 40 + 40 * math.cos(gameTime * 0.5)
  score = math.floor(gameTime * 10)

  -- Push state to React via the bridge
  local bridge = ReactLove.getBridge()
  if bridge then
    bridge:pushEvent({ type = "state:player.health", payload = math.floor(playerHealth) })
    bridge:pushEvent({ type = "state:player.mana", payload = math.floor(playerMana) })
    bridge:pushEvent({ type = "state:game.score", payload = score })
    bridge:pushEvent({ type = "state:debug.fps", payload = fps })
  end

  -- Tick the React pipeline
  ReactLove.update(dt)
end

function love.draw()
  -- Background: simple gradient-ish game world
  local w, h = love.graphics.getDimensions()

  love.graphics.setColor(0.05, 0.08, 0.12)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Fake game world: some stars
  love.graphics.setColor(0.3, 0.3, 0.4)
  math.randomseed(42)
  for i = 1, 80 do
    local sx = math.random() * w
    local sy = math.random() * h
    local sr = 1 + math.random() * 2
    love.graphics.circle("fill", sx, sy, sr)
  end

  -- Fake player
  love.graphics.setColor(0.3, 0.6, 1.0, 0.8)
  love.graphics.circle("fill", w / 2, h / 2, 24)
  love.graphics.setColor(0.5, 0.8, 1.0, 0.3)
  love.graphics.circle("fill", w / 2, h / 2, 48)

  -- Draw the React UI on top
  ReactLove.draw()

  love.graphics.setColor(1, 1, 1, 1)
end

function love.mousepressed(x, y, button)
  ReactLove.mousepressed(x, y, button)
end

function love.mousereleased(x, y, button)
  ReactLove.mousereleased(x, y, button)
end

function love.mousemoved(x, y, dx, dy)
  ReactLove.mousemoved(x, y)
end

function love.resize(w, h)
  ReactLove.resize(w, h)
end

function love.filedropped(file)
  ReactLove.filedropped(file)
end

function love.directorydropped(dir)
  ReactLove.directorydropped(dir)
end

function love.quit()
  ReactLove.quit()
end

function love.keypressed(key)
end
