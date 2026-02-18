-- blackhole.lua
-- Single-module port of the Blackhole Love2D game.
-- Returns a table with load/unload/update/draw/drawWithUI/resize/keypressed/
-- mousepressed/mousemoved/isDirty/getState/clearDirty/onCommand methods.

local M = {}

-- ---------------------------------------------------------------------------
-- Constants & data (from globals.lua)
-- ---------------------------------------------------------------------------

local W, H = 1280, 720

local COLORS = {
    bg        = {0.02, 0.02, 0.06, 1},
    blackhole = {0, 0, 0, 1},
    field     = {0.4, 0.2, 0.9, 0.3},
    field_rim = {0.6, 0.3, 1.0, 0.7},
    brown     = {0.55, 0.35, 0.17, 1},
    silver    = {0.75, 0.75, 0.78, 1},
    dgreen    = {0.13, 0.55, 0.13, 1},
    lgreen    = {0.56, 0.93, 0.56, 1},
    magenta   = {0.86, 0.24, 0.62, 1},
    cyan      = {0.0, 0.90, 0.93, 1},
}

local ASTEROID_DATA = {
    [1] = { color = "brown",   hp = 3,  size_pct = 0.028, time_bonus = 0.18 },
    [2] = { color = "silver",  hp = 4,  size_pct = 0.039, time_bonus = 0.24 },
    [3] = { color = "dgreen",  hp = 5,  size_pct = 0.050, time_bonus = 0.30 },
    [4] = { color = "lgreen",  hp = 7,  size_pct = 0.061, time_bonus = 0.39 },
    [5] = { color = "magenta", hp = 9,  size_pct = 0.072, time_bonus = 0.48 },
    [6] = { color = "cyan",    hp = 11, size_pct = 0.089, time_bonus = 0.60 },
}

local BASE = {
    round_time          = 16,
    asteroids_per_round = 40,
    field_radius        = 28,
    respawn_chance      = 0,
    time_chance         = 0,
    damage_per_tick     = 1,
    ticks_per_second    = 2,
    point_multiplier    = 1,
    max_asteroids       = 200,
    max_asteroid_level  = 1,
}

local UPGRADES = {
    field_size     = { label = "Energy Field Size",  base_cost = 8,   cost_scale = 2.8, increment = 8 },
    damage         = { label = "Damage Per Tick",    base_cost = 10,  cost_scale = 2.9, increment = 1 },
    tick_rate      = { label = "Ticks Per Second",   base_cost = 8,   cost_scale = 2.8, increment = 0.5 },
    point_value    = { label = "Point Multiplier",   base_cost = 12,  cost_scale = 3.0, increment = 0.25 },
    round_time     = { label = "Base Round Time",    base_cost = 8,   cost_scale = 2.7, increment = 2 },
    spawn_quantity = { label = "Asteroid Quantity",  base_cost = 10,  cost_scale = 2.8, increment = 5 },
    respawn_chance = { label = "Respawn Chance",     base_cost = 12,  cost_scale = 3.0, increment = 5 },
    time_chance    = { label = "Time Bonus Chance",  base_cost = 8,   cost_scale = 2.8, increment = 5 },
    asteroid_level = { label = "Asteroid Level",     base_cost = 0,   cost_scale = 0,   increment = 1, max_level = 5,
                       fixed_costs = {30, 120, 400, 1200, 4000} },
}

local UPGRADE_ORDER = {
    "field_size", "damage", "tick_rate", "point_value",
    "round_time", "spawn_quantity", "respawn_chance", "time_chance", "asteroid_level",
}

-- ---------------------------------------------------------------------------
-- Font cache
-- ---------------------------------------------------------------------------

local fonts = {}
local function getFont(size)
    if not fonts[size] then
        fonts[size] = love.graphics.newFont(size)
    end
    return fonts[size]
end

-- ---------------------------------------------------------------------------
-- Internal state
-- ---------------------------------------------------------------------------

local screen        -- "title" | "playing" | "roundover" | "shop"
local dirty
local game_data     -- persistent across rounds: round, points, upgrade_levels
local mouse_x, mouse_y

-- Title state
local title_pulse

-- Playing state
local blackhole     -- { x, y, base_radius, pulse, particle_system }
local field         -- { x, y, radius, damage, ticks_per_second, tick_timer, is_ticking, pulse_alpha }
local asteroids     -- array of asteroid tables
local round_timer
local round_points
local round_destroyed
local play_stats    -- computed stats for current round

-- Particle system
local particle_emitters
local particle_base_image

-- Round over state
local round_over_stats
local round_over_timer
local round_over_alpha

