--[[
  sdl2_scene3d.lua — 3D scene rendering for SDL2/OpenGL target

  Mirrors lua/scene3d.lua but uses raw OpenGL 2.1 via FFI instead of Love2D.
  Renders each Scene3D node to an off-screen FBO, then the capability's draw()
  composites the FBO color texture into the 2D scene via Images.drawTexture().

  Pipeline:
    1. Scene3D capability tick() calls syncScene() to walk children
    2. Scene3D capability draw() calls renderScene() then composites
    3. FBO color attachment is drawn as a textured quad at the node's position
]]

local ffi = require("ffi")
local GL  = require("lua.sdl2_gl")

-- ============================================================================
-- g3d math (pure Lua, no Love2D deps)
-- ============================================================================

-- We need to set up g3d's global path before requiring submodules.
-- g3d expects a global `g3d` table with a `path` field.
local g3dPath = "lua.g3d"
local _g3d_global_backup = rawget(_G, "g3d")

-- Temporarily set global g3d for module loading
rawset(_G, "g3d", { path = g3dPath })

-- Camera needs love.graphics.getWidth/getHeight at require time — provide stubs
-- (the actual aspect ratio is set per-scene before rendering)
local newMatrix = require("lua.g3d.matrices")
local vectors   = require("lua.g3d.vectors")

-- Build a camera singleton matching g3d/camera.lua but without love.* deps
local camera = {
  fov = math.pi / 2,
  nearClip = 0.01,
  farClip = 1000,
  aspectRatio = 4/3,
  position = {0, 0, 0},
  target = {1, 0, 0},
  up = {0, 0, 1},
  viewMatrix = newMatrix(),
  projectionMatrix = newMatrix(),
}

function camera.updateViewMatrix()
  camera.viewMatrix:setViewMatrix(camera.position, camera.target, camera.up)
end

function camera.updateProjectionMatrix()
  camera.projectionMatrix:setProjectionMatrix(camera.fov, camera.nearClip, camera.farClip, camera.aspectRatio)
end

function camera.lookAt(x, y, z, xAt, yAt, zAt)
  camera.position[1], camera.position[2], camera.position[3] = x, y, z
  camera.target[1], camera.target[2], camera.target[3] = xAt, yAt, zAt
  camera.updateViewMatrix()
end

-- Restore global state
rawset(_G, "g3d", _g3d_global_backup)

-- ============================================================================
-- Shader helpers
-- ============================================================================

local function compileShader(source, shaderType)
  local shader = GL.glCreateShader(shaderType)
  local src = ffi.new("const char*[1]", ffi.cast("const char*", source))
  local len = ffi.new("int[1]", #source)
  GL.glShaderSource(shader, 1, src, len)
  GL.glCompileShader(shader)

  local status = ffi.new("int[1]")
  GL.glGetShaderiv(shader, GL.COMPILE_STATUS, status)
  if status[0] == 0 then
    local logLen = ffi.new("int[1]")
    GL.glGetShaderiv(shader, GL.INFO_LOG_LENGTH, logLen)
    local buf = ffi.new("char[?]", logLen[0] + 1)
    GL.glGetShaderInfoLog(shader, logLen[0] + 1, nil, buf)
    io.write("[sdl2_scene3d] Shader compile error: " .. ffi.string(buf) .. "\n")
    io.flush()
    GL.glDeleteShader(shader)
    return nil
  end
  return shader
end

local function linkProgram(vertSource, fragSource)
  local vs = compileShader(vertSource, GL.VERTEX_SHADER)
  local fs = compileShader(fragSource, GL.FRAGMENT_SHADER)
  if not vs or not fs then return nil end

  local prog = GL.glCreateProgram()
  GL.glAttachShader(prog, vs)
  GL.glAttachShader(prog, fs)
  GL.glLinkProgram(prog)

  local status = ffi.new("int[1]")
  GL.glGetProgramiv(prog, GL.LINK_STATUS, status)
  if status[0] == 0 then
    local logLen = ffi.new("int[1]")
    GL.glGetProgramiv(prog, GL.INFO_LOG_LENGTH, logLen)
    local buf = ffi.new("char[?]", logLen[0] + 1)
    GL.glGetProgramInfoLog(prog, logLen[0] + 1, nil, buf)
    io.write("[sdl2_scene3d] Program link error: " .. ffi.string(buf) .. "\n")
    io.flush()
    GL.glDeleteProgram(prog)
    GL.glDeleteShader(vs)
    GL.glDeleteShader(fs)
    return nil
  end

  -- Shaders can be deleted once linked
  GL.glDeleteShader(vs)
  GL.glDeleteShader(fs)
  return prog
end

-- ============================================================================
-- Shaders (standard GLSL for OpenGL 2.1)
-- ============================================================================

local LIGHTING_VERT = [[
attribute vec3 aPosition;
attribute vec2 aTexCoord;
attribute vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

varying vec2 vTexCoord;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = mat3(uModel) * aNormal;
    vTexCoord = aTexCoord;
    gl_Position = uProjection * uView * worldPos;
}
]]

local LIGHTING_FRAG = [[
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uTexture;
uniform vec3 uAmbientColor;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uCameraPos;
uniform float uSpecularPower;
uniform float uFresnelPower;
uniform float uOpacity;

varying vec2 vTexCoord;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
    vec4 texColor = texture2D(uTexture, vTexCoord);
    vec3 N = normalize(vNormal);
    vec3 L = normalize(-uLightDir);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), uSpecularPower);

    vec3 color = texColor.rgb * (uAmbientColor + uLightColor * diff) + uLightColor * spec * 0.4;

    float alpha = uOpacity * texColor.a;
    if (uFresnelPower > 0.0) {
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
        alpha *= fresnel;
    }

    gl_FragColor = vec4(color, alpha);
}
]]

local EDGE_VERT = [[
attribute vec3 aPosition;
attribute vec2 aTexCoord;
attribute vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

varying vec2 vTexCoord;

void main() {
    vTexCoord = aTexCoord;
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}
]]

