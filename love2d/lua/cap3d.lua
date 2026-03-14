--[[
  cap3d.lua — Shared 3D rendering infrastructure for visual capabilities.

  Lets any Lua capability render 3D content using g3d without managing
  canvases, camera state, or depth buffers manually.

  Usage inside a capability render():
    local cap3d = require("lua.cap3d")

    cap3d.renderTo(node.id, w, h, {0.02, 0.02, 0.05, 1}, function(g3d)
      g3d.camera.lookAt(0, -3, 2, 0, 0, 0)
      g3d.camera.fov = math.pi / 3
      g3d.camera.updateProjectionMatrix()
      cap3d.drawLit(myModel, { camPos = g3d.camera.position })
    end)

    local canvas = cap3d.getCanvas(node.id)
    if canvas then
      love.graphics.setColor(1, 1, 1, opacity)
      love.graphics.draw(canvas, x, y)
    end
]]

local cap3d = {}

local g3d = nil
local canvases = {}       -- nodeId -> { canvas, w, h }
local colorTexCache = {}  -- key -> love.Image
local _lightingShader = nil
local camStack = {}

-- ── Lazy init ──────────────────────────────────────────────────────

local function ensureG3D()
  if not g3d then
    local ok, lib = pcall(require, "lua.g3d")
    if ok then g3d = lib end
  end
  return g3d
end

function cap3d.getG3D()
  return ensureG3D()
end

-- ── Canvas management ──────────────────────────────────────────────

function cap3d.getCanvas(nodeId)
  local e = canvases[nodeId]
  return e and e.canvas or nil
end

local function ensureCanvas(nodeId, w, h)
  local e = canvases[nodeId]
  if e and e.w == w and e.h == h then return e.canvas end
  if e and e.canvas then e.canvas:release() end
  local canvas = love.graphics.newCanvas(w, h)
  canvases[nodeId] = { canvas = canvas, w = w, h = h }
  return canvas
end

function cap3d.releaseCanvas(nodeId)
  local e = canvases[nodeId]
  if e and e.canvas then e.canvas:release() end
  canvases[nodeId] = nil
end

-- ── Camera push/pop ────────────────────────────────────────────────

local function pushCamera()
  local g = ensureG3D()
  if not g then return end
  camStack[#camStack + 1] = {
    pos = { g.camera.position[1], g.camera.position[2], g.camera.position[3] },
    tgt = { g.camera.target[1], g.camera.target[2], g.camera.target[3] },
    fov = g.camera.fov,
    near = g.camera.nearClip,
    far = g.camera.farClip,
    aspect = g.camera.aspectRatio,
  }
end

