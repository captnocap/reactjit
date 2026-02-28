--[[
  sdl2_painter.lua -- SDL2/OpenGL painter (shader + VBO pipeline)
  Mirrors the lua/painter.lua interface so target_sdl2.lua can drop it in.

  Uses a GLSL 120 shader program + dynamic VBO instead of fixed-function GL.
  All geometry is GL_TRIANGLES (quads = 2 tris = 6 verts, fans tessellated).
  One draw call per flush. Lines stay fixed-function (rare, tiny).
]]

local ffi   = require("ffi")
local GL    = require("lua.sdl2_gl")
local Font  = require("lua.sdl2_font")
local Color = require("lua.color")
local ZIndex = require("lua.zindex")

local W, H = 1280, 720

local Painter = {}

-- Theme reference (set via Painter.setTheme())
local currentTheme = nil

--- Update the active theme reference. Called by init.lua on theme switch.
function Painter.setTheme(theme)
  currentTheme = theme
end

-- ============================================================================
-- Color
-- ============================================================================

local cr, cg, cb, ca = 1, 1, 1, 1

--- Parse a color using the shared Color module, falling back to white.
local function parseColor(c)
  local r, g, b, a = Color.parse(c)
  if r then return r, g, b, a end
  return 1, 1, 1, 1
end

function Painter.setColor(color)
  cr, cg, cb, ca = parseColor(color)
end

function Painter.applyOpacity(op)
  if op >= 1 then return end
  ca = ca * op
end

-- ============================================================================
-- Shader program
-- ============================================================================

local VERT_SRC = [[
#version 120
attribute vec2 aPos;
attribute vec2 aUV;
attribute vec4 aColor;
uniform mat4 uProj;
uniform mat4 uTransform;
varying vec2 vUV;
varying vec4 vColor;
void main() {
    gl_Position = uProj * uTransform * vec4(aPos, 0.0, 1.0);
    vUV = aUV;
    vColor = aColor;
}
]]

local FRAG_SRC = [[
#version 120
uniform sampler2D uTex;
uniform int uUseTex;
varying vec2 vUV;
varying vec4 vColor;
void main() {
    if (uUseTex != 0) {
        gl_FragColor = texture2D(uTex, vUV) * vColor;
    } else {
        gl_FragColor = vColor;
    }
}
]]

local prog = 0       -- shader program ID
local vbo  = 0       -- VBO ID
local locPos, locUV, locColor             -- attrib locations
local locProj, locTransform, locUseTex, locTex  -- uniform locations

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
    io.write("[sdl2_painter] Shader compile error: " .. ffi.string(buf) .. "\n")
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

  local p = GL.glCreateProgram()
  GL.glAttachShader(p, vs)
  GL.glAttachShader(p, fs)
  GL.glLinkProgram(p)

  local status = ffi.new("int[1]")
  GL.glGetProgramiv(p, GL.LINK_STATUS, status)
  if status[0] == 0 then
    local logLen = ffi.new("int[1]")
    GL.glGetProgramiv(p, GL.INFO_LOG_LENGTH, logLen)
    local buf = ffi.new("char[?]", logLen[0] + 1)
    GL.glGetProgramInfoLog(p, logLen[0] + 1, nil, buf)
    io.write("[sdl2_painter] Program link error: " .. ffi.string(buf) .. "\n")
    io.flush()
    GL.glDeleteProgram(p)
    GL.glDeleteShader(vs)
    GL.glDeleteShader(fs)
    return nil
  end

  GL.glDeleteShader(vs)
  GL.glDeleteShader(fs)
  return p
end

-- ============================================================================
-- Lua-side 4×4 matrix stack (column-major, replaces glPushMatrix etc.)
-- ============================================================================

local curMat  = ffi.new("float[16]")
local projMat = ffi.new("float[16]")
local matStack = {}
local matStackTop = 0

-- Identity
local function matIdentity(m)
  ffi.fill(m, 64, 0)  -- 16 floats × 4 bytes
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1
end

-- Ortho projection (column-major): maps (0,0)-(w,h) to clip space
local function matOrtho(m, w, h)
  ffi.fill(m, 64, 0)
  m[0]  =  2 / w
  m[5]  = -2 / h       -- flip Y: top=0
  m[10] = -1
  m[12] = -1            -- translate X
  m[13] =  1            -- translate Y (flipped)
  m[15] =  1
end

local function pushMatrix()
  matStackTop = matStackTop + 1
  local saved = matStack[matStackTop]
  if not saved then
    saved = ffi.new("float[16]")
    matStack[matStackTop] = saved
  end
  ffi.copy(saved, curMat, 64)
end

local function popMatrix()
  if matStackTop <= 0 then return end
  ffi.copy(curMat, matStack[matStackTop], 64)
  matStackTop = matStackTop - 1
end

-- Translate current matrix (column-major multiply)
local function translateMat(tx, ty)
  -- M' = M * T  where T is translation matrix
  -- For column-major: col3 += col0*tx + col1*ty
  curMat[12] = curMat[12] + curMat[0]*tx + curMat[4]*ty
  curMat[13] = curMat[13] + curMat[1]*tx + curMat[5]*ty
  curMat[14] = curMat[14] + curMat[2]*tx + curMat[6]*ty
  curMat[15] = curMat[15] + curMat[3]*tx + curMat[7]*ty
end

-- Rotate current matrix by degrees around Z
local function rotateMat(deg)
  local rad = deg * (math.pi / 180)
  local cosA = math.cos(rad)
  local sinA = math.sin(rad)
  -- M' = M * R
  local c0, c1, c2, c3 = curMat[0], curMat[4], curMat[8],  curMat[12]
  local r0, r1, r2, r3 = curMat[1], curMat[5], curMat[9],  curMat[13]
  local s0, s1, s2, s3 = curMat[2], curMat[6], curMat[10], curMat[14]
  local t0, t1, t2, t3 = curMat[3], curMat[7], curMat[11], curMat[15]
  curMat[0] = c0*cosA + c1*sinA;  curMat[4] = -c0*sinA + c1*cosA
  curMat[1] = r0*cosA + r1*sinA;  curMat[5] = -r0*sinA + r1*cosA
  curMat[2] = s0*cosA + s1*sinA;  curMat[6] = -s0*sinA + s1*cosA
  curMat[3] = t0*cosA + t1*sinA;  curMat[7] = -t0*sinA + t1*cosA
end

-- Scale current matrix
local function scaleMat(sx, sy)
  curMat[0]  = curMat[0]  * sx;  curMat[4]  = curMat[4]  * sy
  curMat[1]  = curMat[1]  * sx;  curMat[5]  = curMat[5]  * sy
  curMat[2]  = curMat[2]  * sx;  curMat[6]  = curMat[6]  * sy
  curMat[3]  = curMat[3]  * sx;  curMat[7]  = curMat[7]  * sy
end

-- ============================================================================
-- Dynamic VBO + vertex buffer
-- Vertex layout: x, y, u, v, r, g, b, a = 8 floats = 32 bytes per vertex
-- GL_TRIANGLES only. Quads = 6 verts (2 tris). Fans tessellated.
-- ============================================================================

local MAX_VERTS       = 24576   -- 4096 quads × 6 verts
local FLOATS_PER_VERT = 8
local STRIDE_BYTES    = FLOATS_PER_VERT * 4  -- 32 bytes