-- Shop state
local shop_hover_index

-- Dirty throttle for timer updates
local dirty_timer_acc

-- ---------------------------------------------------------------------------
-- Asteroid helpers
-- ---------------------------------------------------------------------------

local function asteroid_generate_shape(a)
    local n = math.random(8, 12)
    a.vertices = {}
    for i = 1, n do
        local ang = (i / n) * math.pi * 2
        local r = a.radius * (0.7 + math.random() * 0.3)
        table.insert(a.vertices, math.cos(ang) * r)
        table.insert(a.vertices, math.sin(ang) * r)
    end
end

local function asteroid_compute_orbit(a)
    local cx, cy = W / 2, H / 2
    local dx = a.x - cx
    local dy = a.y - cy
    a.orbit_radius = math.sqrt(dx * dx + dy * dy)
    a.angle = math.atan2(dy, dx)
end

local function asteroid_new(level, x, y, angle, speed)
    local data = ASTEROID_DATA[level]
    local canvas_min = math.min(W, H)
    local radius = canvas_min * data.size_pct

    local a = {
        level       = level,
        hp          = data.hp,
        max_hp      = data.hp,
        radius      = radius,
        time_bonus  = data.time_bonus,
        color_key   = data.color,
        x           = x,
        y           = y,
        angle       = angle or math.random() * math.pi * 2,
        orbit_radius = 0,
        angular_vel = speed or (0.05 + math.random() * 0.1),
        drift_speed = 2 + math.random() * 3,
        rotation    = math.random() * math.pi * 2,
        rot_speed   = (math.random() - 0.5) * 2,
        vertices    = {},
        alive       = true,
        flash_timer = 0,
    }
    asteroid_generate_shape(a)
    asteroid_compute_orbit(a)
    return a
end

local function asteroid_update(a, dt)
    if not a.alive then return end
    local cx, cy = W / 2, H / 2
    a.angle = a.angle + a.angular_vel * dt
    a.orbit_radius = math.max(40, a.orbit_radius - a.drift_speed * dt)
    a.x = cx + math.cos(a.angle) * a.orbit_radius
    a.y = cy + math.sin(a.angle) * a.orbit_radius
    a.rotation = a.rotation + a.rot_speed * dt
    a.flash_timer = math.max(0, a.flash_timer - dt)
end

local function asteroid_take_damage(a, amount)
    a.hp = a.hp - amount
    a.flash_timer = 0.15
    if a.hp <= 0 then
        a.alive = false
    end
end

local function asteroid_draw(a)
    if not a.alive then return end

    love.graphics.push()
    love.graphics.translate(a.x, a.y)
    love.graphics.rotate(a.rotation)

    if a.flash_timer > 0 then
        love.graphics.setColor(1, 1, 1, 0.8)
    else
        local c = COLORS[a.color_key]
        love.graphics.setColor(c)
    end

    if #a.vertices >= 6 then
        love.graphics.polygon("fill", a.vertices)
    end

    local c = COLORS[a.color_key]
    love.graphics.setColor(c[1] + 0.2, c[2] + 0.2, c[3] + 0.2, 0.6)
    love.graphics.setLineWidth(1)
    if #a.vertices >= 6 then
        love.graphics.polygon("line", a.vertices)
    end

    love.graphics.pop()

    -- HP bar on damaged asteroids
    if a.hp < a.max_hp then
        local bar_w = a.radius * 2
        local bar_h = 3
        local bx = a.x - bar_w / 2
        local by = a.y - a.radius - 8
        love.graphics.setColor(0.2, 0.2, 0.2, 0.7)
        love.graphics.rectangle("fill", bx, by, bar_w, bar_h)
        love.graphics.setColor(0.2, 0.9, 0.3, 0.8)
        love.graphics.rectangle("fill", bx, by, bar_w * (a.hp / a.max_hp), bar_h)
    end
end

-- ---------------------------------------------------------------------------
-- Blackhole entity helpers
-- ---------------------------------------------------------------------------

local function blackhole_init_particles(bh)
    local img = love.graphics.newCanvas(8, 8)
    love.graphics.setCanvas(img)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.circle("fill", 4, 4, 4)
    love.graphics.setCanvas()

    local ps = love.graphics.newParticleSystem(img, 200)
    ps:setParticleLifetime(1, 3)
    ps:setEmissionRate(30)
    ps:setSizes(0.5, 0.1)
    ps:setColors(0.4, 0.2, 0.9, 0.6, 0.1, 0.05, 0.2, 0)
    ps:setSpeed(5, 20)
    ps:setSpread(math.pi * 2)
    ps:setLinearDamping(2)
    bh.particle_system = ps
