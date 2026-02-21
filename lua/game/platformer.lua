-- platformer.lua
-- Lua-owned platformer module for <Game module="platformer" />.
-- React declares config/UI; update + render stay fully in Lua.

local M = {}

local W, H = 640, 360
local TILE = 16
local MAP_W = 30
local MAP_H = 15

local LEVEL = {
  {2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,2},
  {2,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2},
  {2,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2},
  {2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,2},
  {2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2},
}

local COIN_POSITIONS = {
  { x = 7 * TILE,  y = 7 * TILE },
  { x = 14 * TILE, y = 8 * TILE },
  { x = 23 * TILE, y = 9 * TILE },
  { x = 4 * TILE,  y = 10 * TILE },
  { x = 18 * TILE, y = 12 * TILE },
  { x = 28 * TILE, y = 11 * TILE },
  { x = 11 * TILE, y = 11 * TILE },
  { x = 19 * TILE, y = 7 * TILE },
}

local cfg = {
  gravity = 600,
  moveSpeed = 120,
  jumpForce = 280,
  maxFallSpeed = 350,
}

local player = nil
local coins = {}
local score = 0
local dirty = true
local dirtyTimer = 0
local keys = { left = false, right = false, jump = false }

local function resetGame()
  player = {
    x = 3 * TILE,
    y = 12 * TILE,
    w = 12,
    h = 14,
    vx = 0,
    vy = 0,
    onGround = false,
  }

  coins = {}
  for i = 1, #COIN_POSITIONS do
    local c = COIN_POSITIONS[i]
    coins[#coins + 1] = { x = c.x, y = c.y, collected = false }
  end
  score = 0
  dirty = true
  dirtyTimer = 0
end

local function mapOffsets()
  local worldW = MAP_W * TILE
  local worldH = MAP_H * TILE
  local ox = math.floor((W - worldW) * 0.5)
  local oy = math.floor((H - worldH) * 0.5)
  return ox, oy, worldW, worldH
end

local function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh)
  return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by
end

local function resolveCollisionsHorizontal()
  for gy = 1, MAP_H do
    for gx = 1, MAP_W do
      if LEVEL[gy][gx] == 2 then
        local tx = (gx - 1) * TILE
        local ty = (gy - 1) * TILE
        if rectsOverlap(player.x, player.y, player.w, player.h, tx, ty, TILE, TILE) then
          if player.vx > 0 then
            player.x = tx - player.w
          elseif player.vx < 0 then
            player.x = tx + TILE
          end
          player.vx = 0
        end
      end
    end
  end
end

local function resolveCollisionsVertical()
  player.onGround = false
  for gy = 1, MAP_H do
    for gx = 1, MAP_W do
      if LEVEL[gy][gx] == 2 then
        local tx = (gx - 1) * TILE
        local ty = (gy - 1) * TILE
        if rectsOverlap(player.x, player.y, player.w, player.h, tx, ty, TILE, TILE) then
          if player.vy > 0 then
            player.y = ty - player.h
            player.onGround = true
          elseif player.vy < 0 then
            player.y = ty + TILE
          end
          player.vy = 0
        end
      end
    end
  end
end

local function updateCoins()
  local cx = player.x + player.w * 0.5
  local cy = player.y + player.h * 0.5
  for i = 1, #coins do
    local coin = coins[i]
    if not coin.collected then
      local dx = math.abs(cx - (coin.x + 6))
      local dy = math.abs(cy - (coin.y + 6))
      if dx < 14 and dy < 14 then
        coin.collected = true
        score = score + 10
        dirty = true
      end
    end
  end
end

local function allCollected()
  for i = 1, #coins do
    if not coins[i].collected then return false end
  end
  return true
end

function M.load()
  resetGame()
end

function M.unload() end

function M.resize(w, h)
  W = math.max(1, math.floor(w or 1))
  H = math.max(1, math.floor(h or 1))
  dirty = true
end

function M.update(dt)
  if not player then return end

  local targetVx = 0
  if keys.left and not keys.right then targetVx = -cfg.moveSpeed end
  if keys.right and not keys.left then targetVx = cfg.moveSpeed end
  player.vx = targetVx

  if keys.jump and player.onGround then
    player.vy = -cfg.jumpForce
    player.onGround = false
  end
  keys.jump = false

  player.vy = math.min(cfg.maxFallSpeed, player.vy + cfg.gravity * dt)

  local oldX, oldY = player.x, player.y

  player.x = player.x + player.vx * dt
  resolveCollisionsHorizontal()

  player.y = player.y + player.vy * dt
  resolveCollisionsVertical()

  updateCoins()

  dirtyTimer = dirtyTimer + dt
  if dirtyTimer >= (1 / 20) then
    dirtyTimer = 0
    dirty = true
  end

  if math.abs(player.x - oldX) > 0.0001 or math.abs(player.y - oldY) > 0.0001 then
    dirty = true
  end
end

function M.draw()
  local ox, oy = mapOffsets()

  love.graphics.clear(0.12, 0.12, 0.18, 1)

  for gy = 1, MAP_H do
    for gx = 1, MAP_W do
      local t = LEVEL[gy][gx]
      if t ~= 0 then
        if t == 2 then love.graphics.setColor(0.35, 0.36, 0.44, 1) else love.graphics.setColor(0.27, 0.28, 0.35, 1) end
        love.graphics.rectangle("fill", ox + (gx - 1) * TILE, oy + (gy - 1) * TILE, TILE, TILE)
      end
    end
  end

  love.graphics.setColor(0.98, 0.89, 0.68, 1)
  for i = 1, #coins do
    local c = coins[i]
    if not c.collected then
      love.graphics.circle("fill", ox + c.x + 8, oy + c.y + 8, 5)
    end
  end

  love.graphics.setColor(0.54, 0.71, 0.98, 1)
  love.graphics.rectangle("fill", ox + player.x, oy + player.y, player.w, player.h, 2, 2)
end

function M.drawWithUI()
  M.draw()
end

function M.keypressed(key)
  if key == "left" or key == "a" then keys.left = true end
  if key == "right" or key == "d" then keys.right = true end
  if key == "up" or key == "w" or key == "space" then keys.jump = true end
end

function M.keyreleased(key)
  if key == "left" or key == "a" then keys.left = false end
  if key == "right" or key == "d" then keys.right = false end
end

function M.mousepressed() end
function M.mousereleased() end
function M.mousemoved() end

function M.getState()
  local collected = 0
  for i = 1, #coins do
    if coins[i].collected then collected = collected + 1 end
  end

  return {
    score = score,
    collected = collected,
    totalCoins = #coins,
    won = allCollected(),
  }
end

function M.isDirty()
  return dirty == true
end

function M.clearDirty()
  dirty = false
end

function M.onCommand(command, args)
  if command == "restart" then
    resetGame()
    return true
  end

  if command == "configure" then
    local c = args and args.config
    if type(c) == "table" then
      if type(c.gravity) == "number" then cfg.gravity = math.max(10, c.gravity) end
      if type(c.moveSpeed) == "number" then cfg.moveSpeed = math.max(10, c.moveSpeed) end
      if type(c.jumpForce) == "number" then cfg.jumpForce = math.max(10, c.jumpForce) end
      if type(c.maxFallSpeed) == "number" then cfg.maxFallSpeed = math.max(10, c.maxFallSpeed) end
      dirty = true
    end
    return true
  end
end

return M