local function popCamera()
  local g = ensureG3D()
  if not g then return end
  local s = camStack[#camStack]
  camStack[#camStack] = nil
  if not s then return end
  g.camera.position = s.pos
  g.camera.target = s.tgt
  g.camera.fov = s.fov
  g.camera.nearClip = s.near
  g.camera.farClip = s.far
  g.camera.aspectRatio = s.aspect
  g.camera.updateViewMatrix()
  g.camera.updateProjectionMatrix()
end

-- ── Render-to-canvas ───────────────────────────────────────────────

--- Render 3D content to an off-screen canvas for a capability node.
--- @param nodeId  string   Capability node ID (for canvas caching)
--- @param w       number   Canvas width in pixels
--- @param h       number   Canvas height in pixels
--- @param bgColor table    Clear color {r,g,b,a} or nil for dark default
--- @param fn      function Render callback, receives g3d as argument
function cap3d.renderTo(nodeId, w, h, bgColor, fn)
  w, h = math.floor(w), math.floor(h)
  if w < 1 or h < 1 then return end
  local g = ensureG3D()
  if not g then return end
  local canvas = ensureCanvas(nodeId, w, h)

  bgColor = bgColor or { 0.03, 0.03, 0.06, 1 }

  pushCamera()
  love.graphics.push("all")

  love.graphics.setCanvas({ canvas, depth = true })
  love.graphics.clear(bgColor[1], bgColor[2], bgColor[3], bgColor[4])
  love.graphics.setDepthMode("lequal", true)
  love.graphics.origin()
  love.graphics.setColor(1, 1, 1, 1)

  g.camera.aspectRatio = w / h
  g.camera.updateProjectionMatrix()

  fn(g)

  love.graphics.setShader()
  love.graphics.setDepthMode()
  love.graphics.setCanvas()
  love.graphics.pop()
  popCamera()
end

-- ── Color texture helpers ──────────────────────────────────────────

--- Create/cache a 1x1 texture from a hex color string.
function cap3d.colorTexture(hex)
  if colorTexCache[hex] then return colorTexCache[hex] end
  local r, g, b = 0.5, 0.5, 0.5
  if hex and type(hex) == "string" then
    local h = hex:gsub("#", "")
    if #h == 6 then
      r = tonumber(h:sub(1, 2), 16) / 255
      g = tonumber(h:sub(3, 4), 16) / 255
      b = tonumber(h:sub(5, 6), 16) / 255
    end
  end
  local imgData = love.image.newImageData(1, 1)
  imgData:setPixel(0, 0, r, g, b, 1)
  local img = love.graphics.newImage(imgData)
  colorTexCache[hex] = img
  return img
end

--- Create/cache a 1x1 texture from RGB floats (0-1).
function cap3d.rgbTexture(r, g, b)
  local key = string.format("rgb:%.3f:%.3f:%.3f", r, g, b)
  if colorTexCache[key] then return colorTexCache[key] end
  local imgData = love.image.newImageData(1, 1)
  imgData:setPixel(0, 0, r, g, b, 1)
  local img = love.graphics.newImage(imgData)
  colorTexCache[key] = img
  return img
end

-- ── Geometry generators ────────────────────────────────────────────
-- All return vertex arrays: { {x,y,z, u,v, nx,ny,nz}, ... }

--- UV sphere centered at origin.
function cap3d.sphere(radius, segments, rings)
  radius = radius or 0.5
  segments = segments or 24
  rings = rings or 16
  local verts = {}
  local pi = math.pi
  for i = 0, rings - 1 do
    local t1 = pi * i / rings
    local t2 = pi * (i + 1) / rings
    for j = 0, segments - 1 do
      local p1 = 2 * pi * j / segments
      local p2 = 2 * pi * (j + 1) / segments
      local function pt(t, p)
        local st = math.sin(t)
        local x = radius * st * math.cos(p)
        local y = radius * st * math.sin(p)
        local z = radius * math.cos(t)
        return { x, y, z, p / (2 * pi), t / pi, st * math.cos(p), st * math.sin(p), math.cos(t) }
      end
      local a, b, c, d = pt(t1, p1), pt(t1, p2), pt(t2, p2), pt(t2, p1)
      verts[#verts + 1] = a; verts[#verts + 1] = d; verts[#verts + 1] = c
      verts[#verts + 1] = a; verts[#verts + 1] = c; verts[#verts + 1] = b
    end
  end
  return verts
end

--- Torus (donut) centered at origin, ring in XY plane.
function cap3d.torus(majorR, minorR, segments, rings)
  majorR = majorR or 1.0
  minorR = minorR or 0.05
  segments = segments or 32
  rings = rings or 12
  local verts = {}
  local pi = math.pi
  for i = 0, rings - 1 do
    local t1 = 2 * pi * i / rings
    local t2 = 2 * pi * (i + 1) / rings
    for j = 0, segments - 1 do
      local p1 = 2 * pi * j / segments
      local p2 = 2 * pi * (j + 1) / segments
      local function pt(t, p)
        local ct, st = math.cos(t), math.sin(t)
        local cp, sp = math.cos(p), math.sin(p)
        local x = (majorR + minorR * ct) * cp
        local y = (majorR + minorR * ct) * sp
        local z = minorR * st
        return { x, y, z, p / (2 * pi), t / (2 * pi), ct * cp, ct * sp, st }
      end
      local a, b, c, d = pt(t1, p1), pt(t1, p2), pt(t2, p2), pt(t2, p1)
      verts[#verts + 1] = a; verts[#verts + 1] = d; verts[#verts + 1] = c
      verts[#verts + 1] = a; verts[#verts + 1] = c; verts[#verts + 1] = b
    end
  end
  return verts
end

--- Cylinder connecting two 3D points (for bonds).
function cap3d.bond(p1, p2, radius, segments)
  radius = radius or 0.05
  segments = segments or 8
  local dx = p2[1] - p1[1]
  local dy = p2[2] - p1[2]
  local dz = p2[3] - p1[3]
  local len = math.sqrt(dx * dx + dy * dy + dz * dz)
  if len < 0.001 then return {} end

  -- Build orthonormal basis around the bond direction
  local dir = { dx / len, dy / len, dz / len }
  local up = (math.abs(dir[3]) > 0.9) and { 1, 0, 0 } or { 0, 0, 1 }
  local rx = dir[2] * up[3] - dir[3] * up[2]
  local ry = dir[3] * up[1] - dir[1] * up[3]
  local rz = dir[1] * up[2] - dir[2] * up[1]
  local rlen = math.sqrt(rx * rx + ry * ry + rz * rz)
  rx, ry, rz = rx / rlen, ry / rlen, rz / rlen
  local ux = ry * dir[3] - rz * dir[2]
  local uy = rz * dir[1] - rx * dir[3]
  local uz = rx * dir[2] - ry * dir[1]

  local verts = {}
  local pi = math.pi
  for j = 0, segments - 1 do
    local a1 = 2 * pi * j / segments
    local a2 = 2 * pi * (j + 1) / segments
    local c1, s1 = math.cos(a1), math.sin(a1)
    local c2, s2 = math.cos(a2), math.sin(a2)

    local function ringPt(c, s, base)
      local nx = rx * c + ux * s
      local ny = ry * c + uy * s
      local nz = rz * c + uz * s
      return {
        base[1] + nx * radius, base[2] + ny * radius, base[3] + nz * radius,
        0, 0, nx, ny, nz,
      }
    end

    local v1a, v2a = ringPt(c1, s1, p1), ringPt(c2, s2, p1)
    local v1b, v2b = ringPt(c1, s1, p2), ringPt(c2, s2, p2)
    verts[#verts + 1] = v1a; verts[#verts + 1] = v2a; verts[#verts + 1] = v2b
    verts[#verts + 1] = v1a; verts[#verts + 1] = v2b; verts[#verts + 1] = v1b
  end
  return verts
end

-- ── Lighting shader (Blinn-Phong) ──────────────────────────────────

local lightingVert = [[
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform bool isCanvasEnabled;
attribute vec3 VertexNormal;
varying vec3 fragWorldPos;
varying vec3 fragNormal;
vec4 position(mat4 transformProjection, vec4 vertexPosition) {
    vec4 worldPos = modelMatrix * vertexPosition;
    fragWorldPos = worldPos.xyz;
    fragNormal = mat3(modelMatrix) * VertexNormal;
    vec4 screenPos = projectionMatrix * viewMatrix * worldPos;
    if (isCanvasEnabled) { screenPos.y *= -1.0; }
    return screenPos;
}
]]

local lightingFrag = [[
uniform vec3 ambientColor;
uniform vec3 lightDirection;
uniform vec3 lightColor;
uniform vec3 cameraPosition;
uniform float specularPower;
uniform float fresnelPower;
uniform float meshOpacity;
varying vec3 fragWorldPos;
varying vec3 fragNormal;
vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 texColor = Texel(tex, tc);
    vec3 base = texColor.rgb * color.rgb;
    vec3 N = normalize(fragNormal);
    vec3 L = normalize(lightDirection);
    vec3 V = normalize(cameraPosition - fragWorldPos);
    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), specularPower);
    vec3 finalColor = ambientColor * base + lightColor * base * diff + lightColor * spec * 0.4;
    float alpha = meshOpacity;
    if (fresnelPower > 0.0) {
        alpha *= pow(1.0 - max(dot(N, V), 0.0), fresnelPower);
    }
    return vec4(finalColor, alpha * texColor.a);
}
]]

function cap3d.lightingShader()
  if not _lightingShader then
    _lightingShader = love.graphics.newShader(lightingVert, lightingFrag)
  end
  return _lightingShader
end

--- Draw a g3d model with Blinn-Phong lighting.
--- @param model  g3d model
--- @param opts   table: { lightDir, lightColor, ambientColor, camPos, specular, fresnel, opacity }
function cap3d.drawLit(model, opts)
  opts = opts or {}
  local shader = cap3d.lightingShader()
  shader:send("ambientColor", opts.ambientColor or { 0.15, 0.15, 0.2 })
  shader:send("lightDirection", opts.lightDir or { 1, -0.5, 0.7 })
  shader:send("lightColor", opts.lightColor or { 0.8, 0.8, 0.75 })
  shader:send("cameraPosition", opts.camPos or ensureG3D().camera.position)
  shader:send("specularPower", opts.specular or 32)
  shader:send("fresnelPower", opts.fresnel or 0)
  shader:send("meshOpacity", opts.opacity or 1.0)
  model:draw(shader)
end

-- ── Orbit controls ─────────────────────────────────────────────────

--- Update orbit rotation from mouse drag. Call from tick().
--- state must have: orbitRotX, orbitRotY, orbitPrevMX, orbitPrevMY, screenRect
function cap3d.updateOrbit(state)
  local mx, my = love.mouse.getPosition()
  local mouseDown = love.mouse.isDown(1)
  local r = state.screenRect

  if not r then return end

  if mouseDown then
    if state.orbitPrevMX then
      state.orbitRotY = (state.orbitRotY or 0) + (mx - state.orbitPrevMX) * 0.008
      state.orbitRotX = (state.orbitRotX or 0) + (my - state.orbitPrevMY) * 0.008
      state.orbitPrevMX = mx
      state.orbitPrevMY = my
    else
      if mx >= r.x and mx <= r.x + r.w and my >= r.y and my <= r.y + r.h then
        state.orbitPrevMX = mx
        state.orbitPrevMY = my
      end
    end
  else
    state.orbitPrevMX = nil
    state.orbitPrevMY = nil
  end
end

--- Apply orbit camera from state. Call inside renderTo callback.
--- @param state  table with orbitRotX, orbitRotY
--- @param dist   number camera distance from origin
function cap3d.applyOrbitCamera(state, dist)
  local g = ensureG3D()
  if not g then return end
  dist = dist or 3.0
  local rx = state.orbitRotX or 0.4
  local ry = state.orbitRotY or 0.3
  g.camera.lookAt(
    dist * math.sin(ry) * math.cos(rx),
    -dist * math.cos(ry) * math.cos(rx),
    dist * math.sin(rx),
    0, 0, 0
  )
  g.camera.fov = math.pi / 3
  g.camera.updateProjectionMatrix()
end

--- Check for right-click mode toggle. Call from tick(). Returns true on toggle.
--- state must have: view3d, togglePrev, screenRect
function cap3d.checkToggle(state)
  local mx, my = love.mouse.getPosition()
  local rightDown = love.mouse.isDown(2)
  local r = state.screenRect
  local toggled = false

  if rightDown and not state.togglePrev and r then
    if mx >= r.x and mx <= r.x + r.w and my >= r.y and my <= r.y + r.h then
      state.view3d = not state.view3d
      toggled = true
    end
  end
  state.togglePrev = rightDown
  return toggled
end

return cap3d
