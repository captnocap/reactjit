-- roguelite.lua
-- Lua-owned roguelite runtime for <Game module="roguelite" />.

local M = {}

local MAP_W = 40
local MAP_H = 30
local TILE = 14
local VIEW_W = 20
local VIEW_H = 15

local W, H = 640, 360

local cfg = {
  moveCooldown = 0.12,
  viewRadius = 4,
  enemySenseRange = 8,
}

local map = {}
local player = nil
local enemies = {}
local floor = 1
local score = 0
local gameOver = false
local messages = {}
local inventory = {}
local hp = 50
local maxHp = 50
local attack = 8
local defense = 3
local moveTimer = 0
local dirty = true
local dirtyTimer = 0

local keys = { up = false, down = false, left = false, right = false }
local visible = {}
local revealed = {}

local function addMessage(msg)
  messages[#messages + 1] = msg
  if #messages > 8 then
    table.remove(messages, 1)
  end
  dirty = true
end

local function mapGet(x, y)
  if x < 1 or x > MAP_W or y < 1 or y > MAP_H then return 2 end
  return map[y][x]
end

local function isSolid(x, y)
  return mapGet(x, y) == 2
end

local function carveRoom(x, y, w, h)
  for gy = y, y + h - 1 do
    for gx = x, x + w - 1 do
      if gx >= 2 and gx <= MAP_W - 1 and gy >= 2 and gy <= MAP_H - 1 then
        map[gy][gx] = 1
      end
    end
  end
end

local function carveCorridor(x1, y1, x2, y2)
  local x = x1
  local y = y1
  while x ~= x2 do
    map[y][x] = 1
    x = x + (x2 > x and 1 or -1)
  end
  while y ~= y2 do
    map[y][x] = 1
    y = y + (y2 > y and 1 or -1)
  end
  map[y][x] = 1
end

local function generateDungeon()
  map = {}
  for y = 1, MAP_H do
    map[y] = {}
    for x = 1, MAP_W do
      map[y][x] = 2
    end
  end

  local rooms = {}
  local roomCount = 8 + math.random(0, 3)
  for i = 1, roomCount do
    local rw = math.random(4, 8)
    local rh = math.random(4, 8)
    local rx = math.random(2, MAP_W - rw - 1)
    local ry = math.random(2, MAP_H - rh - 1)
    carveRoom(rx, ry, rw, rh)
    rooms[#rooms + 1] = {
      x = rx, y = ry, w = rw, h = rh,
      cx = math.floor(rx + rw * 0.5),
      cy = math.floor(ry + rh * 0.5),
    }
  end

  table.sort(rooms, function(a, b) return a.cx < b.cx end)
  for i = 2, #rooms do
    carveCorridor(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy)
  end

  return rooms
end

local function resetVisibility()
  visible = {}
  revealed = {}
  for y = 1, MAP_H do
    visible[y] = {}
    revealed[y] = {}
    for x = 1, MAP_W do
      visible[y][x] = false
      revealed[y][x] = false
    end
  end
end

local function updateVisibility()
  for y = 1, MAP_H do
    for x = 1, MAP_W do
      visible[y][x] = false
    end
  end

  local r = cfg.viewRadius
  for y = player.y - r, player.y + r do
    for x = player.x - r, player.x + r do
      if x >= 1 and x <= MAP_W and y >= 1 and y <= MAP_H then
        local dx = x - player.x
        local dy = y - player.y
        if (dx * dx + dy * dy) <= (r * r) then
          visible[y][x] = true
          revealed[y][x] = true
        end
      end
    end
  end
end

local function addInventory(item, quantity)
  local current = inventory[item] or 0
  inventory[item] = current + quantity
  dirty = true
end

local function rollLoot()
  local r = math.random()
  if r < 0.6 then
    addInventory("gold", math.random(1, 5))
  elseif r < 0.9 then
    addInventory("potion", 1)
  else
    addInventory("gem", 1)
  end
end

local function setupFloor()
  local rooms = generateDungeon()
  if #rooms == 0 then return end

  player = { x = rooms[1].cx, y = rooms[1].cy }
  enemies = {}

  for i = 2, #rooms do
    enemies[#enemies + 1] = {
      x = rooms[i].cx,
      y = rooms[i].cy,
      hp = (i == #rooms) and (25 + floor * 8) or (15 + floor * 5),
      attack = (i == #rooms) and (6 + floor * 2) or (3 + floor * 2),
      type = (i == #rooms) and "boss" or "skeleton",
      alive = true,
    }
  end

  resetVisibility()
  updateVisibility()
  moveTimer = 0
  dirty = true
end

local function findEnemyAt(x, y)
  for i = 1, #enemies do
    local e = enemies[i]
    if e.alive and e.x == x and e.y == y then return e, i end
  end
  return nil, nil
end

local function enemyCountAlive()
  local n = 0
  for i = 1, #enemies do
    if enemies[i].alive then n = n + 1 end
  end
  return n
end

local function tryMovePlayer(dx, dy)
  local nx = player.x + dx
  local ny = player.y + dy

  if isSolid(nx, ny) then return end

  local enemy = findEnemyAt(nx, ny)
  if enemy then
    local dmg = math.max(1, attack - enemy.attack * 0.3)
    enemy.hp = enemy.hp - dmg
    addMessage("Hit " .. enemy.type .. " for " .. math.floor(dmg) .. " dmg")

    if enemy.hp <= 0 then
      enemy.alive = false
      rollLoot()
      if enemy.type == "boss" then
        score = score + 50
      else
        score = score + 10
      end
      addMessage("Defeated " .. enemy.type .. "!")
    else
      local eDmg = math.max(1, enemy.attack - defense * 0.5)
      hp = hp - eDmg
      addMessage(enemy.type .. " hits back for " .. math.floor(eDmg))
      if hp <= 0 then
        hp = 0
        gameOver = true
        addMessage("You died!")
      end
    end
    dirty = true
    return
  end

  player.x = nx
  player.y = ny
  updateVisibility()
  dirty = true
end

local function moveEnemies()
  for i = 1, #enemies do
    local e = enemies[i]
    if e.alive then
      local dx = player.x - e.x
      local dy = player.y - e.y
      local dist = math.abs(dx) + math.abs(dy)
      if dist <= cfg.enemySenseRange then
        local stepX = (dx > 0 and 1) or (dx < 0 and -1) or 0
        local stepY = (dy > 0 and 1) or (dy < 0 and -1) or 0

        local candidates = {}
        if stepX ~= 0 and stepY ~= 0 then
          candidates = { { stepX, 0 }, { 0, stepY } }
        elseif stepX ~= 0 then
          candidates = { { stepX, 0 }, { 0, 1 }, { 0, -1 } }
        else
          candidates = { { 0, stepY }, { 1, 0 }, { -1, 0 } }
        end

        for j = 1, #candidates do
          local cx = candidates[j][1]
          local cy = candidates[j][2]
          local tx = e.x + cx
          local ty = e.y + cy
          if tx == player.x and ty == player.y then break end
          if not isSolid(tx, ty) and not findEnemyAt(tx, ty) then
            e.x = tx
            e.y = ty
            break
          end
        end
      end
    end
  end
end

local function listInventory()
  local out = {}
  for name, qty in pairs(inventory) do
    out[#out + 1] = { name = name, quantity = qty }
  end
  table.sort(out, function(a, b) return a.name < b.name end)
  return out
end

function M.load()
  floor = 1
  score = 0
  hp = maxHp
  gameOver = false
  inventory = {}
  messages = { "Entered the dungeon..." }
  setupFloor()
end

function M.unload() end

function M.resize(w, h)
  W = math.max(1, math.floor(w or 1))
  H = math.max(1, math.floor(h or 1))
end

function M.update(dt)
  if gameOver then
    dirtyTimer = dirtyTimer + dt
    if dirtyTimer >= 0.25 then dirty = true; dirtyTimer = 0 end
    return
  end

  moveTimer = moveTimer + dt
  if moveTimer < cfg.moveCooldown then
    dirtyTimer = dirtyTimer + dt
    if dirtyTimer >= 0.25 then dirty = true; dirtyTimer = 0 end
    return
  end

  local dx, dy = 0, 0
  if keys.up then dy = -1
  elseif keys.down then dy = 1
  elseif keys.left then dx = -1
  elseif keys.right then dx = 1
  else
    return
  end

  moveTimer = 0
  tryMovePlayer(dx, dy)
  if not gameOver then moveEnemies() end

  if enemyCountAlive() == 0 and not gameOver then
    floor = floor + 1
    addMessage("Descending to floor " .. floor .. "...")
    setupFloor()
  end
end

function M.draw()
  love.graphics.clear(0.07, 0.07, 0.12, 1)

  local worldW = VIEW_W * TILE
  local worldH = VIEW_H * TILE
  local ox = math.floor((W - worldW) * 0.5)
  local oy = math.floor((H - worldH) * 0.5)

  local camX = player.x - math.floor(VIEW_W * 0.5)
  local camY = player.y - math.floor(VIEW_H * 0.5)

  for vy = 0, VIEW_H - 1 do
    for vx = 0, VIEW_W - 1 do
      local gx = camX + vx
      local gy = camY + vy
      if gx >= 1 and gx <= MAP_W and gy >= 1 and gy <= MAP_H then
        if revealed[gy][gx] then
          if map[gy][gx] == 2 then
            love.graphics.setColor(0.35, 0.36, 0.44, visible[gy][gx] and 1 or 0.45)
          else
            love.graphics.setColor(0.19, 0.2, 0.27, visible[gy][gx] and 1 or 0.45)
          end
          love.graphics.rectangle("fill", ox + vx * TILE, oy + vy * TILE, TILE, TILE)
        end
      end
    end
  end

  for i = 1, #enemies do
    local e = enemies[i]
    if e.alive then
      local vx = e.x - camX
      local vy = e.y - camY
      if vx >= 0 and vx < VIEW_W and vy >= 0 and vy < VIEW_H and visible[e.y][e.x] then
        if e.type == "boss" then
          love.graphics.setColor(0.95, 0.55, 0.65, 1)
        else
          love.graphics.setColor(0.92, 0.63, 0.68, 1)
        end
        love.graphics.rectangle("fill", ox + vx * TILE + 2, oy + vy * TILE + 2, TILE - 4, TILE - 4, 2, 2)
      end
    end
  end

  love.graphics.setColor(0.54, 0.71, 0.98, 1)
  love.graphics.rectangle("fill", ox + math.floor(VIEW_W * 0.5) * TILE + 2, oy + math.floor(VIEW_H * 0.5) * TILE + 2, TILE - 4, TILE - 4, 2, 2)
end

function M.drawWithUI()
  M.draw()
end

function M.keypressed(key)
  if key == "up" or key == "w" then keys.up = true end
  if key == "down" or key == "s" then keys.down = true end
  if key == "left" or key == "a" then keys.left = true end
  if key == "right" or key == "d" then keys.right = true end
end

function M.keyreleased(key)
  if key == "up" or key == "w" then keys.up = false end
  if key == "down" or key == "s" then keys.down = false end
  if key == "left" or key == "a" then keys.left = false end
  if key == "right" or key == "d" then keys.right = false end
end

function M.mousepressed() end
function M.mousereleased() end
function M.mousemoved() end

function M.getState()
  return {
    floor = floor,
    score = score,
    hp = hp,
    maxHp = maxHp,
    gameOver = gameOver,
    enemiesAlive = enemyCountAlive(),
    inventory = listInventory(),
    messages = messages,
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
    M.load()
    return true
  end

  if command == "configure" then
    local c = args and args.config
    if type(c) == "table" then
      if type(c.moveCooldown) == "number" then cfg.moveCooldown = math.max(0.03, c.moveCooldown) end
      if type(c.viewRadius) == "number" then cfg.viewRadius = math.max(2, math.floor(c.viewRadius)) end
      if type(c.enemySenseRange) == "number" then cfg.enemySenseRange = math.max(1, math.floor(c.enemySenseRange)) end
      dirty = true
    end
    return true
  end
end

return M
