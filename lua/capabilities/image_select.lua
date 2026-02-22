--[[
  capabilities/image_select.lua — Interactive image selection capability

  Renders an image and allows click-to-select via flood fill with optional
  Sobel edge blocking. The mask overlay is rendered as a semi-transparent
  colored layer over the selected pixels.

  React usage:
    <ImageSelect
      src="photo.jpg"
      tolerance={32}
      edgeDetection={true}
      selectX={point.x}
      selectY={point.y}
      onClick={(e) => setPoint({ x: e.x, y: e.y })}
      onMaskReady={(e) => console.log(e.pixelCount)}
      style={{ flexGrow: 1 }}
    />
]]

local ffi          = require("ffi")
local Capabilities = require("lua.capabilities")
local GL           = require("lua.sdl2_gl")

-- Lazy-load modules (may not be available on Love2D target)
local Images      = nil
local ImageSelect = nil

local function ensureModules()
  if not Images then
    local ok, mod = pcall(require, "lua.sdl2_images")
    if ok then Images = mod end
  end
  if not ImageSelect then
    local ok, mod = pcall(require, "lua.image_select")
    if ok then ImageSelect = mod end
  end
  return Images ~= nil and ImageSelect ~= nil
end

-- ── Color parsing ────────────────────────────────────────

local function parseHexColor(hex)
  if type(hex) ~= "string" or hex:sub(1,1) ~= "#" then
    return 0.2, 0.6, 1.0, 0.5  -- default: semi-transparent blue
  end
  local function hb(s, i) return tonumber(s:sub(i, i+1), 16) / 255 end
  if #hex == 9 then return hb(hex,2), hb(hex,4), hb(hex,6), hb(hex,8) end
  if #hex == 7 then return hb(hex,2), hb(hex,4), hb(hex,6), 0.5 end
  return 0.2, 0.6, 1.0, 0.5
end

-- ── GL texture helpers ───────────────────────────────────

local _texIds = ffi.new("unsigned int[1]")

local function createMaskTexture(rgba, w, h)
  GL.glGenTextures(1, _texIds)
  local texId = _texIds[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glPixelStorei(GL.UNPACK_ALIGNMENT, 1)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA, w, h, 0,
                  GL.RGBA, GL.UNSIGNED_BYTE, rgba)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
  return texId
end

local function deleteMaskTexture(texId)
  if texId and texId > 0 then
    _texIds[0] = texId
    GL.glDeleteTextures(1, _texIds)
  end
end

-- ── Capability ───────────────────────────────────────────