local vtxBuf    = ffi.new("float[?]", MAX_VERTS * FLOATS_PER_VERT)
local vertCount = 0
local curTexId  = 0       -- 0 = solid (no texture), >0 = textured

local function initGPU()
  prog = linkProgram(VERT_SRC, FRAG_SRC)
  if not prog then error("[sdl2_painter] Failed to link shader program") end

  -- Cache attrib/uniform locations
  locPos       = GL.glGetAttribLocation(prog, "aPos")
  locUV        = GL.glGetAttribLocation(prog, "aUV")
  locColor     = GL.glGetAttribLocation(prog, "aColor")
  locProj      = GL.glGetUniformLocation(prog, "uProj")
  locTransform = GL.glGetUniformLocation(prog, "uTransform")
  locUseTex    = GL.glGetUniformLocation(prog, "uUseTex")
  locTex       = GL.glGetUniformLocation(prog, "uTex")

  -- Create VBO
  local ids = ffi.new("unsigned int[1]")
  GL.glGenBuffers(1, ids)
  vbo = ids[0]

  -- Init matrices
  matIdentity(curMat)
  matOrtho(projMat, W, H)
end

-- ============================================================================
-- Flush: upload VBO + draw all accumulated triangles in ONE call
-- ============================================================================

local function flush()
  if vertCount == 0 then return end

  GL.glUseProgram(prog)
  GL.glBindBuffer(GL.ARRAY_BUFFER, vbo)
  GL.glBufferData(GL.ARRAY_BUFFER, vertCount * STRIDE_BYTES, vtxBuf, GL.DYNAMIC_DRAW)

  -- Attrib pointers (offsets in bytes within stride)
  GL.glEnableVertexAttribArray(locPos)
  GL.glVertexAttribPointer(locPos, 2, GL.FLOAT, GL.FALSE, STRIDE_BYTES, ffi.cast("void*", 0))

  GL.glEnableVertexAttribArray(locUV)
  GL.glVertexAttribPointer(locUV, 2, GL.FLOAT, GL.FALSE, STRIDE_BYTES, ffi.cast("void*", 8))

  GL.glEnableVertexAttribArray(locColor)
  GL.glVertexAttribPointer(locColor, 4, GL.FLOAT, GL.FALSE, STRIDE_BYTES, ffi.cast("void*", 16))

  -- Uniforms
  GL.glUniformMatrix4fv(locProj, 1, GL.FALSE, projMat)
  GL.glUniformMatrix4fv(locTransform, 1, GL.FALSE, curMat)

  if curTexId > 0 then
    GL.glUniform1i(locUseTex, 1)
    GL.glActiveTexture(GL.TEXTURE0)
    GL.glBindTexture(GL.TEXTURE_2D, curTexId)
    GL.glUniform1i(locTex, 0)
  else
    GL.glUniform1i(locUseTex, 0)
  end

  GL.glDrawArrays(GL.TRIANGLES, 0, vertCount)

  GL.glDisableVertexAttribArray(locPos)
  GL.glDisableVertexAttribArray(locUV)
  GL.glDisableVertexAttribArray(locColor)
  GL.glBindBuffer(GL.ARRAY_BUFFER, 0)
  GL.glUseProgram(0)

  if curTexId > 0 then
    GL.glBindTexture(GL.TEXTURE_2D, 0)
  end

  vertCount = 0
  curTexId  = 0
end

-- ============================================================================
-- Vertex push helpers (GL_TRIANGLES — 6 verts per quad, fans tessellated)
-- ============================================================================

-- Write one vertex into vtxBuf at the current vertCount position
local function pushVert(x, y, u, v, r, g, b, a)
  if vertCount >= MAX_VERTS then flush() end
  local base = vertCount * FLOATS_PER_VERT
  vtxBuf[base]   = x;  vtxBuf[base+1] = y
  vtxBuf[base+2] = u;  vtxBuf[base+3] = v
  vtxBuf[base+4] = r;  vtxBuf[base+5] = g;  vtxBuf[base+6] = b;  vtxBuf[base+7] = a
  vertCount = vertCount + 1
end

--- Push a solid-color quad as 2 triangles (6 verts), UV=0.
local function addSolidQuad(x, y, w, h, r, g, b, a)
  if curTexId > 0 then flush() end
  if vertCount + 6 > MAX_VERTS then flush() end
  local x2, y2 = x + w, y + h
  local base = vertCount * FLOATS_PER_VERT
  -- Triangle 1: TL, TR, BR
  vtxBuf[base]    = x;   vtxBuf[base+1]  = y
  vtxBuf[base+2]  = 0;   vtxBuf[base+3]  = 0
  vtxBuf[base+4]  = r;   vtxBuf[base+5]  = g;  vtxBuf[base+6]  = b;  vtxBuf[base+7]  = a

  vtxBuf[base+8]  = x2;  vtxBuf[base+9]  = y
  vtxBuf[base+10] = 0;   vtxBuf[base+11] = 0
  vtxBuf[base+12] = r;   vtxBuf[base+13] = g;  vtxBuf[base+14] = b;  vtxBuf[base+15] = a

  vtxBuf[base+16] = x2;  vtxBuf[base+17] = y2
  vtxBuf[base+18] = 0;   vtxBuf[base+19] = 0
  vtxBuf[base+20] = r;   vtxBuf[base+21] = g;  vtxBuf[base+22] = b;  vtxBuf[base+23] = a

  -- Triangle 2: TL, BR, BL
  vtxBuf[base+24] = x;   vtxBuf[base+25] = y
  vtxBuf[base+26] = 0;   vtxBuf[base+27] = 0
  vtxBuf[base+28] = r;   vtxBuf[base+29] = g;  vtxBuf[base+30] = b;  vtxBuf[base+31] = a

  vtxBuf[base+32] = x2;  vtxBuf[base+33] = y2
  vtxBuf[base+34] = 0;   vtxBuf[base+35] = 0
  vtxBuf[base+36] = r;   vtxBuf[base+37] = g;  vtxBuf[base+38] = b;  vtxBuf[base+39] = a

  vtxBuf[base+40] = x;   vtxBuf[base+41] = y2
  vtxBuf[base+42] = 0;   vtxBuf[base+43] = 0
  vtxBuf[base+44] = r;   vtxBuf[base+45] = g;  vtxBuf[base+46] = b;  vtxBuf[base+47] = a

  vertCount = vertCount + 6
end

