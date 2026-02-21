-- turnbased.lua
-- Lua-owned turn-based battle runtime for <Game module="turnbased" />.

local M = {}

local dirty = true
local battleLog = {}

local party = {}
local enemies = {}
local turnOrder = {}
local turnIndex = 1

local victory = false
local gameOver = false
local enemyTimer = 0
local awaitingEnemyAction = false

local level = 1
local xp = 0
local maxLevel = 20
local potions = 3

local function xpToNext(lv)
  return math.floor(50 * math.pow(1.3, lv - 1))
end

local function log(msg)
  battleLog[#battleLog + 1] = msg
  if #battleLog > 8 then table.remove(battleLog, 1) end
  dirty = true
end

local function isAlive(c)
  return c and c.hp > 0
end

local function effectiveDefense(c)
  if c.defendTurns and c.defendTurns > 0 then
    return c.defense * 2
  end
  return c.defense
end

local function applyDamage(target, amount)
  local dmg = math.max(1, math.floor(amount - effectiveDefense(target) * 0.3))
  target.hp = math.max(0, target.hp - dmg)
  if target.defendTurns and target.defendTurns > 0 then
    target.defendTurns = 0
  end
  return dmg
end

local function restoreHp(target, amount)
  target.hp = math.min(target.maxHp, target.hp + amount)
end

local function aliveParty()
  local t = {}
  for i = 1, #party do if isAlive(party[i]) then t[#t + 1] = party[i] end end
  return t
end

local function aliveEnemies()
  local t = {}
  for i = 1, #enemies do if isAlive(enemies[i]) then t[#t + 1] = enemies[i] end end
  return t
end

local function buildTurnOrder()
  turnOrder = {}
  for i = 1, #party do
    if isAlive(party[i]) then turnOrder[#turnOrder + 1] = party[i] end
  end
  for i = 1, #enemies do
    if isAlive(enemies[i]) then turnOrder[#turnOrder + 1] = enemies[i] end
  end
  table.sort(turnOrder, function(a, b) return (a.speed or 0) > (b.speed or 0) end)
  if #turnOrder == 0 then
    turnIndex = 1
  else
    turnIndex = ((turnIndex - 1) % #turnOrder) + 1
  end
end

local function currentTurn()
  if #turnOrder == 0 then return nil end
  return turnOrder[turnIndex]
end

local function checkWinLoss()
  if #aliveEnemies() == 0 then
    victory = true
    local gain = 30
    xp = xp + gain
    log("Victory! +" .. gain .. " XP")
    while level < maxLevel and xp >= xpToNext(level) do
      xp = xp - xpToNext(level)
      level = level + 1
      log("Party leveled up to " .. level .. "!")
    end
    return true
  end

  if #aliveParty() == 0 then
    gameOver = true
    log("Party wiped...")
    return true
  end
  return false
end

local function nextTurn()
  if checkWinLoss() then return end
  buildTurnOrder()
  if #turnOrder == 0 then return end
  turnIndex = turnIndex + 1
  if turnIndex > #turnOrder then turnIndex = 1 end
  dirty = true
end

local function resetBattle()
  party = {
    { id = "warrior", name = "Warrior", isPlayer = true, color = "#89b4fa", hp = 80, maxHp = 80, mp = 20, maxMp = 20, attack = 15, defense = 10, speed = 8, defendTurns = 0 },
    { id = "mage", name = "Mage", isPlayer = true, color = "#cba6f7", hp = 45, maxHp = 45, mp = 50, maxMp = 50, attack = 8, defense = 4, speed = 12, defendTurns = 0 },
    { id = "healer", name = "Healer", isPlayer = true, color = "#a6e3a1", hp = 55, maxHp = 55, mp = 40, maxMp = 40, attack = 6, defense = 6, speed = 10, defendTurns = 0 },
  }
  enemies = {
    { id = "slime", name = "Slime", isPlayer = false, color = "#a6e3a1", hp = 60, maxHp = 60, attack = 10, defense = 3, speed = 5, defendTurns = 0 },
    { id = "goblin", name = "Goblin", isPlayer = false, color = "#f9e2af", hp = 45, maxHp = 45, attack = 14, defense = 5, speed = 9, defendTurns = 0 },
  }
  battleLog = { "A wild Slime appeared!" }
  victory = false
  gameOver = false
  awaitingEnemyAction = false
  enemyTimer = 0
  turnIndex = 1
  buildTurnOrder()
  potions = 3
  dirty = true
end

local function doEnemyTurn(actor)
  local targets = aliveParty()
  if #targets == 0 then return end
  local target = targets[math.random(1, #targets)]
  local dmg = applyDamage(target, actor.attack)
  log(actor.name .. " attacks " .. target.name .. " for " .. dmg .. " dmg")
  nextTurn()
end

local function listTeam(src)
  local out = {}
  for i = 1, #src do
    local c = src[i]
    out[#out + 1] = {
      id = c.id,
      name = c.name,
      isPlayer = c.isPlayer,
      color = c.color,
      hp = c.hp,
      maxHp = c.maxHp,
      mp = c.mp,
      maxMp = c.maxMp,
      alive = isAlive(c),
      defending = c.defendTurns and c.defendTurns > 0 or false,
    }
  end
  return out
end

function M.load()
  if level < 1 then level = 1 end
  if xp < 0 then xp = 0 end
  resetBattle()
end

function M.unload() end
function M.resize() end

function M.update(dt)
  if victory or gameOver then return end
  local actor = currentTurn()
  if not actor then return end

  if not actor.isPlayer then
    if not awaitingEnemyAction then
      awaitingEnemyAction = true
      enemyTimer = 0.8
    else
      enemyTimer = enemyTimer - dt
      if enemyTimer <= 0 then
        awaitingEnemyAction = false
        doEnemyTurn(actor)
      end
    end
  else
    awaitingEnemyAction = false
  end
end

function M.draw()
  love.graphics.clear(0.07, 0.07, 0.12, 1)
end

function M.drawWithUI()
  M.draw()
end

function M.keypressed() end
function M.keyreleased() end
function M.mousepressed() end
function M.mousereleased() end
function M.mousemoved() end

function M.getState()
  local actor = currentTurn()
  return {
    phase = gameOver and "gameover" or (victory and "victory" or "play"),
    party = listTeam(party),
    enemies = listTeam(enemies),
    turnName = actor and actor.name or nil,
    isPlayerTurn = actor and actor.isPlayer or false,
    victory = victory,
    gameOver = gameOver,
    battleLog = battleLog,
    level = level,
    xp = xp,
    xpToNext = xpToNext(level),
    potions = potions,
  }
end

function M.isDirty()
  return dirty == true
end

function M.clearDirty()
  dirty = false
end

function M.onCommand(command)
  if command == "restart" then
    resetBattle()
    return true
  end

  if victory or gameOver then
    return false
  end

  local actor = currentTurn()
  if not actor or not actor.isPlayer then
    return false
  end

  if command == "attack" then
    local targets = aliveEnemies()
    if #targets == 0 then return false end
    local target = targets[1]
    local dmg = applyDamage(target, actor.attack)
    log(actor.name .. " attacks " .. target.name .. " for " .. dmg .. " dmg")
    nextTurn()
    return true
  end

  if command == "defend" then
    actor.defendTurns = 1
    log(actor.name .. " defends! Defense doubled.")
    nextTurn()
    return true
  end

  if command == "skill" then
    if not actor.mp or actor.mp < 10 then
      log("Not enough MP!")
      return false
    end
    actor.mp = actor.mp - 10
    local targets = aliveEnemies()
    for i = 1, #targets do
      local target = targets[i]
      local dmg = applyDamage(target, actor.attack * 1.5)
      log(actor.name .. " casts Fire! " .. target.name .. " takes " .. dmg .. " dmg")
    end
    nextTurn()
    return true
  end

  if command == "potion" then
    if potions <= 0 then
      log("No potions left!")
      return false
    end
    local allies = aliveParty()
    if #allies == 0 then return false end

    local target = allies[1]
    local lowestRatio = target.hp / target.maxHp
    for i = 2, #allies do
      local c = allies[i]
      local ratio = c.hp / c.maxHp
      if ratio < lowestRatio then
        target = c
        lowestRatio = ratio
      end
    end

    potions = potions - 1
    restoreHp(target, 30)
    log(actor.name .. " uses Potion on " .. target.name .. ". +30 HP")
    nextTurn()
    return true
  end

  return false
end

return M