Capabilities.register("ImageSelect", {
  visual = true,

  schema = {
    src           = { type = "string",  desc = "Image file path" },
    tolerance     = { type = "number",  min = 0, max = 255, default = 32,  desc = "Color distance threshold" },
    edgeDetection = { type = "bool",    default = false,                   desc = "Use Sobel edge blocking" },
    edgeThreshold = { type = "number",  min = 0, max = 255, default = 30,  desc = "Sobel edge sensitivity" },
    selectX       = { type = "number",  desc = "Selection origin X (layout coords)" },
    selectY       = { type = "number",  desc = "Selection origin Y (layout coords)" },
    mode          = { type = "string",  default = "select",                desc = "select | remove-background" },
    maskColor     = { type = "color",   default = "#3399FF80",             desc = "Mask overlay color" },
  },

  events = { "onMaskReady", "onError" },

  create = function(nodeId, props)
    return {
      src       = nil,     -- currently loaded source path
      imgEntry  = nil,     -- { texId, w, h, pixels } from sdl2_images
      maskTexId = 0,       -- GL texture for the mask overlay
      maskDirty = false,   -- true when mask needs to be recomputed
      maskReady = false,   -- true when mask was just computed (fire event in tick)
      maskCount = 0,       -- selected pixel count
      edgeMask  = nil,     -- cached Sobel edge mask
      lastSelectX = nil,
      lastSelectY = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
    if not ensureModules() then return end

    -- Source changed: reload image
    if props.src ~= state.src then
      -- Unload old
      if state.src then Images.unload(state.src) end
      deleteMaskTexture(state.maskTexId)
      state.maskTexId = 0
      state.edgeMask = nil
      state.maskReady = false

      -- Load new
      state.src = props.src
      state.imgEntry = nil
      if props.src then
        state.imgEntry = Images.load(props.src)
        if not state.imgEntry then
          state.pendingError = "Failed to load image: " .. tostring(props.src)
        end
      end
    end

    -- Edge detection settings changed: invalidate edge mask
    if props.edgeDetection ~= prev.edgeDetection
       or props.edgeThreshold ~= prev.edgeThreshold then
      state.edgeMask = nil
    end

    -- Selection point changed: mark mask dirty
    local sx = tonumber(props.selectX)
    local sy = tonumber(props.selectY)
    if sx and sy and (sx ~= state.lastSelectX or sy ~= state.lastSelectY) then
      state.lastSelectX = sx
      state.lastSelectY = sy
      state.maskDirty = true
    end
  end,

  destroy = function(nodeId, state)
    if state.src and Images then
      Images.unload(state.src)
    end
    deleteMaskTexture(state.maskTexId)
    state.imgEntry = nil
    state.edgeMask = nil
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end
    if not ensureModules() then return end

    -- Fire error event
    if state.pendingError then
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onError",
          message = state.pendingError,
        },
      })
      state.pendingError = nil
    end

    -- Process mask if dirty
    if state.maskDirty and state.imgEntry then
      state.maskDirty = false
      local entry = state.imgEntry
      local pixels = entry.pixels
      local w = entry.w
      local h = entry.h
      local tol = tonumber(props.tolerance) or 32

      -- Map layout coords to image coords (objectFit: contain)
      -- This needs the node's computed rect, which draw() sets on state
      local imgX = state.lastSelectX
      local imgY = state.lastSelectY

      -- If we have layout → image mapping info from draw(), use it
      if state.imgOffsetX and state.imgScaleX then
        imgX = (imgX - state.imgOffsetX) / state.imgScaleX
        imgY = (imgY - state.imgOffsetY) / state.imgScaleY
      end

      imgX = math.floor(imgX or 0)
      imgY = math.floor(imgY or 0)

      -- Bounds check
      if imgX >= 0 and imgX < w and imgY >= 0 and imgY < h then
        -- Compute edge mask if needed
        local edgeMask = nil
        if props.edgeDetection then
          if not state.edgeMask then
            local edgeThresh = tonumber(props.edgeThreshold) or 30
            state.edgeMask = ImageSelect.sobelEdges(pixels, w, h, edgeThresh)
          end
          edgeMask = state.edgeMask
        end

        -- Run flood fill
        local mask, count = ImageSelect.floodFill(pixels, w, h, imgX, imgY, tol, edgeMask)

        -- Build mask texture
        local mr, mg, mb, ma = parseHexColor(props.maskColor)
        local rgba = ImageSelect.maskToRGBA(mask, w, h, mr, mg, mb, ma)

        deleteMaskTexture(state.maskTexId)
        state.maskTexId = createMaskTexture(rgba, w, h)
        state.maskCount = count
        state.maskReady = true
      end
    end

    -- Fire maskReady event
    if state.maskReady then
      state.maskReady = false
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onMaskReady",
          pixelCount = state.maskCount,
          imageWidth = state.imgEntry and state.imgEntry.w or 0,
          imageHeight = state.imgEntry and state.imgEntry.h or 0,
        },
      })
    end
  end,

  -- Called by sdl2_painter.lua via generic capability draw dispatch.
  -- nodeId: string, state: table, props: table, c: computed rect, opacity: float
  draw = function(nodeId, state, props, c, opacity)
    if not state.imgEntry then return end
    if not c or c.w <= 0 or c.h <= 0 then return end

    local entry = state.imgEntry
    local imgW = entry.w
    local imgH = entry.h

    -- objectFit: contain — scale image to fit within the computed rect
    local scaleX = c.w / imgW
    local scaleY = c.h / imgH
    local scale = math.min(scaleX, scaleY)
    local drawW = imgW * scale
    local drawH = imgH * scale
    local drawX = c.x + (c.w - drawW) / 2
    local drawY = c.y + (c.h - drawH) / 2

    -- Store mapping info for layout → image coord conversion in tick
    state.imgOffsetX = drawX
    state.imgOffsetY = drawY
    state.imgScaleX = scale
    state.imgScaleY = scale

    -- Draw the image
    GL.glEnable(GL.TEXTURE_2D)
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
    GL.glBindTexture(GL.TEXTURE_2D, entry.texId)
    GL.glColor4f(1, 1, 1, opacity or 1)

    GL.glBegin(GL.QUADS)
      GL.glTexCoord2f(0, 0); GL.glVertex2f(drawX,         drawY)
      GL.glTexCoord2f(1, 0); GL.glVertex2f(drawX + drawW, drawY)
      GL.glTexCoord2f(1, 1); GL.glVertex2f(drawX + drawW, drawY + drawH)
      GL.glTexCoord2f(0, 1); GL.glVertex2f(drawX,         drawY + drawH)
    GL.glEnd()

    GL.glBindTexture(GL.TEXTURE_2D, 0)

    -- Draw mask overlay if present
    if state.maskTexId > 0 then
      GL.glBindTexture(GL.TEXTURE_2D, state.maskTexId)
      GL.glColor4f(1, 1, 1, opacity or 1)

      GL.glBegin(GL.QUADS)
        GL.glTexCoord2f(0, 0); GL.glVertex2f(drawX,         drawY)
        GL.glTexCoord2f(1, 0); GL.glVertex2f(drawX + drawW, drawY)
        GL.glTexCoord2f(1, 1); GL.glVertex2f(drawX + drawW, drawY + drawH)
        GL.glTexCoord2f(0, 1); GL.glVertex2f(drawX,         drawY + drawH)
      GL.glEnd()

      GL.glBindTexture(GL.TEXTURE_2D, 0)
    end

    GL.glDisable(GL.TEXTURE_2D)
    GL.glColor4f(1, 1, 1, 1)
  end,
})