end

local function blackhole_new()
    local bh = {
        x = W / 2,
        y = H / 2,
        base_radius = 30,
        pulse = 0,
        particle_system = nil,
    }
    blackhole_init_particles(bh)
    return bh
end

local function blackhole_update(bh, dt)
    bh.pulse = bh.pulse + dt * 2
    bh.x = W / 2
    bh.y = H / 2
    if bh.particle_system then
        bh.particle_system:setPosition(bh.x, bh.y)
        bh.particle_system:update(dt)
    end
end

local function blackhole_draw(bh)
    love.graphics.setBlendMode("add")
    for i = 4, 1, -1 do
        local alpha = 0.06 / i
        local r = bh.base_radius + i * 15 + math.sin(bh.pulse) * 3
        love.graphics.setColor(0.3, 0.1, 0.6, alpha)
        love.graphics.circle("fill", bh.x, bh.y, r)
    end
    love.graphics.setBlendMode("alpha")

    love.graphics.setColor(0, 0, 0, 1)
    love.graphics.circle("fill", bh.x, bh.y, bh.base_radius)

    if bh.particle_system then
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.draw(bh.particle_system)
    end
end

-- ---------------------------------------------------------------------------
-- Energy field helpers
-- ---------------------------------------------------------------------------

local function field_new(stats)
    return {
        x = W / 2,
        y = H / 2,
        radius = stats.field_radius,
        damage = stats.damage_per_tick,
        ticks_per_second = stats.ticks_per_second,
        tick_timer = 0,
        is_ticking = false,
        pulse_alpha = 0,
    }
end

local function field_update(f, dt, mx, my)
    local lerp_speed = 8
    f.x = f.x + (mx - f.x) * lerp_speed * dt
    f.y = f.y + (my - f.y) * lerp_speed * dt

    f.tick_timer = f.tick_timer + dt
    local tick_interval = 1 / f.ticks_per_second
    f.is_ticking = false
    if f.tick_timer >= tick_interval then
        f.tick_timer = f.tick_timer - tick_interval
        f.is_ticking = true
        f.pulse_alpha = 1.0
    end

    f.pulse_alpha = math.max(0, f.pulse_alpha - dt * 4)
end

local function field_draw(f)
    if f.pulse_alpha > 0 then
        love.graphics.setColor(0.7, 0.3, 1.0, f.pulse_alpha * 0.5)
        love.graphics.setLineWidth(3)
        love.graphics.circle("line", f.x, f.y, f.radius + 5)
    end

    love.graphics.setColor(0.4, 0.2, 0.9, 0.15)
    love.graphics.circle("fill", f.x, f.y, f.radius)

    love.graphics.setColor(0.6, 0.3, 1.0, 0.5 + f.pulse_alpha * 0.3)
    love.graphics.setLineWidth(2)
    love.graphics.circle("line", f.x, f.y, f.radius)
end

local function field_contains(f, ax, ay, a_radius)
    local dx = f.x - ax
    local dy = f.y - ay
    local dist = math.sqrt(dx * dx + dy * dy)
    return (dist + a_radius) <= f.radius
end

-- ---------------------------------------------------------------------------
-- Spawner helpers
-- ---------------------------------------------------------------------------

local function spawner_get_level_weights(max_level)
    local weights = {}
    max_level = math.min(6, max_level)
    for lvl = 1, max_level do
        local w = math.max(5, 30 - (lvl - 1) * 5)
        table.insert(weights, { level = lvl, weight = w })
    end
    return weights
end