--- Push a textured quad as 2 triangles (6 verts). Auto-flushes on texture change.
local function addTexturedQuad(texId, x, y, w, h, u0, v0, u1, v1, r, g, b, a)
  if curTexId ~= 0 and curTexId ~= texId then flush() end
  curTexId = texId
  if vertCount + 6 > MAX_VERTS then flush(); curTexId = texId end
  local x2, y2 = x + w, y + h
  local base = vertCount * FLOATS_PER_VERT
  -- Triangle 1: TL, TR, BR
  vtxBuf[base]    = x;   vtxBuf[base+1]  = y
  vtxBuf[base+2]  = u0;  vtxBuf[base+3]  = v0
  vtxBuf[base+4]  = r;   vtxBuf[base+5]  = g;  vtxBuf[base+6]  = b;  vtxBuf[base+7]  = a

  vtxBuf[base+8]  = x2;  vtxBuf[base+9]  = y
  vtxBuf[base+10] = u1;  vtxBuf[base+11] = v0
  vtxBuf[base+12] = r;   vtxBuf[base+13] = g;  vtxBuf[base+14] = b;  vtxBuf[base+15] = a

  vtxBuf[base+16] = x2;  vtxBuf[base+17] = y2
  vtxBuf[base+18] = u1;  vtxBuf[base+19] = v1
  vtxBuf[base+20] = r;   vtxBuf[base+21] = g;  vtxBuf[base+22] = b;  vtxBuf[base+23] = a

  -- Triangle 2: TL, BR, BL
  vtxBuf[base+24] = x;   vtxBuf[base+25] = y
  vtxBuf[base+26] = u0;  vtxBuf[base+27] = v0
  vtxBuf[base+28] = r;   vtxBuf[base+29] = g;  vtxBuf[base+30] = b;  vtxBuf[base+31] = a

  vtxBuf[base+32] = x2;  vtxBuf[base+33] = y2
  vtxBuf[base+34] = u1;  vtxBuf[base+35] = v1
  vtxBuf[base+36] = r;   vtxBuf[base+37] = g;  vtxBuf[base+38] = b;  vtxBuf[base+39] = a

  vtxBuf[base+40] = x;   vtxBuf[base+41] = y2
  vtxBuf[base+42] = u0;  vtxBuf[base+43] = v1
  vtxBuf[base+44] = r;   vtxBuf[base+45] = g;  vtxBuf[base+46] = b;  vtxBuf[base+47] = a

  vertCount = vertCount + 6
end

--- Tessellate a triangle fan into individual GL_TRIANGLES.
--- verts = array of {x,y} pairs: verts[1] = center, verts[2..n] = edge.
--- Produces (n-2) triangles = (n-2)*3 verts.
local function addTriFan(verts, n, r, g, b, a)
  if curTexId > 0 then flush() end
  local cx, cy = verts[1], verts[2]
  for i = 1, n - 2 do
    local i1 = i * 2 + 1
    local i2 = i1 + 2
    if vertCount + 3 > MAX_VERTS then flush() end
    pushVert(cx, cy, 0, 0, r, g, b, a)
    pushVert(verts[i1], verts[i1+1], 0, 0, r, g, b, a)
    pushVert(verts[i2], verts[i2+1], 0, 0, r, g, b, a)
  end
end

--- Tessellate a triangle strip into individual GL_TRIANGLES.
--- verts = flat {x1,y1,x2,y2,...}, n = number of vertices.
local function addTriStrip(verts, n, r, g, b, a)
  if curTexId > 0 then flush() end
  for i = 0, n - 3 do
    if vertCount + 3 > MAX_VERTS then flush() end
    local i0 = i * 2
    local i1 = (i + 1) * 2
    local i2 = (i + 2) * 2
    if i % 2 == 0 then
      pushVert(verts[i0], verts[i0+1], 0, 0, r, g, b, a)
      pushVert(verts[i1], verts[i1+1], 0, 0, r, g, b, a)
      pushVert(verts[i2], verts[i2+1], 0, 0, r, g, b, a)
    else
      pushVert(verts[i1], verts[i1+1], 0, 0, r, g, b, a)
      pushVert(verts[i0], verts[i0+1], 0, 0, r, g, b, a)
      pushVert(verts[i2], verts[i2+1], 0, 0, r, g, b, a)
    end
  end
end

-- ============================================================================
-- Geometry
-- ============================================================================

local function filledRect(x, y, w, h)
  addSolidQuad(x, y, w, h, cr, cg, cb, ca)
end

-- Lines use fixed-function (rare, tiny — flush shader first)
local function strokedRect(x, y, w, h, lw)
  flush()
  GL.glColor4f(cr, cg, cb, ca)
  GL.glLineWidth(lw or 1)
  GL.glBegin(GL.LINE_LOOP)
    GL.glVertex2f(x, y)
    GL.glVertex2f(x+w, y)
    GL.glVertex2f(x+w, y+h)
    GL.glVertex2f(x, y+h)
  GL.glEnd()
  GL.glLineWidth(1)
end

local math_cos  = math.cos
local math_sin  = math.sin
local math_min  = math.min
local math_max  = math.max
local math_pi   = math.pi
local math_ceil = math.ceil
local math_floor = math.floor

local ROUND_SEGS = 6  -- segments per corner arc

-- Shared edge-vertex buffer for rounded rect generation (Lua table, flat xy pairs)
-- Max: 4 corners × (ROUND_SEGS+1) + 1 center + 1 close = ~30 verts
local polyXY = {}

--- Generate rounded rect edge vertices into polyXY.
--- Returns number of edge vertices (NOT including center).
local function writeRoundedPoly(x, y, w, h, r)
  local maxR = math_min(w, h) * 0.5
  if r > maxR then r = maxR end
  if r <= 0 then
    polyXY[1] = x;   polyXY[2] = y
    polyXY[3] = x+w; polyXY[4] = y
    polyXY[5] = x+w; polyXY[6] = y+h
    polyXY[7] = x;   polyXY[8] = y+h
    return 4
  end
  local n = 0
  local segs = ROUND_SEGS
  local arcs = {
    { x+r,   y+r,   math_pi,     math_pi*1.5 },
    { x+w-r, y+r,   math_pi*1.5, math_pi*2   },
    { x+w-r, y+h-r, 0,           math_pi*0.5 },
    { x+r,   y+h-r, math_pi*0.5, math_pi     },
  }
  for _, arc in ipairs(arcs) do
    local cx, cy, a0, a1 = arc[1], arc[2], arc[3], arc[4]
    for i = 0, segs do
      local a = a0 + (a1 - a0) * (i / segs)
      n = n + 1
      polyXY[n*2-1] = cx + math_cos(a) * r
      polyXY[n*2]   = cy + math_sin(a) * r
    end
  end
  return n
end

local function filledRoundedRect(x, y, w, h, r)
  if r <= 0 then filledRect(x, y, w, h); return end
  local n = writeRoundedPoly(x, y, w, h, r)
  -- Build fan: center + edge verts + close
  local fan = {}
  fan[1] = x + w * 0.5
  fan[2] = y + h * 0.5
  for i = 1, n do
    fan[i*2+1] = polyXY[i*2-1]
    fan[i*2+2] = polyXY[i*2]
  end
  -- Close: repeat first edge vertex
  fan[(n+1)*2+1] = polyXY[1]
  fan[(n+1)*2+2] = polyXY[2]
  addTriFan(fan, n + 2, cr, cg, cb, ca)
end

local function strokedRoundedRect(x, y, w, h, r, lw)
  flush()
  GL.glColor4f(cr, cg, cb, ca)
  GL.glLineWidth(lw or 1)
  if r <= 0 then
    GL.glBegin(GL.LINE_LOOP)
      GL.glVertex2f(x, y)
      GL.glVertex2f(x+w, y)
      GL.glVertex2f(x+w, y+h)
      GL.glVertex2f(x, y+h)
    GL.glEnd()
  else
    local n = writeRoundedPoly(x, y, w, h, r)
    GL.glBegin(GL.LINE_LOOP)
    for i = 1, n do
      GL.glVertex2f(polyXY[i*2-1], polyXY[i*2])
    end
    GL.glEnd()
  end
  GL.glLineWidth(1)