local EDGE_FRAG = [[
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uTexture;
uniform vec4 uEdgeColor;
uniform float uEdgeWidth;
uniform float uGridLines;
uniform float uOpacity;

varying vec2 vTexCoord;

void main() {
    vec4 texColor = texture2D(uTexture, vTexCoord);
    vec4 baseColor = texColor;

    float u = vTexCoord.x;
    float v = vTexCoord.y;
    float edgeMask = 0.0;

    if (uGridLines > 0.0) {
        float gu = fract(u * uGridLines);
        float gv = fract(v * uGridLines);
        float lineW = uEdgeWidth * uGridLines;
        if (gu < lineW || gu > 1.0 - lineW ||
            gv < lineW || gv > 1.0 - lineW) {
            edgeMask = 1.0;
        }
    } else {
        if (u < uEdgeWidth || u > 1.0 - uEdgeWidth ||
            v < uEdgeWidth || v > 1.0 - uEdgeWidth) {
            edgeMask = 1.0;
        }
    }

    gl_FragColor = vec4(mix(baseColor.rgb, uEdgeColor.rgb, edgeMask),
                        mix(baseColor.a, uEdgeColor.a, edgeMask) * uOpacity);
}
]]

-- Compiled shader programs (lazy init)
local lightingProgram = nil
local edgeProgram = nil

-- Uniform/attrib location caches
local lightingLocs = {}
local edgeLocs = {}

local function getLightingProgram()
  if not lightingProgram then
    lightingProgram = linkProgram(LIGHTING_VERT, LIGHTING_FRAG)
    if lightingProgram then
      lightingLocs = {
        aPosition     = GL.glGetAttribLocation(lightingProgram, "aPosition"),
        aTexCoord     = GL.glGetAttribLocation(lightingProgram, "aTexCoord"),
        aNormal       = GL.glGetAttribLocation(lightingProgram, "aNormal"),
        uModel        = GL.glGetUniformLocation(lightingProgram, "uModel"),
        uView         = GL.glGetUniformLocation(lightingProgram, "uView"),
        uProjection   = GL.glGetUniformLocation(lightingProgram, "uProjection"),
        uTexture      = GL.glGetUniformLocation(lightingProgram, "uTexture"),
        uAmbientColor = GL.glGetUniformLocation(lightingProgram, "uAmbientColor"),
        uLightDir     = GL.glGetUniformLocation(lightingProgram, "uLightDir"),
        uLightColor   = GL.glGetUniformLocation(lightingProgram, "uLightColor"),
        uCameraPos    = GL.glGetUniformLocation(lightingProgram, "uCameraPos"),
        uSpecularPower= GL.glGetUniformLocation(lightingProgram, "uSpecularPower"),
        uFresnelPower = GL.glGetUniformLocation(lightingProgram, "uFresnelPower"),
        uOpacity      = GL.glGetUniformLocation(lightingProgram, "uOpacity"),
      }
    end
  end
  return lightingProgram, lightingLocs
end

local function getEdgeProgram()
  if not edgeProgram then
    edgeProgram = linkProgram(EDGE_VERT, EDGE_FRAG)
    if edgeProgram then
      edgeLocs = {
        aPosition  = GL.glGetAttribLocation(edgeProgram, "aPosition"),
        aTexCoord  = GL.glGetAttribLocation(edgeProgram, "aTexCoord"),
        aNormal    = GL.glGetAttribLocation(edgeProgram, "aNormal"),
        uModel     = GL.glGetUniformLocation(edgeProgram, "uModel"),
        uView      = GL.glGetUniformLocation(edgeProgram, "uView"),
        uProjection= GL.glGetUniformLocation(edgeProgram, "uProjection"),
        uTexture   = GL.glGetUniformLocation(edgeProgram, "uTexture"),
        uEdgeColor = GL.glGetUniformLocation(edgeProgram, "uEdgeColor"),
        uEdgeWidth = GL.glGetUniformLocation(edgeProgram, "uEdgeWidth"),
        uGridLines = GL.glGetUniformLocation(edgeProgram, "uGridLines"),
        uOpacity   = GL.glGetUniformLocation(edgeProgram, "uOpacity"),
      }
    end
  end
  return edgeProgram, edgeLocs
end

-- ============================================================================
-- Matrix upload helper
-- ============================================================================

-- g3d matrices are 16-element Lua tables in row-major order.
-- OpenGL expects column-major, so we transpose on upload.
local _mat4buf = ffi.new("float[16]")

local function uploadMatrix(loc, m)
  -- g3d stores row-major: m[1..4] = row 1
  -- OpenGL column-major: first 4 floats = column 1
  -- Transpose: col[j][i] = row[i][j]
  _mat4buf[0]  = m[1];  _mat4buf[1]  = m[5];  _mat4buf[2]  = m[9];  _mat4buf[3]  = m[13]
  _mat4buf[4]  = m[2];  _mat4buf[5]  = m[6];  _mat4buf[6]  = m[10]; _mat4buf[7]  = m[14]
  _mat4buf[8]  = m[3];  _mat4buf[9]  = m[7];  _mat4buf[10] = m[11]; _mat4buf[11] = m[15]
  _mat4buf[12] = m[4];  _mat4buf[13] = m[8];  _mat4buf[14] = m[12]; _mat4buf[15] = m[16]
  GL.glUniformMatrix4fv(loc, 1, GL.FALSE, _mat4buf)
end

-- ============================================================================
-- FBO management
-- ============================================================================

local _ids = ffi.new("unsigned int[1]")

local function createFBO(w, h)
  -- Color texture
  GL.glGenTextures(1, _ids)
  local colorTex = _ids[0]
  GL.glBindTexture(GL.TEXTURE_2D, colorTex)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA, w, h, 0,
                  GL.RGBA, GL.UNSIGNED_BYTE, nil)
  GL.glBindTexture(GL.TEXTURE_2D, 0)

  -- Depth renderbuffer
  GL.glGenRenderbuffersEXT(1, _ids)
  local depthRB = _ids[0]
  GL.glBindRenderbufferEXT(GL.RENDERBUFFER_EXT, depthRB)
  GL.glRenderbufferStorageEXT(GL.RENDERBUFFER_EXT, GL.DEPTH_COMPONENT24, w, h)
  GL.glBindRenderbufferEXT(GL.RENDERBUFFER_EXT, 0)

  -- Framebuffer
  GL.glGenFramebuffersEXT(1, _ids)
  local fbo = _ids[0]
  GL.glBindFramebufferEXT(GL.FRAMEBUFFER_EXT, fbo)
  GL.glFramebufferTexture2DEXT(GL.FRAMEBUFFER_EXT, GL.COLOR_ATTACHMENT0_EXT,
                                GL.TEXTURE_2D, colorTex, 0)
  GL.glFramebufferRenderbufferEXT(GL.FRAMEBUFFER_EXT, GL.DEPTH_ATTACHMENT_EXT,
                                   GL.RENDERBUFFER_EXT, depthRB)

  local status = GL.glCheckFramebufferStatusEXT(GL.FRAMEBUFFER_EXT)
  if status ~= GL.FRAMEBUFFER_COMPLETE_EXT then
    io.write("[sdl2_scene3d] FBO incomplete: 0x" .. string.format("%04X", status) .. "\n")
    io.flush()
  end

  GL.glBindFramebufferEXT(GL.FRAMEBUFFER_EXT, 0)

  return { fbo = fbo, colorTex = colorTex, depthRB = depthRB, w = w, h = h }