local function spawner_pick_level(weights)
    local total = 0
    for _, entry in ipairs(weights) do
        total = total + entry.weight
    end
    local roll = math.random() * total
    local acc = 0
    for _, entry in ipairs(weights) do
        acc = acc + entry.weight
        if roll <= acc then
            return entry.level
        end
    end
    return weights[#weights].level
end

local function spawner_spawn_round(round, count, max_level)
    local result = {}
    local weights = spawner_get_level_weights(max_level or 1)
    local cx, cy = W / 2, H / 2
    local min_dist = 200
    local max_dist = math.max(W, H) * 0.45

    for i = 1, count do
        local level = spawner_pick_level(weights)
        local angle = math.random() * math.pi * 2
        local dist = min_dist + math.random() * (max_dist - min_dist)
        local x = cx + math.cos(angle) * dist
        local y = cy + math.sin(angle) * dist
        local speed = 0.05 + math.random() * 0.1
        table.insert(result, asteroid_new(level, x, y, angle, speed))
    end
    return result
end

local function spawner_split(parent)
    if parent.level <= 1 then
        return {}
    end
    local children = {}
    local child_level = parent.level - 1
    for i = 1, 2 do
        local offset_angle = parent.angle + (i == 1 and -0.3 or 0.3)
        local offset_dist = parent.orbit_radius + (math.random() - 0.5) * 20
        offset_dist = math.max(50, offset_dist)
        local x = W / 2 + math.cos(offset_angle) * offset_dist
        local y = H / 2 + math.sin(offset_angle) * offset_dist
        local speed = parent.angular_vel * (1.0 + math.random() * 0.15)
        table.insert(children, asteroid_new(child_level, x, y, offset_angle, speed))
    end
    return children
end

-- ---------------------------------------------------------------------------
-- Physics helpers
-- ---------------------------------------------------------------------------

local function physics_update(ast_list, dt)
    local consumed = 0
    for i = #ast_list, 1, -1 do
        local a = ast_list[i]
        asteroid_update(a, dt)
        if a.orbit_radius <= 40 then
            a.alive = false
            table.remove(ast_list, i)
            consumed = consumed + 1
        end
    end
    return consumed
end

-- ---------------------------------------------------------------------------
-- Damage helpers
-- ---------------------------------------------------------------------------

local function damage_process_tick(f, ast_list, point_multiplier, respawn_chance, round, time_chance)
    if not f.is_ticking then
        return 0, 0, {}, {}
    end

    local points = 0
    local time_added = 0
    local new_asteroids = {}
    local destroyed_positions = {}

    for i = #ast_list, 1, -1 do
        local a = ast_list[i]
        if a.alive and field_contains(f, a.x, a.y, a.radius) then
            asteroid_take_damage(a, f.damage)

            if not a.alive then
                points = points + a.level * point_multiplier

                if time_chance and time_chance > 0 then
                    if math.random() * 100 < time_chance then
                        time_added = time_added + a.time_bonus
                    end
                end

                table.insert(destroyed_positions, { x = a.x, y = a.y, level = a.level })

                local children = spawner_split(a)
                for _, child in ipairs(children) do
                    table.insert(new_asteroids, child)
                end

                if respawn_chance and respawn_chance > 0 then
                    if math.random() * 100 < respawn_chance then
                        local cx, cy = W / 2, H / 2
                        local min_dist = 200
                        local max_dist = math.max(W, H) * 0.45
                        local angle = math.random() * math.pi * 2
                        local dist = min_dist + math.random() * (max_dist - min_dist)
                        local x = cx + math.cos(angle) * dist
                        local y = cy + math.sin(angle) * dist
                        local speed = 0.05 + math.random() * 0.1
                        table.insert(new_asteroids, asteroid_new(a.level, x, y, angle, speed))
                    end
                end

                table.remove(ast_list, i)
            end
        end
    end

    return points, time_added, new_asteroids, destroyed_positions
end

-- ---------------------------------------------------------------------------
-- Explosion particles
-- ---------------------------------------------------------------------------

local function particles_init()
    local size = 8
    local img = love.graphics.newCanvas(size, size)
    love.graphics.setCanvas(img)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.circle("fill", size / 2, size / 2, size / 2)
    love.graphics.setCanvas()
    particle_base_image = img
    particle_emitters = {}
end

local function particles_burst(x, y, color, count, speed)
    if not particle_base_image then return end
    local ps = love.graphics.newParticleSystem(particle_base_image, count)
    ps:setParticleLifetime(0.3, 0.8)
    ps:setEmissionRate(0)
    ps:setSizes(0.6, 0.1)
    ps:setColors(color[1], color[2], color[3], 0.9,
                 color[1], color[2], color[3], 0)
    ps:setSpeed(speed or 50, (speed or 50) * 2)
    ps:setSpread(math.pi * 2)
    ps:setPosition(x, y)
    ps:emit(count)
    table.insert(particle_emitters, ps)
end

local function particles_update(dt)
    if not particle_emitters then return end
    for i = #particle_emitters, 1, -1 do
        particle_emitters[i]:update(dt)
        if particle_emitters[i]:getCount() == 0 then
            table.remove(particle_emitters, i)
        end
    end
end

local function particles_draw()
    if not particle_emitters then return end
    love.graphics.setBlendMode("add")
    love.graphics.setColor(1, 1, 1, 1)
    for _, ps in ipairs(particle_emitters) do
        love.graphics.draw(ps)
    end
    love.graphics.setBlendMode("alpha")
end

-- ---------------------------------------------------------------------------
-- Shop helpers
-- ---------------------------------------------------------------------------

local function shop_get_upgrade_cost(name)
    local def = UPGRADES[name]
    local level = game_data.upgrade_levels[name]
    if def.fixed_costs then
        if level < #def.fixed_costs then
            return def.fixed_costs[level + 1]
        end
        return nil -- maxed
    end
    return math.floor(def.base_cost * def.cost_scale ^ level)
end

local function shop_is_maxed(name)
    local def = UPGRADES[name]
    if def.max_level then
        return game_data.upgrade_levels[name] >= def.max_level
    end
    return false
end

local function shop_get_stat_preview(name)
    local ul = game_data.upgrade_levels
    local def = UPGRADES[name]
    local current, next_val

    if name == "field_size" then
        current = BASE.field_radius + ul.field_size * def.increment
        next_val = current + def.increment
        return string.format("%.0f -> %.0f px", current, next_val)
    elseif name == "damage" then
        current = BASE.damage_per_tick + ul.damage * def.increment
        next_val = current + def.increment
        return string.format("%.0f -> %.0f dmg", current, next_val)
    elseif name == "tick_rate" then
        current = BASE.ticks_per_second + ul.tick_rate * def.increment
        next_val = current + def.increment
        return string.format("%.1f -> %.1f /sec", current, next_val)
    elseif name == "point_value" then
        current = BASE.point_multiplier + ul.point_value * def.increment
        next_val = current + def.increment
        return string.format("%.2fx -> %.2fx", current, next_val)
    elseif name == "round_time" then
        current = BASE.round_time + ul.round_time * def.increment
        next_val = current + def.increment
        return string.format("%.0f -> %.0fs base", current, next_val)
    elseif name == "spawn_quantity" then
        current = BASE.asteroids_per_round + ul.spawn_quantity * def.increment
        next_val = current + def.increment
        return string.format("%.0f -> %.0f asteroids", current, next_val)
    elseif name == "respawn_chance" then
        current = BASE.respawn_chance + ul.respawn_chance * def.increment
        next_val = current + def.increment
        return string.format("%.0f%% -> %.0f%%", current, next_val)
    elseif name == "time_chance" then
        current = BASE.time_chance + ul.time_chance * def.increment
        next_val = current + def.increment
        return string.format("%.0f%% -> %.0f%%", current, next_val)
    elseif name == "asteroid_level" then
        local names = {"Brown", "Silver", "Green", "Lt Green", "Magenta", "Cyan"}
        current = BASE.max_asteroid_level + ul.asteroid_level
        if current >= 6 then
            return "Max level unlocked"
        end
        return string.format("Unlock Lv %d (%s)", current + 1, names[current + 1])
    end
    return ""
end

local function shop_try_buy(name)
    if shop_is_maxed(name) then return end
    local cost = shop_get_upgrade_cost(name)
    if cost and game_data.points >= cost then
        game_data.points = game_data.points - cost
        game_data.upgrade_levels[name] = game_data.upgrade_levels[name] + 1
        dirty = true
    end
end

-- ---------------------------------------------------------------------------
-- Internal state transitions
-- ---------------------------------------------------------------------------

local function enter_title()
    screen = "title"
    title_pulse = 0
    dirty = true
end

local function compute_play_stats()
    local ul = game_data.upgrade_levels
    return {
        field_radius       = BASE.field_radius + ul.field_size * UPGRADES.field_size.increment,
        damage_per_tick    = BASE.damage_per_tick + ul.damage * UPGRADES.damage.increment,
        ticks_per_second   = BASE.ticks_per_second + ul.tick_rate * UPGRADES.tick_rate.increment,
        point_multiplier   = BASE.point_multiplier + ul.point_value * UPGRADES.point_value.increment,
        round_time         = BASE.round_time + ul.round_time * UPGRADES.round_time.increment,
        asteroid_count     = BASE.asteroids_per_round + ul.spawn_quantity * UPGRADES.spawn_quantity.increment,
        respawn_chance     = BASE.respawn_chance + ul.respawn_chance * UPGRADES.respawn_chance.increment,
        time_chance        = BASE.time_chance + ul.time_chance * UPGRADES.time_chance.increment,
        max_asteroid_level = BASE.max_asteroid_level + ul.asteroid_level * UPGRADES.asteroid_level.increment,
    }
end

local function enter_playing()
    screen = "playing"
    game_data.round = game_data.round + 1

    play_stats = compute_play_stats()

    blackhole = blackhole_new()
    field = field_new(play_stats)
    asteroids = spawner_spawn_round(game_data.round, play_stats.asteroid_count, play_stats.max_asteroid_level)

    round_timer = play_stats.round_time
    round_points = 0
    round_destroyed = 0
    dirty_timer_acc = 0

    particles_init()
    dirty = true
end

local function enter_roundover(stats)
    screen = "roundover"
    round_over_stats = stats or {}
    round_over_timer = 3
    round_over_alpha = 0
    dirty = true
end

local function enter_shop()
    screen = "shop"
    shop_hover_index = nil
    dirty = true
end

-- ---------------------------------------------------------------------------
-- Public API
-- ---------------------------------------------------------------------------

function M.load()
    mouse_x = W / 2
    mouse_y = H / 2
    dirty = true

    game_data = {
        round           = 0,
        points          = 0,
        total_destroyed = 0,
        upgrade_levels  = {},
    }
    for name, _ in pairs(UPGRADES) do
        game_data.upgrade_levels[name] = 0
    end

    enter_title()
end

function M.unload()
    blackhole = nil
    field = nil
    asteroids = nil
    particle_emitters = nil
    particle_base_image = nil
    game_data = nil
    fonts = {}
end

function M.resize(w, h)
    W = w
    H = h
end

function M.mousemoved(x, y, dx, dy)
    mouse_x = x
    mouse_y = y
end

function M.mousepressed(x, y, button)
    if button ~= 1 then return end

    if screen == "title" then
        enter_playing()
    elseif screen == "roundover" then
        enter_shop()
    elseif screen == "shop" then
        if shop_hover_index then
            local name = UPGRADE_ORDER[shop_hover_index]
            shop_try_buy(name)
        end
    end
end

function M.keypressed(key, scancode, isrepeat)
    if screen == "shop" then
        if key == "space" or key == "return" then
            enter_playing()
        end
    end
end

function M.update(dt)
    if screen == "title" then
        title_pulse = (title_pulse or 0) + dt

    elseif screen == "playing" then
        round_timer = round_timer - dt
        if round_timer <= 0 or #asteroids == 0 then
            round_timer = math.max(0, round_timer)
            enter_roundover({
                round     = game_data.round,
                points    = round_points,
                destroyed = round_destroyed,
            })
            return
        end

        blackhole_update(blackhole, dt)
        field_update(field, dt, mouse_x, mouse_y)
        physics_update(asteroids, dt)

        local pts, time_add, new_asteroids, destroyed = damage_process_tick(
            field, asteroids, play_stats.point_multiplier,
            play_stats.respawn_chance, game_data.round, play_stats.time_chance
        )

        if pts > 0 then
            round_points = round_points + pts
            round_timer = round_timer + time_add
            game_data.points = game_data.points + pts
            round_destroyed = round_destroyed + #destroyed
            dirty = true

            for _, pos in ipairs(destroyed) do
                local color = COLORS[ASTEROID_DATA[pos.level].color]
                particles_burst(pos.x, pos.y, color, 12 + pos.level * 4, 40 + pos.level * 10)
            end
        end

        for _, child in ipairs(new_asteroids) do
            if #asteroids >= BASE.max_asteroids then
                break
            end
            table.insert(asteroids, child)
        end

        particles_update(dt)

        -- Throttled dirty for timer changes (~10hz)
        dirty_timer_acc = dirty_timer_acc + dt
        if dirty_timer_acc >= 0.1 then
            dirty_timer_acc = dirty_timer_acc - 0.1
            dirty = true
        end

    elseif screen == "roundover" then
        round_over_alpha = math.min(1, round_over_alpha + dt * 3)
        round_over_timer = round_over_timer - dt
        if round_over_timer <= 0 then
            enter_shop()
        end

    elseif screen == "shop" then
        -- Update hover state based on mouse position
        local start_y = 150
        shop_hover_index = nil
        for i = 1, #UPGRADE_ORDER do
            local card_y = start_y + (i - 1) * 52
            if mouse_x >= W / 2 - 220 and mouse_x <= W / 2 + 220
               and mouse_y >= card_y and mouse_y <= card_y + 54 then
                shop_hover_index = i
                break
            end
        end
    end
end

-- ---------------------------------------------------------------------------
-- draw() — game entities ONLY, no text/UI
-- ---------------------------------------------------------------------------

function M.draw()
    if screen == "title" then
        -- Draw cursor circle on title screen
        love.graphics.setColor(0.4, 0.2, 0.9, 0.15)
        love.graphics.circle("fill", mouse_x, mouse_y, 20)
        love.graphics.setColor(0.6, 0.3, 1.0, 0.5)
        love.graphics.setLineWidth(2)
        love.graphics.circle("line", mouse_x, mouse_y, 20)

    elseif screen == "playing" then
        blackhole_draw(blackhole)

        for _, a in ipairs(asteroids) do
            asteroid_draw(a)
        end

        field_draw(field)
        particles_draw()

    elseif screen == "roundover" then
        -- Small cursor dot
        love.graphics.setColor(0.6, 0.3, 1.0, 0.5)
        love.graphics.circle("fill", mouse_x, mouse_y, 5)

    elseif screen == "shop" then
        -- Draw upgrade card backgrounds and borders (geometry only, no text)
        local start_y = 150
        for i, name in ipairs(UPGRADE_ORDER) do
            local maxed = shop_is_maxed(name)
            local cost = shop_get_upgrade_cost(name)
            local can_afford = (not maxed) and cost and game_data.points >= cost
            local is_hovered = (shop_hover_index == i)

            local y = start_y + (i - 1) * 52
            local card_x = W / 2 - 220

            -- Card background
            if is_hovered and can_afford then
                love.graphics.setColor(0.3, 0.15, 0.5, 0.5)
            elseif is_hovered then
                love.graphics.setColor(0.2, 0.1, 0.3, 0.4)
            else
                love.graphics.setColor(0.1, 0.05, 0.15, 0.3)
            end
            love.graphics.rectangle("fill", card_x, y, 440, 54, 8, 8)

            -- Border
            if is_hovered then
                love.graphics.setColor(0.6, 0.3, 1.0, 0.4)
            else
                love.graphics.setColor(0.3, 0.15, 0.5, 0.2)
            end
            love.graphics.setLineWidth(1)
            love.graphics.rectangle("line", card_x, y, 440, 54, 8, 8)
        end

        -- Cursor
        love.graphics.setColor(0.6, 0.3, 1.0, 0.5)
        love.graphics.circle("fill", mouse_x, mouse_y, 5)
    end
end

-- ---------------------------------------------------------------------------
-- drawWithUI() — draw() + original love.graphics.print UI on top
-- ---------------------------------------------------------------------------

function M.drawWithUI()
    M.draw()

    if screen == "title" then
        love.graphics.setFont(getFont(48))
        love.graphics.setColor(0.6, 0.3, 1.0, 1)
        love.graphics.printf("BLACKHOLE", 0, H / 2 - 60, W, "center")

        love.graphics.setFont(getFont(18))
        local alpha = 0.4 + 0.4 * math.sin((title_pulse or 0) * 2)
        love.graphics.setColor(0.6, 0.6, 0.6, alpha)
        love.graphics.printf("Click to begin", 0, H / 2 + 20, W, "center")

    elseif screen == "playing" then
        -- HUD
        love.graphics.setFont(getFont(14))
        love.graphics.setColor(1, 1, 1, 0.8)

        local timer_text = string.format("%.1f", round_timer)

        -- Round (top left)
        love.graphics.print("Round " .. game_data.round, 15, 10)

        -- Timer (top center)
        love.graphics.printf(timer_text, 0, 10, W, "center")

        -- Points (top right)
        love.graphics.printf("Points: " .. math.floor(game_data.points), 0, 10, W - 15, "right")

        -- Asteroid count
        love.graphics.setColor(0.6, 0.6, 0.6, 0.6)
        love.graphics.printf("Asteroids: " .. #asteroids, 0, 30, W, "center")

        -- Flash red when timer is low
        if round_timer <= 5 then
            local flash = math.sin(love.timer.getTime() * 6) * 0.5 + 0.5
            love.graphics.setColor(1, 0.2, 0.2, flash)
            love.graphics.printf(timer_text, 0, 10, W, "center")
        end

    elseif screen == "roundover" then
        love.graphics.setFont(getFont(32))
        love.graphics.setColor(0.6, 0.3, 1.0, round_over_alpha)
        love.graphics.printf("Round " .. (round_over_stats.round or "?") .. " Complete",
            0, H / 2 - 60, W, "center")

        love.graphics.setFont(getFont(20))
        love.graphics.setColor(1, 1, 1, round_over_alpha * 0.8)
        love.graphics.printf("Asteroids Destroyed: " .. (round_over_stats.destroyed or 0),
            0, H / 2, W, "center")
        love.graphics.printf("Points Earned: " .. math.floor(round_over_stats.points or 0),
            0, H / 2 + 30, W, "center")

        love.graphics.setFont(getFont(14))
        love.graphics.setColor(0.5, 0.5, 0.5, round_over_alpha * 0.6)
        love.graphics.printf("Click to skip", 0, H / 2 + 80, W, "center")

    elseif screen == "shop" then
        -- Title
        love.graphics.setFont(getFont(32))
        love.graphics.setColor(0.6, 0.3, 1.0, 1)
        love.graphics.printf("UPGRADES", 0, 30, W, "center")

        -- Points
        love.graphics.setFont(getFont(18))
        love.graphics.setColor(1, 1, 1, 0.9)
        love.graphics.printf("Points: " .. math.floor(game_data.points), 0, 75, W, "center")

        -- Round info
        love.graphics.setFont(getFont(14))
        love.graphics.setColor(0.6, 0.6, 0.6, 0.7)
        love.graphics.printf("Preparing Round " .. (game_data.round + 1), 0, 105, W, "center")

        -- Upgrade card text (backgrounds/borders already drawn by draw())
        local start_y = 150
        for i, name in ipairs(UPGRADE_ORDER) do
            local def = UPGRADES[name]
            local level = game_data.upgrade_levels[name]
            local maxed = shop_is_maxed(name)
            local cost = shop_get_upgrade_cost(name)
            local can_afford = (not maxed) and cost and game_data.points >= cost

            local y = start_y + (i - 1) * 52
            local card_x = W / 2 - 220

            -- Label and level
            love.graphics.setFont(getFont(18))
            if can_afford then
                love.graphics.setColor(1, 1, 1, 1)
            else
                love.graphics.setColor(0.5, 0.5, 0.5, 0.5)
            end
            love.graphics.print(def.label .. "  Lv " .. level, card_x + 15, y + 8)

            -- Preview
            love.graphics.setFont(getFont(14))
            love.graphics.setColor(0.7, 0.7, 0.7, 0.7)
            love.graphics.print(shop_get_stat_preview(name), card_x + 15, y + 34)

            -- Cost (right side)
            love.graphics.setFont(getFont(18))
            if maxed then
                love.graphics.setColor(0.5, 0.5, 0.5, 0.4)
                love.graphics.printf("MAX", card_x, y + 18, 420, "right")
            elseif can_afford then
                love.graphics.setColor(0.3, 0.9, 0.4, 1)
                love.graphics.printf(tostring(cost), card_x, y + 18, 420, "right")
            else
                love.graphics.setColor(0.6, 0.3, 0.3, 0.6)
                love.graphics.printf(tostring(cost), card_x, y + 18, 420, "right")
            end
        end

        -- Footer
        love.graphics.setFont(getFont(14))
        love.graphics.setColor(0.5, 0.5, 0.5, 0.5)
        love.graphics.printf("[Click to buy]   [Space to start round]", 0, H - 50, W, "center")
    end
end

-- ---------------------------------------------------------------------------
-- Dirty flag
-- ---------------------------------------------------------------------------

function M.isDirty()
    return dirty == true
end

function M.clearDirty()
    dirty = false
end

-- ---------------------------------------------------------------------------
-- getState() — everything React needs
-- ---------------------------------------------------------------------------

function M.getState()
    local state = {
        screen    = screen,
        round     = game_data and game_data.round or 0,
        timer     = round_timer or 0,
        points    = game_data and game_data.points or 0,
        asteroids = asteroids and #asteroids or 0,
    }

    -- Round over data
    if screen == "roundover" and round_over_stats then
        state.roundStats = {
            round     = round_over_stats.round,
            destroyed = round_over_stats.destroyed,
            points    = round_over_stats.points,
        }
    end

    -- Shop data
    if screen == "shop" and game_data then
        local upgrades = {}
        for i, name in ipairs(UPGRADE_ORDER) do
            local def = UPGRADES[name]
            local level = game_data.upgrade_levels[name]
            local maxed = shop_is_maxed(name)
            local cost = shop_get_upgrade_cost(name)
            local can_afford = (not maxed) and cost and game_data.points >= cost
            table.insert(upgrades, {
                name      = name,
                label     = def.label,
                level     = level,
                cost      = cost,
                maxed     = maxed,
                canAfford = can_afford and true or false,
                preview   = shop_get_stat_preview(name),
            })
        end
        state.shopData = {
            points    = game_data.points,
            nextRound = game_data.round + 1,
            upgrades  = upgrades,
        }
    end

    return state
end

-- ---------------------------------------------------------------------------
-- onCommand() — handle commands from React
-- ---------------------------------------------------------------------------

function M.onCommand(command, args)
    if command == "start" then
        if screen == "title" then
            enter_playing()
        end

    elseif command == "buy" then
        if screen == "shop" and args and args.upgrade then
            shop_try_buy(args.upgrade)
        end

    elseif command == "skip" then
        if screen == "roundover" then
            enter_shop()
        end

    elseif command == "nextround" then
        if screen == "shop" then
            enter_playing()
        end
    end
end

return M