end

-- ============================================================================
-- Gradient — 2 triangles with per-vertex color interpolation
-- ============================================================================

local function drawGradient(x, y, w, h, dir, c1, c2, op)
  flush()
  local r1, g1, b1, a1 = parseColor(c1); a1 = a1 * op
  local r2, g2, b2, a2 = parseColor(c2); a2 = a2 * op
  local x2, y2 = x + w, y + h
  if dir == "horizontal" then
    -- TL=c1, TR=c2, BR=c2, BL=c1
    pushVert(x,  y,  0,0, r1,g1,b1,a1)
    pushVert(x2, y,  0,0, r2,g2,b2,a2)
    pushVert(x2, y2, 0,0, r2,g2,b2,a2)
    pushVert(x,  y,  0,0, r1,g1,b1,a1)
    pushVert(x2, y2, 0,0, r2,g2,b2,a2)
    pushVert(x,  y2, 0,0, r1,g1,b1,a1)
  else
    -- TL=c1, TR=c1, BR=c2, BL=c2
    pushVert(x,  y,  0,0, r1,g1,b1,a1)
    pushVert(x2, y,  0,0, r1,g1,b1,a1)
    pushVert(x2, y2, 0,0, r2,g2,b2,a2)
    pushVert(x,  y,  0,0, r1,g1,b1,a1)
    pushVert(x2, y2, 0,0, r2,g2,b2,a2)
    pushVert(x,  y2, 0,0, r2,g2,b2,a2)
  end
end

-- ============================================================================
-- Box shadow — reduced passes, calls filledRoundedRect per pass
-- ============================================================================

local function drawBoxShadow(x, y, w, h, r, sc, ox, oy, blur, op)
  if not sc or blur <= 0 then return end
  local sr, sg, sb, sa = parseColor(sc)
  local steps = math_min(math_ceil(blur), 6)
  for i = steps, 1, -1 do
    cr = sr; cg = sg; cb = sb; ca = (sa * op / steps) * (steps - i + 1)
    filledRoundedRect(x + ox - i, y + oy - i, w + i * 2, h + i * 2, r + i)
  end
end

-- ============================================================================
-- Scissor (GL y-flip)
-- ============================================================================

local scissorStack = {}