end

local function destroyFBO(fb)
  if not fb then return end
  _ids[0] = fb.fbo
  GL.glDeleteFramebuffersEXT(1, _ids)
  _ids[0] = fb.colorTex
  GL.glDeleteTextures(1, _ids)
  _ids[0] = fb.depthRB
  GL.glDeleteRenderbuffersEXT(1, _ids)
end

-- ============================================================================
-- VBO mesh
-- ============================================================================

-- Vertex format: { x, y, z, u, v, nx, ny, nz } = 8 floats = 32 bytes
local VERT_STRIDE = 8 * 4  -- 32 bytes

ffi.cdef[[
  struct sdl2_scene3d_vertex {
    float x, y, z;
    float u, v;
    float nx, ny, nz;
  };
]]

local function createVBO(verts)
  local count = #verts
  local data = ffi.new("struct sdl2_scene3d_vertex[?]", count)
  for i = 1, count do
    local v = verts[i]
    local d = data[i - 1]
    d.x  = v[1] or 0
    d.y  = v[2] or 0
    d.z  = v[3] or 0
    d.u  = v[4] or 0
    d.v  = v[5] or 0
    d.nx = v[6] or 0
    d.ny = v[7] or 0
    d.nz = v[8] or 0
  end

  GL.glGenBuffers(1, _ids)
  local vbo = _ids[0]
  GL.glBindBuffer(GL.ARRAY_BUFFER, vbo)
  GL.glBufferData(GL.ARRAY_BUFFER, ffi.sizeof(data), data, GL.STATIC_DRAW)
  GL.glBindBuffer(GL.ARRAY_BUFFER, 0)

  return { vbo = vbo, count = count }
end

local function destroyVBO(mesh)
  if not mesh then return end
  _ids[0] = mesh.vbo
  GL.glDeleteBuffers(1, _ids)
end

local function drawVBO(mesh, posLoc, texLoc, normLoc)
  GL.glBindBuffer(GL.ARRAY_BUFFER, mesh.vbo)

  if posLoc >= 0 then
    GL.glEnableVertexAttribArray(posLoc)
    GL.glVertexAttribPointer(posLoc, 3, GL.FLOAT, GL.FALSE, VERT_STRIDE, ffi.cast("void*", 0))
  end
  if texLoc >= 0 then
    GL.glEnableVertexAttribArray(texLoc)
    GL.glVertexAttribPointer(texLoc, 2, GL.FLOAT, GL.FALSE, VERT_STRIDE, ffi.cast("void*", 12))
  end
  if normLoc >= 0 then
    GL.glEnableVertexAttribArray(normLoc)
    GL.glVertexAttribPointer(normLoc, 3, GL.FLOAT, GL.FALSE, VERT_STRIDE, ffi.cast("void*", 20))
  end

  GL.glDrawArrays(GL.TRIANGLES, 0, mesh.count)

  if posLoc >= 0 then GL.glDisableVertexAttribArray(posLoc) end
  if texLoc >= 0 then GL.glDisableVertexAttribArray(texLoc) end
  if normLoc >= 0 then GL.glDisableVertexAttribArray(normLoc) end

  GL.glBindBuffer(GL.ARRAY_BUFFER, 0)
end

-- ============================================================================
-- Geometry generators (pure math, copied from scene3d.lua)
-- ============================================================================

local function generateBox(w, h, d)
  w = (w or 1) / 2
  h = (h or 1) / 2
  d = (d or 1) / 2
  local verts = {}
  local function face(v1, v2, v3, v4, nx, ny, nz)
    verts[#verts + 1] = {v1[1], v1[2], v1[3], 0, 0, nx, ny, nz}
    verts[#verts + 1] = {v2[1], v2[2], v2[3], 1, 0, nx, ny, nz}
    verts[#verts + 1] = {v3[1], v3[2], v3[3], 1, 1, nx, ny, nz}
    verts[#verts + 1] = {v1[1], v1[2], v1[3], 0, 0, nx, ny, nz}
    verts[#verts + 1] = {v3[1], v3[2], v3[3], 1, 1, nx, ny, nz}
    verts[#verts + 1] = {v4[1], v4[2], v4[3], 0, 1, nx, ny, nz}
  end
  face({-w, h, -d}, { w, h, -d}, { w, h,  d}, {-w, h,  d},  0,  1,  0)
  face({ w,-h, -d}, {-w,-h, -d}, {-w,-h,  d}, { w,-h,  d},  0, -1,  0)
  face({ w, h, -d}, { w,-h, -d}, { w,-h,  d}, { w, h,  d},  1,  0,  0)
  face({-w,-h, -d}, {-w, h, -d}, {-w, h,  d}, {-w,-h,  d}, -1,  0,  0)
  face({-w, h,  d}, { w, h,  d}, { w,-h,  d}, {-w,-h,  d},  0,  0,  1)
  face({-w,-h, -d}, { w,-h, -d}, { w, h, -d}, {-w, h, -d},  0,  0, -1)
  return verts
end

local function generateSphere(radius, segments, rings)
  radius = radius or 0.5
  segments = segments or 48
  rings = rings or 32
  local verts = {}
  local pi = math.pi
  for i = 0, rings - 1 do
    local theta1 = pi * i / rings
    local theta2 = pi * (i + 1) / rings
    for j = 0, segments - 1 do
      local phi1 = 2 * pi * j / segments
      local phi2 = 2 * pi * (j + 1) / segments
      local function pt(theta, phi)
        local st = math.sin(theta)
        local x = radius * st * math.cos(phi)
        local y = radius * st * math.sin(phi)
        local z = radius * math.cos(theta)
        local nx, ny, nz = st * math.cos(phi), st * math.sin(phi), math.cos(theta)
        local u = phi / (2 * pi)
        local v = theta / pi
        return {x, y, z, u, v, nx, ny, nz}
      end
      local p1 = pt(theta1, phi1)
      local p2 = pt(theta1, phi2)
      local p3 = pt(theta2, phi2)
      local p4 = pt(theta2, phi1)
      verts[#verts + 1] = p1
      verts[#verts + 1] = p4
      verts[#verts + 1] = p3
      verts[#verts + 1] = p1
      verts[#verts + 1] = p3
      verts[#verts + 1] = p2
    end
  end
  return verts
end

local function generatePlane(w, h)
  w = (w or 1) / 2
  h = (h or 1) / 2
  return {
    {-w, -h, 0, 0, 0, 0, 0, 1},
    { w, -h, 0, 1, 0, 0, 0, 1},
    { w,  h, 0, 1, 1, 0, 0, 1},
    {-w, -h, 0, 0, 0, 0, 0, 1},
    { w,  h, 0, 1, 1, 0, 0, 1},
    {-w,  h, 0, 0, 1, 0, 0, 1},
  }
end

local geometryGenerators = {
  box = generateBox,
  cube = generateBox,
  sphere = generateSphere,
  plane = generatePlane,
}

-- ============================================================================
-- Texture helpers
-- ============================================================================

local colorTextureCache = {}

local function createColorTexture(hexColor)
  local r, g, b = 0.54, 0.70, 0.98
  if hexColor and type(hexColor) == "string" then
    local hex = hexColor:gsub("#", "")
    if #hex == 6 then
      r = tonumber(hex:sub(1, 2), 16) / 255
      g = tonumber(hex:sub(3, 4), 16) / 255
      b = tonumber(hex:sub(5, 6), 16) / 255
    end
  end
  local pixel = ffi.new("uint8_t[4]", {
    math.floor(r * 255 + 0.5),
    math.floor(g * 255 + 0.5),
    math.floor(b * 255 + 0.5),
    255,
  })
  GL.glGenTextures(1, _ids)
  local texId = _ids[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 1, 1, 0,
                  GL.RGBA, GL.UNSIGNED_BYTE, pixel)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
  return texId
end

local function getColorTexture(hexColor)
  local key = hexColor or "__default__"
  if not colorTextureCache[key] then
    colorTextureCache[key] = createColorTexture(hexColor)
  end
  return colorTextureCache[key]
end

-- ============================================================================
-- Procedural textures
-- ============================================================================

local proceduralTextureCache = {}

-- Noise functions (identical to scene3d.lua)
local function hashNoise(x, y, seed)
  local n = x * 374761393 + y * 668265263 + (seed or 0) * 1013904223
  n = math.abs(n)
  n = (n % 65537) / 65537
  n = math.sin(n * 12345.6789) * 0.5 + 0.5
  return n
end

local function smoothNoise(x, y, seed)
  local ix = math.floor(x)
  local iy = math.floor(y)
  local fx = x - ix
  local fy = y - iy
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  local n00 = hashNoise(ix, iy, seed)
  local n10 = hashNoise(ix + 1, iy, seed)
  local n01 = hashNoise(ix, iy + 1, seed)
  local n11 = hashNoise(ix + 1, iy + 1, seed)
  local nx0 = n00 + (n10 - n00) * fx
  local nx1 = n01 + (n11 - n01) * fx
  return nx0 + (nx1 - nx0) * fy
end

local function fbm(x, y, octaves, seed)
  local value = 0
  local amplitude = 0.5
  local frequency = 1
  local total = 0
  for _ = 1, (octaves or 5) do
    value = value + smoothNoise(x * frequency, y * frequency, seed) * amplitude
    total = total + amplitude
    amplitude = amplitude * 0.5
    frequency = frequency * 2
  end
  return value / total
end

local function generatePlanetTextureGL(seed)
  seed = seed or 42
  local tw, th = 512, 256
  local pixels = ffi.new("uint8_t[?]", tw * th * 4)

  for py = 0, th - 1 do
    local v = py / th
    local lat = (v - 0.5) * math.pi
    for px = 0, tw - 1 do
      local u = px / tw
      local nx = u * 6
      local ny = v * 3
      local terrain = fbm(nx, ny, 6, seed)
      local continent = fbm(nx * 0.5, ny * 0.5, 3, seed + 100)
      local h = terrain * 0.6 + continent * 0.4
      local seaLevel = 0.45
      local r, g, b

      local absLat = math.abs(lat)
      if absLat > 1.25 then
        local iceBlend = math.min((absLat - 1.25) / 0.3, 1)
        local snowNoise = fbm(nx * 2, ny * 2, 3, seed + 200) * 0.15
        r = 0.85 + snowNoise
        g = 0.88 + snowNoise
        b = 0.92 + snowNoise
        if iceBlend < 1 and h > seaLevel then
          r = r * iceBlend + (0.25 + h * 0.3) * (1 - iceBlend)
          g = g * iceBlend + (0.4 + h * 0.25) * (1 - iceBlend)
          b = b * iceBlend + 0.15 * (1 - iceBlend)
        end
      elseif h < seaLevel then
        local depth = (seaLevel - h) / seaLevel
        r = 0.04 + depth * 0.03
        g = 0.10 + depth * 0.06
        b = 0.35 + depth * 0.25
        if h > seaLevel - 0.05 then
          local shallow = 1 - (seaLevel - h) / 0.05
          r = r + shallow * 0.05
          g = g + shallow * 0.12
          b = b - shallow * 0.05
        end
      else
        local elevation = (h - seaLevel) / (1 - seaLevel)
        local tropicness = math.max(0, math.min(1, 1 - math.abs(lat) / (math.pi * 0.4)))
        if elevation > 0.6 then
          local rock = fbm(nx * 4, ny * 4, 3, seed + 300) * 0.1
          r = 0.45 + rock; g = 0.40 + rock; b = 0.35 + rock
        elseif elevation > 0.35 then
          local mix = (elevation - 0.35) / 0.25
          r = 0.25 * (1 - mix) + 0.40 * mix
          g = 0.40 * (1 - mix) + 0.35 * mix
          b = 0.12 * (1 - mix) + 0.20 * mix
        else
          local moisture = fbm(nx * 1.5 + 50, ny * 1.5 + 50, 4, seed + 400)
          if moisture > 0.5 and tropicness > 0.5 then
            r = 0.10 + elevation * 0.15; g = 0.35 + elevation * 0.20; b = 0.08
          elseif moisture > 0.35 then
            r = 0.18 + elevation * 0.12; g = 0.32 + elevation * 0.18; b = 0.10
          else
            r = 0.55 + elevation * 0.15; g = 0.45 + elevation * 0.10; b = 0.25
          end
        end
      end

      r = math.max(0, math.min(1, r))
      g = math.max(0, math.min(1, g))
      b = math.max(0, math.min(1, b))

      local off = (py * tw + px) * 4
      pixels[off]     = math.floor(r * 255 + 0.5)
      pixels[off + 1] = math.floor(g * 255 + 0.5)
      pixels[off + 2] = math.floor(b * 255 + 0.5)
      pixels[off + 3] = 255
    end
  end

  GL.glGenTextures(1, _ids)
  local texId = _ids[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.REPEAT)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glPixelStorei(GL.UNPACK_ALIGNMENT, 1)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA, tw, th, 0,
                  GL.RGBA, GL.UNSIGNED_BYTE, pixels)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
  return texId
end

--- Generate a framework-canvas procedural texture (pixel-based, no Love2D drawing)
local function generateFrameworkCanvasTextureGL(seed)
  seed = seed or 7
  local tw, th = 512, 512
  local pixels = ffi.new("uint8_t[?]", tw * th * 4)

  local function setPixel(px, py, r, g, b, a)
    if px < 0 or px >= tw or py < 0 or py >= th then return end
    local off = (py * tw + px) * 4
    pixels[off]     = math.floor(r * 255 + 0.5)
    pixels[off + 1] = math.floor(g * 255 + 0.5)
    pixels[off + 2] = math.floor(b * 255 + 0.5)
    pixels[off + 3] = math.floor((a or 1) * 255 + 0.5)
  end

  local function fillRect(x, y, w, h, r, g, b, a)
    for py = y, y + h - 1 do
      for px = x, x + w - 1 do
        setPixel(px, py, r, g, b, a or 1)
      end
    end
  end

  -- Background gradient
  for py = 0, th - 1 do
    local t = py / th
    local r = 0.06 + t * 0.05
    local g = 0.08 + t * 0.06
    local b = 0.12 + t * 0.10
    for px = 0, tw - 1 do
      setPixel(px, py, r, g, b, 1)
    end
  end

  -- Grid lines
  for gx = 0, tw - 1, 32 do
    for py = 0, th - 1 do setPixel(gx, py, 1, 1, 1, 0.05) end
  end
  for gy = 0, th - 1, 32 do
    for px = 0, tw - 1 do setPixel(px, gy, 1, 1, 1, 0.05) end
  end

  -- Header card
  fillRect(20, 20, tw - 40, 74, 0.09, 0.12, 0.18, 0.96)
  -- Accent stripe
  fillRect(20, 20, tw - 40, 4, 0.35, 0.72, 0.96, 1)

  -- Status cards
  local cardColors = {
    {0.16, 0.65, 0.34},
    {0.20, 0.47, 0.90},
    {0.73, 0.53, 0.16},
  }
  for i = 1, 3 do
    local x = 30 + (i - 1) * 160
    local y = 120
    fillRect(x, y, 138, 86, 0.13, 0.16, 0.24, 0.96)
    -- Badge
    local cc = cardColors[i]
    fillRect(x + 72, y + 55, 56, 20, cc[1], cc[2], cc[3], 1)
  end

  -- Progress bars panel
  fillRect(30, 226, 452, 114, 0.13, 0.16, 0.22, 0.96)
  local progressVals = {0.81, 0.66, 0.92}
  local progressColors = {
    {0.35, 0.74, 0.98},
    {0.55, 0.84, 0.56},
    {0.98, 0.66, 0.39},
  }
  for i, v in ipairs(progressVals) do
    local y = 258 + (i - 1) * 24
    fillRect(44, y, 300, 14, 0.21, 0.25, 0.34, 1)
    local col = progressColors[i]
    fillRect(44, y, math.floor(300 * v), 14, col[1], col[2], col[3], 1)
  end

  -- Chart panel
  fillRect(30, 356, 452, 130, 0.13, 0.16, 0.22, 0.96)
  local baseY = 472
  for i = 1, 7 do
    local n = 0.35 + hashNoise(seed * 13 + i * 17, seed * 23 + i * 37, seed) * 0.55
    local bh = math.floor(n * 86)
    local x = 46 + (i - 1) * 36
    fillRect(x, baseY - bh, 26, bh, 0.20, 0.35 + math.min(1, 0.35 + i * 0.08) * 0.3, 0.85, 1)
  end

  -- Border
  for px = 12, tw - 13 do
    setPixel(px, 12, 1, 1, 1, 0.13)
    setPixel(px, th - 13, 1, 1, 1, 0.13)
  end
  for py = 12, th - 13 do
    setPixel(12, py, 1, 1, 1, 0.13)
    setPixel(tw - 13, py, 1, 1, 1, 0.13)
  end

  GL.glGenTextures(1, _ids)
  local texId = _ids[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glPixelStorei(GL.UNPACK_ALIGNMENT, 1)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA, tw, th, 0,
                  GL.RGBA, GL.UNSIGNED_BYTE, pixels)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
  return texId
end

local function getProceduralTexture(name, seed)
  local key = name .. ":" .. tostring(seed or 0)
  if not proceduralTextureCache[key] then
    if name == "planet" then
      proceduralTextureCache[key] = generatePlanetTextureGL(seed)
    elseif name == "framework-canvas" or name == "framework" or name == "ui-canvas" then
      proceduralTextureCache[key] = generateFrameworkCanvasTextureGL(seed)
    end
  end
  return proceduralTextureCache[key]
end

-- ============================================================================
-- Color/light parsing helpers
-- ============================================================================

local function parseHexColor(hex)
  if not hex or type(hex) ~= "string" then return nil end
  hex = hex:gsub("#", "")
  if #hex == 6 then
    return {
      tonumber(hex:sub(1, 2), 16) / 255,
      tonumber(hex:sub(3, 4), 16) / 255,
      tonumber(hex:sub(5, 6), 16) / 255,
      1,
    }
  end
  return nil
end

local function parseLightColor(hex, intensity)
  intensity = intensity or 1.0
  local r, g, b = 1, 1, 1
  if hex and type(hex) == "string" then
    hex = hex:gsub("#", "")
    if #hex == 6 then
      r = tonumber(hex:sub(1, 2), 16) / 255
      g = tonumber(hex:sub(3, 4), 16) / 255
      b = tonumber(hex:sub(5, 6), 16) / 255
    end
  end
  return { r * intensity, g * intensity, b * intensity }
end

local function normalizeVec3(v)
  local x, y, z = v[1] or 0, v[2] or 0, v[3] or 0
  local len = math.sqrt(x*x + y*y + z*z)
  if len > 0.0001 then return { x/len, y/len, z/len } end
  return { 0, -1, 0 }
end

-- ============================================================================
-- Scene state
-- ============================================================================

local scenes = {}  -- nodeId -> scene state

-- ============================================================================
-- Starfield
-- ============================================================================

local starCache = {}

local function getStars(sceneId, w, h)
  local key = sceneId .. ":" .. w .. "x" .. h
  if starCache[key] then return starCache[key] end
  local stars = {}
  local count = 300
  local seed = 12345
  for i = 1, count do
    seed = (seed * 1103515245 + 12345) % 2147483648
    local sx = seed % w
    seed = (seed * 1103515245 + 12345) % 2147483648
    local sy = seed % h
    seed = (seed * 1103515245 + 12345) % 2147483648
    local brightness = 0.3 + (seed % 700) / 1000
    seed = (seed * 1103515245 + 12345) % 2147483648
    local size = 1 + (seed % 2)
    stars[i] = { x = sx, y = sy, brightness = brightness, size = size }
  end
  starCache[key] = stars
  return stars
end

-- ============================================================================
-- Mesh management
-- ============================================================================

local function ensureMesh(scene, meshNode)
  local props = meshNode.props or {}
  local meshId = meshNode.id

  local entry = scene.meshes[meshId]

  local geometry = props.model or props.geometry or "box"
  local color = props.color
  local textureProp = props.texture
  local seed = props.seed

  local needsCreate = not entry
    or entry.geometry ~= geometry
    or entry.color ~= color
    or entry.textureProp ~= textureProp
    or entry.seed ~= seed

  if needsCreate then
    -- Destroy old VBO
    if entry and entry.vboMesh then destroyVBO(entry.vboMesh) end

    -- Resolve texture
    local texId
    if textureProp and type(textureProp) == "string" then
      texId = getProceduralTexture(textureProp, seed)
    end
    if not texId then
      texId = getColorTexture(color)
    end

    -- Generate geometry
    local verts
    if geometry:sub(-4) == ".obj" then
      -- OBJ loading — use io.lines for SDL2 compatibility
      local ok, loader
      ok, loader = pcall(function()
        local positions, uvs, normals = {}, {}, {}
        local result = {}
        local linesFn = io.lines(geometry)
        if not linesFn then return result end
        for line in linesFn do
          local words = {}
          for word in line:gmatch("([^%s]+)") do words[#words+1] = word end
          local first = words[1]
          if first == "v" then
            positions[#positions+1] = {tonumber(words[2]), tonumber(words[3]), tonumber(words[4])}
          elseif first == "vt" then
            uvs[#uvs+1] = {tonumber(words[2]), tonumber(words[3])}
          elseif first == "vn" then
            normals[#normals+1] = {tonumber(words[2]), tonumber(words[3]), tonumber(words[4])}
          elseif first == "f" then
            local fverts = {}
            for fi = 2, #words do
              local vi, vti, vni = words[fi]:match("(%d*)/(%d*)/(%d*)")
              vi, vti, vni = tonumber(vi), tonumber(vti), tonumber(vni)
              fverts[#fverts+1] = {
                vi and positions[vi][1] or 0, vi and positions[vi][2] or 0, vi and positions[vi][3] or 0,
                vti and uvs[vti][1] or 0, vti and uvs[vti][2] or 0,
                vni and normals[vni][1] or 0, vni and normals[vni][2] or 0, vni and normals[vni][3] or 0,
              }
            end
            if #fverts > 3 then
              for fi = 2, #fverts - 1 do
                result[#result+1] = fverts[1]
                result[#result+1] = fverts[fi]
                result[#result+1] = fverts[fi + 1]
              end
            else
              for fi = 1, #fverts do result[#result+1] = fverts[fi] end
            end
          end
        end
        return result
      end)
      verts = ok and loader or generateBox()
    else
      local generator = geometryGenerators[geometry]
      verts = generator and generator() or generateBox()
    end

    local vboMesh = createVBO(verts)

    entry = {
      vboMesh = vboMesh,
      texId = texId,
      geometry = geometry,
      color = color,
      textureProp = textureProp,
      seed = seed,
      matrix = newMatrix(),
      translation = {0, 0, 0},
      rotation = {0, 0, 0},
      scale = {1, 1, 1},
    }
    scene.meshes[meshId] = entry
  end

  -- Update per-frame properties
  entry.edgeColor = props.edgeColor and parseHexColor(props.edgeColor) or nil
  entry.edgeWidth = props.edgeWidth or 0.03
  entry.wireframe = props.wireframe or false
  entry.gridLines = props.gridLines or 0
  entry.opacity = props.opacity or 1.0
  entry.specular = props.specular or 32
  entry.fresnel = props.fresnel or 0
  entry.unlit = props.unlit or false

  -- Transform
  local pos = props.position or {0, 0, 0}
  local rot = props.rotation or {0, 0, 0}
  local scl = props.scale
  if type(scl) == "number" then scl = {scl, scl, scl} end
  scl = scl or {1, 1, 1}

  entry.translation = {pos[1] or 0, pos[2] or 0, pos[3] or 0}
  entry.rotation = {rot[1] or 0, rot[2] or 0, rot[3] or 0}
  entry.scale = {scl[1] or 1, scl[2] or 1, scl[3] or 1}
  entry.matrix:setTransformationMatrix(entry.translation, entry.rotation, entry.scale)

  return entry
end

-- ============================================================================
-- Public API
-- ============================================================================

local Scene3D = {}

--- Sync a Scene3D node: manage FBO, walk children for meshes/camera/lights
function Scene3D.syncScene(nodeId, node)
  local c = node.computed
  if not c then return end

  local w = math.floor(c.w or 0)
  local h = math.floor(c.h or 0)
  if w <= 0 or h <= 0 then return end

  local scene = scenes[nodeId]
  if not scene then
    scene = {
      fb = nil,
      width = 0,
      height = 0,
      meshes = {},
      cameraNode = nil,
      bgColor = {0.07, 0.07, 0.11, 1},
      orbitRotX = 0,
      orbitRotY = 0,
      orbitPrevMX = nil,
      orbitPrevMY = nil,
    }
    scenes[nodeId] = scene
  end

  -- Recreate FBO if dimensions changed
  if scene.width ~= w or scene.height ~= h then
    destroyFBO(scene.fb)
    scene.fb = createFBO(w, h)
    scene.width = w
    scene.height = h
  end

  -- Parse background color
  local props = node.props or {}
  if props.backgroundColor then
    if props.backgroundColor == "transparent" then
      scene.bgColor = {0, 0, 0, 0}
    else
      local hex = props.backgroundColor:gsub("#", "")
      if #hex == 8 then
        scene.bgColor = {
          tonumber(hex:sub(1, 2), 16) / 255,
          tonumber(hex:sub(3, 4), 16) / 255,
          tonumber(hex:sub(5, 6), 16) / 255,
          tonumber(hex:sub(7, 8), 16) / 255,
        }
      elseif #hex == 6 then
        scene.bgColor = {
          tonumber(hex:sub(1, 2), 16) / 255,
          tonumber(hex:sub(3, 4), 16) / 255,
          tonumber(hex:sub(5, 6), 16) / 255,
          1,
        }
      end
    end
  end

  scene.stars = props.stars or false
  scene.nodeId = nodeId
  scene.orbitControls = props.orbitControls or false
  scene.screenX = c.x or 0
  scene.screenY = c.y or 0

  -- Walk children
  scene.cameraNode = nil
  scene.directionalLight = nil
  scene.ambientLight = nil
  local activeMeshIds = {}

  local function walkChildren(parent)
    for _, child in ipairs(parent.children or {}) do
      if child.type == "Camera3D" then
        scene.cameraNode = child
      elseif child.type == "Mesh3D" then
        ensureMesh(scene, child)
        activeMeshIds[child.id] = true
      elseif child.type == "DirectionalLight3D" then
        scene.directionalLight = child.props
      elseif child.type == "AmbientLight3D" then
        scene.ambientLight = child.props
      elseif child.type == "Group3D" then
        walkChildren(child)
      end
    end
  end
  walkChildren(node)

  -- Prune removed meshes
  for meshId, entry in pairs(scene.meshes) do
    if not activeMeshIds[meshId] then
      destroyVBO(entry.vboMesh)
      scene.meshes[meshId] = nil
    end
  end

  return scene
end

--- Render a scene to its FBO
function Scene3D.renderScene(nodeId)
  local scene = scenes[nodeId]
  if not scene or not scene.fb then return end

  local fb = scene.fb
  local w, h = scene.width, scene.height

  -- Save GL state we'll modify
  local prevViewport = ffi.new("int[4]")
  GL.glGetIntegerv(GL.VIEWPORT, prevViewport)  -- GL_VIEWPORT

  -- Bind FBO
  GL.glBindFramebufferEXT(GL.FRAMEBUFFER_EXT, fb.fbo)
  GL.glViewport(0, 0, w, h)

  -- Clear
  local bg = scene.bgColor
  GL.glClearColor(bg[1], bg[2], bg[3], bg[4])
  GL.glClearDepth(1.0)
  GL.glClear(GL.COLOR_BUFFER_BIT + GL.DEPTH_BUFFER_BIT)

  -- Enable depth test
  GL.glEnable(GL.DEPTH_TEST)
  GL.glDepthFunc(GL.LEQUAL)
  GL.glDepthMask(GL.TRUE)

  -- Draw starfield (immediate mode, no depth)
  if scene.stars then
    GL.glDisable(GL.DEPTH_TEST)
    GL.glUseProgram(0)  -- fixed function

    -- Set up ortho projection for 2D stars
    GL.glMatrixMode(GL.PROJECTION)
    GL.glPushMatrix()
    GL.glLoadIdentity()
    GL.glOrtho(0, w, h, 0, -1, 1)
    GL.glMatrixMode(GL.MODELVIEW)
    GL.glPushMatrix()
    GL.glLoadIdentity()

    local stars = getStars(scene.nodeId or "default", w, h)
    for _, star in ipairs(stars) do
      GL.glPointSize(star.size)
      GL.glColor4f(star.brightness, star.brightness, star.brightness * 0.95, 1)
      GL.glBegin(GL.POINTS)
      GL.glVertex2f(star.x, star.y)
      GL.glEnd()
    end

    GL.glMatrixMode(GL.PROJECTION)
    GL.glPopMatrix()
    GL.glMatrixMode(GL.MODELVIEW)
    GL.glPopMatrix()

    GL.glEnable(GL.DEPTH_TEST)
  end

  -- Set up camera
  if scene.cameraNode then
    local cp = scene.cameraNode.props or {}
    local pos = cp.position or {0, 2, -5}
    local lookAt = cp.lookAt or {0, 0, 0}
    camera.position = {pos[1] or 0, pos[2] or 0, pos[3] or 0}
    camera.target = {lookAt[1] or 0, lookAt[2] or 0, lookAt[3] or 0}
    camera.fov = cp.fov or (math.pi / 3)
    camera.nearClip = cp.near or 0.01
    camera.farClip = cp.far or 1000
  else
    camera.position = {0, -3, 2}
    camera.target = {0, 0, 0}
    camera.fov = math.pi / 3
    camera.nearClip = 0.01
    camera.farClip = 1000
  end
  camera.aspectRatio = w / h
  camera.updateProjectionMatrix()
  camera.updateViewMatrix()

  -- Orbit controls
  if scene.orbitControls then
    local mouseOk, mx, my = pcall(function()
      return love.mouse.getPosition()
    end)
    local mouseDown = false
    if mouseOk then
      local btnOk, isDown = pcall(function() return love.mouse.isDown(1) end)
      mouseDown = btnOk and isDown
    else
      mx, my = 0, 0
    end

    if mouseDown then
      if scene.orbitPrevMX then
        local dx = mx - scene.orbitPrevMX
        local dy = my - scene.orbitPrevMY
        scene.orbitRotY = scene.orbitRotY + dx * 0.008
        scene.orbitRotX = scene.orbitRotX + dy * 0.008
        scene.orbitPrevMX = mx
        scene.orbitPrevMY = my
      else
        local inBounds = mx >= scene.screenX and mx <= scene.screenX + scene.width
                     and my >= scene.screenY and my <= scene.screenY + scene.height
        if inBounds then
          scene.orbitPrevMX = mx
          scene.orbitPrevMY = my
        end
      end
    else
      scene.orbitPrevMX = nil
      scene.orbitPrevMY = nil
    end

    if scene.orbitRotX ~= 0 or scene.orbitRotY ~= 0 then
      for _, entry in pairs(scene.meshes) do
        local r = entry.rotation
        entry.rotation = {r[1] + scene.orbitRotX, r[2] + scene.orbitRotY, r[3]}
        entry.matrix:setTransformationMatrix(entry.translation, entry.rotation, entry.scale)
      end
    end
  end

  -- Resolve lighting
  local dirLight = scene.directionalLight or {}
  local ambLight = scene.ambientLight or {}
  local lightDir = normalizeVec3(dirLight.direction or {-1, 0.5, -0.3})
  local lightColor = parseLightColor(dirLight.color, dirLight.intensity)
  local ambientColor = parseLightColor(ambLight.color or "#1a1a2e", ambLight.intensity or 0.15)
  local camPos = camera.position

  -- Separate opaque and transparent meshes
  local opaque = {}
  local transparent = {}
  for _, entry in pairs(scene.meshes) do
    if entry.opacity < 1.0 then
      transparent[#transparent + 1] = entry
    else
      opaque[#opaque + 1] = entry
    end
  end

  -- Draw mesh helper
  local function drawMeshEntry(entry)
    local useEdge = entry.edgeColor or entry.wireframe

    if useEdge then
      local prog, locs = getEdgeProgram()
      if not prog then return end
      GL.glUseProgram(prog)
      uploadMatrix(locs.uModel, entry.matrix)
      uploadMatrix(locs.uView, camera.viewMatrix)
      uploadMatrix(locs.uProjection, camera.projectionMatrix)
      GL.glActiveTexture(GL.TEXTURE0) -- GL_TEXTURE0
      GL.glBindTexture(GL.TEXTURE_2D, entry.texId)
      if locs.uTexture >= 0 then GL.glUniform1i(locs.uTexture, 0) end
      local ec = entry.edgeColor or {1, 1, 1, 0.6}
      if locs.uEdgeColor >= 0 then GL.glUniform4f(locs.uEdgeColor, ec[1], ec[2], ec[3], ec[4]) end
      local gl = entry.gridLines
      if entry.wireframe and gl == 0 then gl = 8 end
      if locs.uEdgeWidth >= 0 then GL.glUniform1f(locs.uEdgeWidth, entry.edgeWidth) end
      if locs.uGridLines >= 0 then GL.glUniform1f(locs.uGridLines, gl) end
      if locs.uOpacity >= 0 then GL.glUniform1f(locs.uOpacity, entry.opacity) end
      drawVBO(entry.vboMesh, locs.aPosition, locs.aTexCoord, locs.aNormal)
    elseif entry.unlit then
      local prog, locs = getLightingProgram()
      if not prog then return end
      GL.glUseProgram(prog)
      uploadMatrix(locs.uModel, entry.matrix)
      uploadMatrix(locs.uView, camera.viewMatrix)
      uploadMatrix(locs.uProjection, camera.projectionMatrix)
      GL.glActiveTexture(GL.TEXTURE0)
      GL.glBindTexture(GL.TEXTURE_2D, entry.texId)
      if locs.uTexture >= 0 then GL.glUniform1i(locs.uTexture, 0) end
      if locs.uAmbientColor >= 0 then GL.glUniform3f(locs.uAmbientColor, 1, 1, 1) end
      if locs.uLightDir >= 0 then GL.glUniform3f(locs.uLightDir, 0, 0, 0) end
      if locs.uLightColor >= 0 then GL.glUniform3f(locs.uLightColor, 0, 0, 0) end
      if locs.uCameraPos >= 0 then GL.glUniform3f(locs.uCameraPos, camPos[1], camPos[2], camPos[3]) end
      if locs.uSpecularPower >= 0 then GL.glUniform1f(locs.uSpecularPower, 1.0) end
      if locs.uFresnelPower >= 0 then GL.glUniform1f(locs.uFresnelPower, entry.fresnel) end
      if locs.uOpacity >= 0 then GL.glUniform1f(locs.uOpacity, entry.opacity) end
      drawVBO(entry.vboMesh, locs.aPosition, locs.aTexCoord, locs.aNormal)
    else
      local prog, locs = getLightingProgram()
      if not prog then return end
      GL.glUseProgram(prog)
      uploadMatrix(locs.uModel, entry.matrix)
      uploadMatrix(locs.uView, camera.viewMatrix)
      uploadMatrix(locs.uProjection, camera.projectionMatrix)
      GL.glActiveTexture(GL.TEXTURE0)
      GL.glBindTexture(GL.TEXTURE_2D, entry.texId)
      if locs.uTexture >= 0 then GL.glUniform1i(locs.uTexture, 0) end
      if locs.uAmbientColor >= 0 then GL.glUniform3f(locs.uAmbientColor, ambientColor[1], ambientColor[2], ambientColor[3]) end
      if locs.uLightDir >= 0 then GL.glUniform3f(locs.uLightDir, lightDir[1], lightDir[2], lightDir[3]) end
      if locs.uLightColor >= 0 then GL.glUniform3f(locs.uLightColor, lightColor[1], lightColor[2], lightColor[3]) end
      if locs.uCameraPos >= 0 then GL.glUniform3f(locs.uCameraPos, camPos[1], camPos[2], camPos[3]) end
      if locs.uSpecularPower >= 0 then GL.glUniform1f(locs.uSpecularPower, entry.specular) end
      if locs.uFresnelPower >= 0 then GL.glUniform1f(locs.uFresnelPower, entry.fresnel) end
      if locs.uOpacity >= 0 then GL.glUniform1f(locs.uOpacity, entry.opacity) end
      drawVBO(entry.vboMesh, locs.aPosition, locs.aTexCoord, locs.aNormal)
    end
  end

  -- Draw opaque first
  for _, entry in ipairs(opaque) do
    drawMeshEntry(entry)
  end

  -- Draw transparent with depth write off
  if #transparent > 0 then
    GL.glDepthMask(GL.FALSE)
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
    for _, entry in ipairs(transparent) do
      drawMeshEntry(entry)
    end
    GL.glDepthMask(GL.TRUE)
  end

  -- Cleanup: unbind FBO, disable depth test, restore shader to fixed-function
  GL.glUseProgram(0)
  GL.glDisable(GL.DEPTH_TEST)
  GL.glBindFramebufferEXT(GL.FRAMEBUFFER_EXT, 0)

  -- Restore viewport
  GL.glViewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3])

  -- Restore 2D ortho projection (the painter needs this)
  GL.glMatrixMode(GL.PROJECTION)
  GL.glLoadIdentity()
  GL.glOrtho(0, prevViewport[2], prevViewport[3], 0, -1, 1)
  GL.glMatrixMode(GL.MODELVIEW)
  GL.glLoadIdentity()
end

--- Get the FBO color texture ID for compositing
function Scene3D.getTexture(nodeId)
  local scene = scenes[nodeId]
  if scene and scene.fb then return scene.fb.colorTex end
  return nil
end

--- Get scene dimensions
function Scene3D.getDimensions(nodeId)
  local scene = scenes[nodeId]
  if scene then return scene.width, scene.height end
  return 0, 0
end

--- Destroy a scene and free GPU resources
function Scene3D.destroyScene(nodeId)
  local scene = scenes[nodeId]
  if not scene then return end
  destroyFBO(scene.fb)
  for _, entry in pairs(scene.meshes) do
    destroyVBO(entry.vboMesh)
  end
  scenes[nodeId] = nil
end

return Scene3D