local function pushScissor(x, y, w, h)
  flush()
  if #scissorStack > 0 then
    local p = scissorStack[#scissorStack]
    local nx  = math_max(p.x, x); local ny  = math_max(p.y, y)
    local nx2 = math_min(p.x+p.w, x+w); local ny2 = math_min(p.y+p.h, y+h)
    x, y = nx, ny; w = math_max(0, nx2-nx); h = math_max(0, ny2-ny)
  end
  table.insert(scissorStack, {x=x, y=y, w=w, h=h})
  GL.glEnable(GL.SCISSOR_TEST)
  GL.glScissor(x, H-(y+h), math_max(0,w), math_max(0,h))
end

local function popScissor()
  flush()
  table.remove(scissorStack)
  if #scissorStack > 0 then
    local p = scissorStack[#scissorStack]
    GL.glScissor(p.x, H-(p.y+p.h), math_max(0,p.w), math_max(0,p.h))
  else
    GL.glDisable(GL.SCISSOR_TEST)
  end
end

-- ============================================================================
-- Stencil
-- ============================================================================

local function writeStencil(value, drawFn)
  flush()
  GL.glEnable(GL.STENCIL_TEST)
  GL.glStencilFunc(GL.ALWAYS, value, 0xFF)
  GL.glStencilOp(GL.KEEP, GL.KEEP, GL.REPLACE)
  GL.glColorMask(GL.FALSE, GL.FALSE, GL.FALSE, GL.FALSE)
  GL.glDepthMask(GL.FALSE)
  drawFn()
  flush()  -- ensure stencil geometry is drawn
  GL.glColorMask(GL.TRUE, GL.TRUE, GL.TRUE, GL.TRUE)
  GL.glDepthMask(GL.TRUE)
end

local function setStencilTest(value)
  flush()
  GL.glStencilFunc(GL.GREATER, value, 0xFF)
  GL.glStencilOp(GL.KEEP, GL.KEEP, GL.KEEP)
end

local function clearStencilTest()
  flush()
  GL.glDisable(GL.STENCIL_TEST)
end

-- ============================================================================
-- Transform (Lua-side matrix stack)
-- ============================================================================

local function applyTransform(t, c)
  if not t then return false end
  if not (t.translateX or t.translateY or t.rotate or t.scaleX or t.scaleY) then
    return false
  end
  flush()
  pushMatrix()
  local ox = c.x + (t.originX or 0.5) * c.w
  local oy = c.y + (t.originY or 0.5) * c.h
  translateMat(ox, oy)
  if t.rotate   then rotateMat(t.rotate) end
  if t.scaleX or t.scaleY then
    scaleMat(t.scaleX or 1, t.scaleY or 1)
  end
  translateMat(-ox, -oy)
  if t.translateX or t.translateY then
    translateMat(t.translateX or 0, t.translateY or 0)
  end
  return true
end

-- ============================================================================
-- Text
-- ============================================================================

-- Measure cache: avoids per-frame FFI calls for unchanged text.
local measureCache = {}
local measureCacheSize = 0
local MEASURE_CACHE_MAX = 512

local function cachedMeasureWidth(text, size)
  local key = size * 65536 + #text
  local entry = measureCache[key]
  if entry and entry[1] == text then return entry[2] end
  local w = Font.measureWidth(text, size)
  if measureCacheSize >= MEASURE_CACHE_MAX then
    measureCache = {}; measureCacheSize = 0
  end
  measureCache[key] = { text, w }
  measureCacheSize = measureCacheSize + 1
  return w
end

function Painter.clearMeasureCache()
  measureCache = {}; measureCacheSize = 0
end

local function drawText(text, x, y, w, align, size, color, op)
  local r, g, b, a = parseColor(color); a = a * op
  local tw = cachedMeasureWidth(text, size)
  local dx = x
  if     align == "center" then dx = x + (w - tw) / 2
  elseif align == "right"  then dx = x + w - tw
  end
  Font.drawBatched(text, dx, y, size, r, g, b, a, addTexturedQuad)
end

local function wrapText(text, size, maxWidth)
  return Font.wrapText(text, size, maxWidth)
end

local ELLIPSIS = "..."

local function truncateWithEllipsis(text, fontSize, maxWidth)
  local textW = Font.measureWidth(text, fontSize)
  if textW <= maxWidth then return text end
  local ellipsisW = Font.measureWidth(ELLIPSIS, fontSize)
  local available = maxWidth - ellipsisW
  if available <= 0 then return ELLIPSIS end
  local lo, hi = 0, #text
  while lo < hi do
    local mid = math_floor((lo + hi + 1) / 2)
    local prefix = text:sub(1, mid)
    if Font.measureWidth(prefix, fontSize) <= available then
      lo = mid
    else
      hi = mid - 1
    end
  end
  if lo == 0 then return ELLIPSIS end
  return text:sub(1, lo) .. ELLIPSIS
end

-- ============================================================================
-- Arc sector / polygon helpers
-- ============================================================================

local function drawArcSector(c, arc)
  local cx = c.x + c.w * 0.5
  local cy = c.y + c.h * 0.5
  local r  = math_min(c.w, c.h) * 0.5
  local ir = arc.innerRadius or 0
  local a0 = arc.startAngle
  local a1 = arc.endAngle

  local span  = math.abs(a1 - a0)
  local steps = math_max(8, math_floor(span * r * 0.5))
  if steps > 200 then steps = 200 end

  if ir > 0 then
    -- Annular sector: tessellate triangle strip to individual triangles
    local stripVerts = {}
    local n = 0
    for i = 0, steps do
      local a = a0 + (a1 - a0) * (i / steps)
      local cosA = math_cos(a)
      local sinA = math_sin(a)
      n = n + 1; stripVerts[n*2-1] = cx + cosA * r;  stripVerts[n*2] = cy + sinA * r
      n = n + 1; stripVerts[n*2-1] = cx + cosA * ir; stripVerts[n*2] = cy + sinA * ir
    end
    addTriStrip(stripVerts, n, cr, cg, cb, ca)
  else
    -- Solid slice: fan from center
    local fan = {}
    fan[1] = cx; fan[2] = cy
    local n = 1
    for i = 0, steps do
      local a = a0 + (a1 - a0) * (i / steps)
      n = n + 1
      fan[n*2-1] = cx + math_cos(a) * r
      fan[n*2]   = cy + math_sin(a) * r
    end
    addTriFan(fan, n, cr, cg, cb, ca)
  end
end

local function drawPolygon(c, pts)
  if #pts < 6 then return end
  local nPts = #pts / 2
  local sumX, sumY = 0, 0
  for i = 1, #pts, 2 do sumX = sumX + pts[i]; sumY = sumY + pts[i+1] end
  local fan = {}
  fan[1] = c.x + sumX / nPts
  fan[2] = c.y + sumY / nPts
  local n = 1
  for i = 1, #pts, 2 do
    n = n + 1
    fan[n*2-1] = c.x + pts[i]
    fan[n*2]   = c.y + pts[i+1]
  end
  -- Close fan
  n = n + 1
  fan[n*2-1] = c.x + pts[1]
  fan[n*2]   = c.y + pts[2]
  addTriFan(fan, n, cr, cg, cb, ca)
end

-- ============================================================================
-- Per-corner border radius helpers
-- ============================================================================

local function resolveCornerRadii(s)
  local uniform = s.borderRadius or 0
  local tl = s.borderTopLeftRadius or uniform
  local tr = s.borderTopRightRadius or uniform
  local bl = s.borderBottomLeftRadius or uniform
  local br = s.borderBottomRightRadius or uniform
  return tl, tr, bl, br
end

local function hasPerCornerRadius(s)
  return s.borderTopLeftRadius or s.borderTopRightRadius
      or s.borderBottomLeftRadius or s.borderBottomRightRadius
end

local function writePerCornerPoly(x, y, w, h, tl, tr, bl, br)
  local maxR = math_min(w, h) * 0.5
  tl = math_min(tl, maxR); tr = math_min(tr, maxR)
  bl = math_min(bl, maxR); br = math_min(br, maxR)

  local segs = ROUND_SEGS
  local n = 0

  local function addArc(cx, cy, r, a0, a1)
    if r <= 0 then
      n = n + 1
      polyXY[n*2-1] = cx; polyXY[n*2] = cy
      return
    end
    for i = 0, segs do
      local a = a0 + (a1 - a0) * (i / segs)
      n = n + 1
      polyXY[n*2-1] = cx + math_cos(a) * r
      polyXY[n*2]   = cy + math_sin(a) * r
    end
  end

  addArc(x + tl,     y + tl,     tl, math_pi,     math_pi * 1.5)
  addArc(x + w - tr, y + tr,     tr, math_pi * 1.5, math_pi * 2)
  addArc(x + w - br, y + h - br, br, 0,             math_pi * 0.5)
  addArc(x + bl,     y + h - bl, bl, math_pi * 0.5, math_pi)

  return n
end

local function filledPerCornerRect(x, y, w, h, tl, tr, bl, br)
  if tl <= 0 and tr <= 0 and bl <= 0 and br <= 0 then
    filledRect(x, y, w, h)
    return
  end
  local n = writePerCornerPoly(x, y, w, h, tl, tr, bl, br)
  local fan = {}
  fan[1] = x + w * 0.5
  fan[2] = y + h * 0.5
  for i = 1, n do
    fan[i*2+1] = polyXY[i*2-1]
    fan[i*2+2] = polyXY[i*2]
  end
  fan[(n+1)*2+1] = polyXY[1]
  fan[(n+1)*2+2] = polyXY[2]
  addTriFan(fan, n + 2, cr, cg, cb, ca)
end

local function strokedPerCornerRect(x, y, w, h, tl, tr, bl, br, lw)
  flush()
  GL.glColor4f(cr, cg, cb, ca)
  GL.glLineWidth(lw or 1)
  if tl <= 0 and tr <= 0 and bl <= 0 and br <= 0 then
    GL.glBegin(GL.LINE_LOOP)
      GL.glVertex2f(x, y)
      GL.glVertex2f(x+w, y)
      GL.glVertex2f(x+w, y+h)
      GL.glVertex2f(x, y+h)
    GL.glEnd()
  else
    local n = writePerCornerPoly(x, y, w, h, tl, tr, bl, br)
    GL.glBegin(GL.LINE_LOOP)
    for i = 1, n do
      GL.glVertex2f(polyXY[i*2-1], polyXY[i*2])
    end
    GL.glEnd()
  end
  GL.glLineWidth(1)
end

-- ============================================================================
-- Node painter
-- ============================================================================

-- Lazy-loaded modules
local CapabilitiesModule = nil
local TextInputModule = nil
local TextEditorModule = nil
local CodeBlockModule = nil
local SliderModule = nil
local FaderModule = nil
local KnobModule = nil
local SwitchModule = nil
local CheckboxModule = nil
local RadioModule = nil
local SelectModule = nil
local VideoPlayerModule = nil

-- Video module reference (set via Painter.init())
local VideosModule = nil
local ImagesModule = nil
local EffectsModule = nil

function Painter.paintNode(node, inheritedOpacity, stencilDepth)
  if not node or not node.computed then return end
  inheritedOpacity = inheritedOpacity or 1
  stencilDepth     = stencilDepth or 0

  -- Viewport culling: skip nodes entirely outside the visible area.
  local c0 = node.computed
  if not (node.style and node.style.transform) then
    if c0.x + c0.w < 0 or c0.x > W or c0.y + c0.h < 0 or c0.y > H then
      return
    end
  end

  -- Skip non-visual capability nodes
  if not CapabilitiesModule then
    local ok, mod = pcall(require, "lua.capabilities")
    if ok then CapabilitiesModule = mod end
  end
  if CapabilitiesModule then
    if CapabilitiesModule.isNonVisual(node.type)
       and not CapabilitiesModule.rendersInOwnSurface(node.type) then
      return
    end
    if CapabilitiesModule.rendersInOwnSurface(node.type)
       and not node._isWindowRoot then
      return
    end
  end

  local c = node.computed
  local s = node.style or {}

  if s.display == "none" then return end
  local isHidden = s.visibility == "hidden"

  local eff = (s.opacity or 1) * inheritedOpacity
  if eff <= 0 then return end

  local didTx = applyTransform(s.transform, c)

  -- Resolve border radii
  local tl, tr, bl, br = resolveCornerRadii(s)
  local borderRadius = s.borderRadius or 0
  local hasRoundedCorners = tl > 0 or tr > 0 or bl > 0 or br > 0
  local isPerCorner = hasPerCornerRadius(s)
  local isScroll   = s.overflow == "scroll" or s.overflow == "auto"
  local needsClip  = s.overflow == "hidden" or isScroll
  local useStencil = needsClip and hasRoundedCorners
  local useScissor = needsClip and not hasRoundedCorners
  local prevSD = stencilDepth

  if useStencil then
    if c.w < 1 or c.h < 1 then
      io.write("[painter] STENCIL skip 0-size id=" .. tostring(node.id) .. " " .. c.w .. "x" .. c.h .. "\n"); io.flush()
    end
    local sv = stencilDepth + 1
    writeStencil(sv, function()
      if isPerCorner then
        filledPerCornerRect(c.x, c.y, c.w, c.h, tl, tr, bl, br)
      else
        filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
      end
    end)
    setStencilTest(stencilDepth)
    stencilDepth = sv
  elseif useScissor then
    pushScissor(c.x, c.y, c.w, c.h)
  end

  -- View / box
  if not isHidden and (node.type == "View" or node.type == "box") then
    if s.shadowColor and (s.shadowBlur or 0) > 0 then
      drawBoxShadow(c.x, c.y, c.w, c.h, borderRadius, s.shadowColor,
                    s.shadowOffsetX or 0, s.shadowOffsetY or 0, s.shadowBlur, eff)
    end
    if s.backgroundGradient then
      local gr = s.backgroundGradient
      drawGradient(c.x, c.y, c.w, c.h, gr.direction or "vertical",
                   gr.colors[1], gr.colors[2], eff)
    elseif s.backgroundColor and s.backgroundColor ~= "transparent" then
      Painter.setColor(s.backgroundColor)
      Painter.applyOpacity(eff)
      if s.arcShape then
        drawArcSector(c, s.arcShape)
      elseif s.polygonPoints and #s.polygonPoints >= 6 then
        drawPolygon(c, s.polygonPoints)
      elseif isPerCorner then
        filledPerCornerRect(c.x, c.y, c.w, c.h, tl, tr, bl, br)
      else
        filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
      end
    end

    -- Border stroke
    local bwT = s.borderTopWidth or s.borderWidth or 0
    local bwR = s.borderRightWidth or s.borderWidth or 0
    local bwB = s.borderBottomWidth or s.borderWidth or 0
    local bwL = s.borderLeftWidth or s.borderWidth or 0
    local hasUniformBorder = s.borderWidth and s.borderWidth > 0
        and not s.borderTopWidth and not s.borderRightWidth
        and not s.borderBottomWidth and not s.borderLeftWidth
    local hasPerSideBorder = (bwT > 0 or bwR > 0 or bwB > 0 or bwL > 0) and not hasUniformBorder

    if hasUniformBorder then
      Painter.setColor(s.borderColor or {0.5, 0.5, 0.5, 1})
      Painter.applyOpacity(eff)
      if isPerCorner then
        strokedPerCornerRect(c.x, c.y, c.w, c.h, tl, tr, bl, br, s.borderWidth)
      else
        strokedRoundedRect(c.x, c.y, c.w, c.h, borderRadius, s.borderWidth)
      end
    elseif hasPerSideBorder then
      -- Per-side borders: fixed-function lines
      flush()
      local defaultColor = s.borderColor or {0.5, 0.5, 0.5, 1}
      if bwT > 0 then
        local br2, bg2, bb2, ba2 = parseColor(s.borderTopColor or defaultColor)
        GL.glColor4f(br2, bg2, bb2, ba2 * eff)
        GL.glLineWidth(bwT)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, c.y + bwT/2)
          GL.glVertex2f(c.x + c.w, c.y + bwT/2)
        GL.glEnd()
      end
      if bwB > 0 then
        local br2, bg2, bb2, ba2 = parseColor(s.borderBottomColor or defaultColor)
        GL.glColor4f(br2, bg2, bb2, ba2 * eff)
        GL.glLineWidth(bwB)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, c.y + c.h - bwB/2)
          GL.glVertex2f(c.x + c.w, c.y + c.h - bwB/2)
        GL.glEnd()
      end
      if bwL > 0 then
        local br2, bg2, bb2, ba2 = parseColor(s.borderLeftColor or defaultColor)
        GL.glColor4f(br2, bg2, bb2, ba2 * eff)
        GL.glLineWidth(bwL)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x + bwL/2, c.y)
          GL.glVertex2f(c.x + bwL/2, c.y + c.h)
        GL.glEnd()
      end
      if bwR > 0 then
        local br2, bg2, bb2, ba2 = parseColor(s.borderRightColor or defaultColor)
        GL.glColor4f(br2, bg2, bb2, ba2 * eff)
        GL.glLineWidth(bwR)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x + c.w - bwR/2, c.y)
          GL.glVertex2f(c.x + c.w - bwR/2, c.y + c.h)
        GL.glEnd()
      end
      GL.glLineWidth(1)
    end

  -- Text / __TEXT__
  elseif not isHidden and (node.type == "Text" or node.type == "__TEXT__") then
    local ps = (node.type == "__TEXT__" and node.parent and node.parent.style) or {}
    local fontSize = s.fontSize or ps.fontSize or 14

    local textColor = s.color
    if not textColor and node.type == "__TEXT__" and node.parent then
      textColor = (node.parent.style or {}).color
    end
    local defaultTextColor = (currentTheme and currentTheme.colors and currentTheme.colors.text) or {1, 1, 1, 1}
    local color = textColor or defaultTextColor

    local align = s.textAlign or ps.textAlign or "left"
    local text  = node.text or (node.props and node.props.children) or ""
    if type(text) == "table" then text = table.concat(text) end
    text = tostring(text)

    local numberOfLines = (node.props and node.props.numberOfLines)
    if not numberOfLines and node.type == "__TEXT__" and node.parent then
      numberOfLines = (node.parent.props or {}).numberOfLines
    end
    local textOverflow = s.textOverflow
    if not textOverflow and node.type == "__TEXT__" and node.parent then
      textOverflow = (node.parent.style or {}).textOverflow
    end

    local textDecorationLine = s.textDecorationLine
    if not textDecorationLine and node.type == "__TEXT__" and node.parent then
      textDecorationLine = (node.parent.style or {}).textDecorationLine
    end

    -- Text shadow
    local shadowColor = s.textShadowColor
    if not shadowColor and node.type == "__TEXT__" and node.parent then
      shadowColor = (node.parent.style or {}).textShadowColor
    end
    if shadowColor then
      local sox = s.textShadowOffsetX or 0
      local soy = s.textShadowOffsetY or 0
      if sox == 0 and node.type == "__TEXT__" and node.parent then
        sox = (node.parent.style or {}).textShadowOffsetX or 0
      end
      if soy == 0 and node.type == "__TEXT__" and node.parent then
        soy = (node.parent.style or {}).textShadowOffsetY or 0
      end
      if c.w > 0 then
        local lines = wrapText(text, fontSize, c.w)
        if numberOfLines and numberOfLines > 0 and #lines > numberOfLines then
          local trunc = {}
          for i = 1, numberOfLines do trunc[i] = lines[i] end
          if textOverflow == "ellipsis" then
            trunc[numberOfLines] = truncateWithEllipsis(trunc[numberOfLines], fontSize, c.w)
          end
          lines = trunc
        end
        local lh = Font.lineHeight(fontSize)
        for i, line in ipairs(lines) do
          drawText(line, c.x + sox, c.y + (i-1)*lh + soy, c.w, align, fontSize, shadowColor, eff)
        end
      else
        drawText(text, c.x + sox, c.y + soy, 99999, align, fontSize, shadowColor, eff)
      end
    end

    -- Main text draw
    if c.w > 0 then
      local lines = wrapText(text, fontSize, c.w)
      if numberOfLines and numberOfLines > 0 and #lines > numberOfLines then
        local truncated = {}
        for i = 1, numberOfLines do truncated[i] = lines[i] end
        if textOverflow == "ellipsis" then
          truncated[numberOfLines] = truncateWithEllipsis(truncated[numberOfLines], fontSize, c.w)
        end
        lines = truncated
      end
      local lh = Font.lineHeight(fontSize)
      for i, line in ipairs(lines) do
        drawText(line, c.x, c.y + (i-1)*lh, c.w, align, fontSize, color, eff)
      end
    else
      drawText(text, c.x, c.y, 99999, align, fontSize, color, eff)
    end

    -- Text decorations (fixed-function lines)
    if textDecorationLine and textDecorationLine ~= "none" then
      flush()
      local dr, dg, db, da = parseColor(color)
      GL.glColor4f(dr, dg, db, da * eff)
      local lh = Font.lineHeight(fontSize)
      if textDecorationLine == "underline" then
        local ascender = Font.ascender(fontSize)
        local descent = lh - ascender
        local baselineY = c.y + ascender + descent * 0.3
        GL.glLineWidth(1)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, baselineY)
          GL.glVertex2f(c.x + c.w, baselineY)
        GL.glEnd()
      elseif textDecorationLine == "line-through" then
        local midY = c.y + lh * 0.45
        GL.glLineWidth(1)
        GL.glBegin(GL.LINES)
          GL.glVertex2f(c.x, midY)
          GL.glVertex2f(c.x + c.w, midY)
        GL.glEnd()
      end
    end

  -- Lua-owned interactive widgets
  elseif not isHidden and node.type == "TextInput" then
    if not TextInputModule then
      local ok, mod = pcall(require, "lua.textinput")
      if ok then TextInputModule = mod
      else io.write("[painter] TextInput load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if TextInputModule then flush(); TextInputModule.draw(node, eff) end

  elseif not isHidden and node.type == "TextEditor" then
    if not TextEditorModule then
      local ok, mod = pcall(require, "lua.texteditor")
      if ok then TextEditorModule = mod
      else io.write("[painter] TextEditor load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if TextEditorModule then flush(); TextEditorModule.draw(node, eff) end

  elseif not isHidden and node.type == "CodeBlock" then
    if not CodeBlockModule then
      local ok, mod = pcall(require, "lua.codeblock")
      if ok then CodeBlockModule = mod
      else io.write("[painter] CodeBlock load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if CodeBlockModule and CodeBlockModule.render then
      if c and c.w > 0 and c.h > 0 then
        flush()
        CodeBlockModule.render(node, c, eff)
      end
    end

  elseif not isHidden and node.type == "Slider" then
    if not SliderModule then
      local ok, mod = pcall(require, "lua.slider")
      if ok then SliderModule = mod
      else io.write("[painter] Slider load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if SliderModule then flush(); SliderModule.draw(node, eff) end

  elseif not isHidden and node.type == "Fader" then
    if not FaderModule then
      local ok, mod = pcall(require, "lua.fader")
      if ok then FaderModule = mod
      else io.write("[painter] Fader load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if FaderModule then flush(); FaderModule.draw(node, eff) end

  elseif not isHidden and node.type == "Knob" then
    if not KnobModule then
      local ok, mod = pcall(require, "lua.knob")
      if ok then KnobModule = mod
      else io.write("[painter] Knob load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if KnobModule then flush(); KnobModule.draw(node, eff) end

  elseif not isHidden and node.type == "Switch" then
    if not SwitchModule then
      local ok, mod = pcall(require, "lua.switch")
      if ok then SwitchModule = mod
      else io.write("[painter] Switch load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if SwitchModule then flush(); SwitchModule.draw(node, eff) end

  elseif not isHidden and node.type == "Checkbox" then
    if not CheckboxModule then
      local ok, mod = pcall(require, "lua.checkbox")
      if ok then CheckboxModule = mod
      else io.write("[painter] Checkbox load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if CheckboxModule then flush(); CheckboxModule.draw(node, eff) end

  elseif not isHidden and node.type == "Radio" then
    if not RadioModule then
      local ok, mod = pcall(require, "lua.radio")
      if ok then RadioModule = mod
      else io.write("[painter] Radio load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if RadioModule then flush(); RadioModule.draw(node, eff) end

  elseif not isHidden and node.type == "Select" then
    if not SelectModule then
      local ok, mod = pcall(require, "lua.select")
      if ok then SelectModule = mod
      else io.write("[painter] Select load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if SelectModule then flush(); SelectModule.draw(node, eff) end

  elseif not isHidden and node.type == "Image" then
    local src = node.props and node.props.src
    if src and ImagesModule then
      local entry = ImagesModule.get(src)
      if entry then
        local objectFit = s.objectFit or "fill"
        local imgW, imgH = entry.w, entry.h
        local drawX, drawY, drawW, drawH

        if objectFit == "contain" then
          local scale = math_min(c.w / imgW, c.h / imgH)
          drawW = imgW * scale; drawH = imgH * scale
          drawX = c.x + (c.w - drawW) / 2
          drawY = c.y + (c.h - drawH) / 2
        elseif objectFit == "cover" then
          local scale = math_max(c.w / imgW, c.h / imgH)
          drawW = imgW * scale; drawH = imgH * scale
          drawX = c.x + (c.w - drawW) / 2
          drawY = c.y + (c.h - drawH) / 2
        elseif objectFit == "none" then
          drawW = imgW; drawH = imgH
          drawX = c.x + (c.w - imgW) / 2
          drawY = c.y + (c.h - imgH) / 2
        else -- "fill"
          drawX = c.x; drawY = c.y
          drawW = c.w; drawH = c.h
        end

        -- Clip to borderRadius if needed
        local imageStencil = hasRoundedCorners and not useStencil
        if imageStencil then
          local sv = stencilDepth + 1
          writeStencil(sv, function()
            if isPerCorner then
              filledPerCornerRect(c.x, c.y, c.w, c.h, tl, tr, bl, br)
            else
              filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
            end
          end)
          setStencilTest(stencilDepth)
        end

        addTexturedQuad(entry.texId, drawX, drawY, drawW, drawH, 0, 0, 1, 1, 1, 1, 1, eff)

        if imageStencil then
          flush()
          if stencilDepth > 0 then setStencilTest(stencilDepth - 1)
          else clearStencilTest() end
        end
      else
        Painter.setColor({0.5, 0.5, 0.5, 0.3})
        Painter.applyOpacity(eff)
        filledRect(c.x, c.y, c.w, c.h)
      end
    end

  elseif not isHidden and node.type == "Video" and VideosModule then
    local src = node.props and node.props.src
    if src then
      local status = VideosModule.getStatus(src)
      if status == "ready" then
        local vidEntry = VideosModule.get(src)
        if vidEntry then
          VideosModule.setPaused(src, node.props.paused)
          VideosModule.setMuted(src, node.props.muted)
          VideosModule.setVolume(src, node.props.volume or 1)
          VideosModule.setLoop(src, node.props.loop)

          local objectFit = s.objectFit or "fill"
          local vidW, vidH = vidEntry.w, vidEntry.h
          local drawX, drawY, drawW, drawH

          if objectFit == "contain" then
            local scale = math_min(c.w / vidW, c.h / vidH)
            drawW = vidW * scale; drawH = vidH * scale
            drawX = c.x + (c.w - drawW) / 2
            drawY = c.y + (c.h - drawH) / 2
          elseif objectFit == "cover" then
            local scale = math_max(c.w / vidW, c.h / vidH)
            drawW = vidW * scale; drawH = vidH * scale
            drawX = c.x + (c.w - drawW) / 2
            drawY = c.y + (c.h - drawH) / 2
          elseif objectFit == "none" then
            drawW = vidW; drawH = vidH
            drawX = c.x + (c.w - vidW) / 2
            drawY = c.y + (c.h - vidH) / 2
          else -- "fill"
            drawX = c.x; drawY = c.y
            drawW = c.w; drawH = c.h
          end

          addTexturedQuad(vidEntry.texId, drawX, drawY, drawW, drawH, 0, 0, 1, 1, 1, 1, 1, eff)
        end
      else
        -- Loading placeholder
        Painter.setColor({0.10, 0.11, 0.14, 1})
        Painter.applyOpacity(eff)
        filledRoundedRect(c.x, c.y, c.w, c.h, borderRadius)
        -- Play triangle icon
        local iconSize = math_min(c.w, c.h) * 0.15
        if iconSize > 6 then
          flush()
          local icx = c.x + c.w / 2
          local icy = c.y + c.h / 2
          local ia = 0.5 * eff
          pushVert(icx - iconSize * 0.4, icy - iconSize * 0.5, 0, 0, 0.30, 0.33, 0.40, ia)
          pushVert(icx + iconSize * 0.5, icy,                  0, 0, 0.30, 0.33, 0.40, ia)
          pushVert(icx - iconSize * 0.4, icy + iconSize * 0.5, 0, 0, 0.30, 0.33, 0.40, ia)
        end
      end
    end

  elseif not isHidden and node.type == "VideoPlayer" then
    if not VideoPlayerModule then
      local ok, mod = pcall(require, "lua.sdl2_videoplayer")
      if ok then VideoPlayerModule = mod
      else io.write("[painter] VideoPlayer load error: " .. tostring(mod) .. "\n"); io.flush() end
    end
    if VideoPlayerModule then
      local vpState = node._vp
      if not (vpState and vpState.isFullscreen) then
        flush()
        VideoPlayerModule.draw(node, eff)
      end
    end

  elseif not isHidden and EffectsModule and EffectsModule.isEffect(node.type) then
    local canvas = EffectsModule.get(node.id)
    if canvas then
      flush()
      love.graphics.setColor(1, 1, 1, eff)
      local cw, ch = canvas:getDimensions()
      love.graphics.draw(canvas, c.x, c.y, 0, c.w / cw, c.h / ch)
    end
  end

  -- Generic capability draw dispatch
  if not isHidden and CapabilitiesModule then
    local def = CapabilitiesModule.getDefinition(node.type)
    if def and def.draw then
      flush()
      local inst = CapabilitiesModule.getInstance(tostring(node.id))
      if inst then
        def.draw(tostring(node.id), inst.state, inst.props or {}, c, eff)
      end
    end
  end

  -- Background effect canvas
  if EffectsModule then
    local bgCanvas = EffectsModule.getBackground(node.id)
    if bgCanvas then
      flush()
      love.graphics.setColor(1, 1, 1, eff)
      local cw, ch = bgCanvas:getDimensions()
      love.graphics.draw(bgCanvas, c.x, c.y, 0, c.w / cw, c.h / ch)
    end
  end

  -- Children
  local scrollX, scrollY = 0, 0
  if isScroll and node.scrollState then
    scrollX = node.scrollState.scrollX or 0
    scrollY = node.scrollState.scrollY or 0
  end
  if isScroll and (scrollX ~= 0 or scrollY ~= 0) then
    flush()
    pushMatrix()
    translateMat(-scrollX, -scrollY)
  end

  local children = node.children or {}
  local paintOrder = ZIndex.getSortedChildren(children)

  for _, child in ipairs(paintOrder) do
    Painter.paintNode(child, eff, stencilDepth)
  end

  if isScroll and (scrollX ~= 0 or scrollY ~= 0) then
    flush()
    popMatrix()
  end

  if useStencil then
    if prevSD > 0 then setStencilTest(prevSD - 1)
    else clearStencilTest() end
  elseif useScissor then
    popScissor()
  end

  if didTx then flush(); popMatrix() end
end

function Painter.paint(node)
  if not node then return end

  -- Reset matrix to identity for this frame
  matIdentity(curMat)

  Painter.paintNode(node)
  flush()

  -- Search highlight overlay
  local ok, Search = pcall(require, "lua.search")
  if ok then
    local hl = Search.getHighlight()
    if hl and hl.node and hl.node.computed then
      local nc = hl.node.computed
      -- Fill
      addSolidQuad(nc.x - 2, nc.y - 2, nc.w + 4, nc.h + 4,
                   0.23, 0.51, 0.96, hl.alpha * 0.3)
      flush()
      -- Border (fixed-function line)
      GL.glColor4f(0.23, 0.51, 0.96, hl.alpha * 0.8)
      GL.glLineWidth(2)
      GL.glBegin(GL.LINE_LOOP)
        GL.glVertex2f(nc.x - 2, nc.y - 2)
        GL.glVertex2f(nc.x + nc.w + 2, nc.y - 2)
        GL.glVertex2f(nc.x + nc.w + 2, nc.y + nc.h + 2)
        GL.glVertex2f(nc.x - 2, nc.y + nc.h + 2)
      GL.glEnd()
      GL.glLineWidth(1)
    end
  end
end

function Painter.init(config)
  W = (config and config.width)  or 1280
  H = (config and config.height) or 720
  VideosModule  = config and config.videos
  ImagesModule  = config and config.images
  EffectsModule = config and config.effects
  initGPU()
end

--- Set effects module reference (called after effects.loadAll()).
function Painter.setEffects(mod)
  EffectsModule = mod
end

-- Update screen dimensions (called on resize)
function Painter.setDimensions(w, h)
  W = w; H = h
  matOrtho(projMat, w, h)
end

return Painter
