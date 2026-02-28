--[[
  capabilities/image_process.lua — Frame-distributed image resize + compress

  Spreads CPU-intensive image processing across multiple frames so the UI
  never blocks. Same idea as Tor distributing circuit setup over its event
  loop — each tick does a small batch of work within a time budget, then
  yields back to the run loop.

  Phases:
    1. load     — decode source image (1 frame, via stb_image)
    2. resize   — bilinear interpolation, N output rows per frame (adaptive)
    3. encode   — JPEG/PNG write (1 frame, fast on already-resized buffer)
    4. done     — fires onComplete, idles

  React usage:
    <ImageProcess
      src="/photos/big.jpg"
      output="/thumbs/big_800.jpg"
      width={800}
      quality={80}
      format="jpeg"
      frameBudgetMs={4}
      onProgress={(e) => setProgress(e.progress)}
      onComplete={(e) => console.log(e.outputPath, e.sizeBytes)}
      onError={(e) => console.error(e.message)}
    />
]]

local ffi          = require("ffi")
local Capabilities = require("lua.capabilities")

-- ── FFI declarations for the extended image_helper ──────────────────────

local img_lib = nil

local function ensureFFI()
  if img_lib then return true end

  -- image_load / image_free may already be declared elsewhere.
  -- pcall tolerates the duplicate cdef.
  pcall(ffi.cdef, [[
    unsigned char *image_load(const char *path, int *out_w, int *out_h, int *out_channels);
    void image_free(unsigned char *data);
  ]])

  -- These are unique to image_process — no duplicate risk.
  ffi.cdef[[
    int image_write_png(const char *path, int w, int h, const unsigned char *data);
    int image_write_bmp(const char *path, int w, int h, const unsigned char *data);
    int image_write_jpg(const char *path, int w, int h, const unsigned char *data, int quality);

    unsigned char *image_write_jpg_mem(const unsigned char *data, int w, int h,
                                       int quality, int *out_len);
    unsigned char *image_write_png_mem(const unsigned char *data, int w, int h,
                                       int *out_len);

    typedef struct ImageResizeCtx ImageResizeCtx;

    ImageResizeCtx *image_resize_begin(const unsigned char *input,
                                       int in_w, int in_h,
                                       int out_w, int out_h);
    int  image_resize_rows(ImageResizeCtx *ctx, int num_rows);
    int  image_resize_done(ImageResizeCtx *ctx);
    int  image_resize_progress(ImageResizeCtx *ctx);
    int  image_resize_out_w(ImageResizeCtx *ctx);
    int  image_resize_out_h(ImageResizeCtx *ctx);
    unsigned char *image_resize_result(ImageResizeCtx *ctx);
    void image_resize_free(ImageResizeCtx *ctx);
  ]]

  local loader = require("lua.lib_loader")
  local ok, lib = pcall(loader.load, "image_helper")
  if ok then
    img_lib = lib
    return true
  end
  io.write("[image_process] Failed to load image_helper: " .. tostring(lib) .. "\n")
  io.flush()
  return false
end

-- ── Pre-allocated FFI scratch ───────────────────────────────────────────

local _ow  = ffi.new("int[1]")
local _oh  = ffi.new("int[1]")
local _oc  = ffi.new("int[1]")
local _len = ffi.new("int[1]")

-- ── High-resolution timer ───────────────────────────────────────────────

local clock
if love and love.timer then
  clock = love.timer.getTime    -- Love2D: microsecond precision
else
  clock = os.clock              -- fallback: CPU time
end

-- ── Compute target dimensions (maintain aspect ratio) ───────────────────

local function computeOutputSize(in_w, in_h, want_w, want_h)
  -- Both specified: use as-is
  if want_w and want_h then
    return math.floor(want_w), math.floor(want_h)
  end
  -- Only width: scale height proportionally
  if want_w then
    local scale = want_w / in_w
    return math.floor(want_w), math.max(1, math.floor(in_h * scale))
  end
  -- Only height: scale width proportionally
  if want_h then
    local scale = want_h / in_h
    return math.max(1, math.floor(in_w * scale)), math.floor(want_h)
  end
  -- Neither: pass through original
  return in_w, in_h
end

-- ── File size helper ────────────────────────────────────────────────────

local function fileSize(path)
  local f = io.open(path, "rb")
  if not f then return 0 end
  local sz = f:seek("end")
  f:close()
  return sz or 0
end

-- ── Capability ──────────────────────────────────────────────────────────

Capabilities.register("ImageProcess", {
  visual = false,

  schema = {
    src           = { type = "string",  required = true,   desc = "Source image path" },
    output        = { type = "string",  required = true,   desc = "Output file path" },
    width         = { type = "number",  desc = "Target width (aspect-preserving if height omitted)" },
    height        = { type = "number",  desc = "Target height (aspect-preserving if width omitted)" },
    quality       = { type = "number",  min = 1, max = 100, default = 80, desc = "JPEG quality" },
    format        = { type = "string",  default = "jpeg",  desc = "Output format: jpeg, png, bmp" },
    frameBudgetMs = { type = "number",  min = 1, max = 16, default = 4,  desc = "Max ms per frame for processing" },
  },

  events = { "onProgress", "onComplete", "onError" },

  -- ── create ──────────────────────────────────────────────────────────
  create = function(nodeId, props)
    return {
      phase        = "idle",       -- idle | load | resize | encode | done | error
      pixels       = nil,          -- source RGBA buffer (ffi cdata)
      in_w         = 0,
      in_h         = 0,
      out_w        = 0,
      out_h        = 0,
      resizeCtx    = nil,          -- ImageResizeCtx* (ffi pointer)
      rowsPerBatch = 32,           -- adaptive: tuned each frame to hit budget
      lastSrc      = nil,          -- detect prop changes
      lastOutput   = nil,
      lastWidth    = nil,
      lastHeight   = nil,
      lastQuality  = nil,
      lastFormat   = nil,
    }
  end,

  -- ── update ──────────────────────────────────────────────────────────
  update = function(nodeId, props, prev, state)
    -- Detect if any input prop changed → restart processing
    local src    = props.src
    local output = props.output
    local w      = tonumber(props.width)
    local h      = tonumber(props.height)
    local q      = tonumber(props.quality) or 80
    local fmt    = props.format or "jpeg"

    if src    == state.lastSrc
       and output == state.lastOutput
       and w      == state.lastWidth
       and h      == state.lastHeight
       and q      == state.lastQuality
       and fmt    == state.lastFormat then
      return  -- no change
    end

    -- New job: reset state
    -- Clean up any in-progress resize
    if state.resizeCtx ~= nil then
      img_lib.image_resize_free(state.resizeCtx)
      state.resizeCtx = nil
    end
    if state.pixels ~= nil then
      img_lib.image_free(state.pixels)
      state.pixels = nil
    end

    state.phase     = "load"
    state.lastSrc    = src
    state.lastOutput = output
    state.lastWidth  = w
    state.lastHeight = h
    state.lastQuality = q
    state.lastFormat  = fmt
    state.rowsPerBatch = 32
  end,

  -- ── destroy ─────────────────────────────────────────────────────────
  destroy = function(nodeId, state)
    if state.resizeCtx ~= nil and img_lib then
      img_lib.image_resize_free(state.resizeCtx)
      state.resizeCtx = nil
    end
    if state.pixels ~= nil and img_lib then
      img_lib.image_free(state.pixels)
      state.pixels = nil
    end
  end,

  -- ── tick (frame-distributed) ────────────────────────────────────────
  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end
    if state.phase == "idle" or state.phase == "done" or state.phase == "error" then
      return
    end
    if not ensureFFI() then
      state.phase = "error"
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError",
                    message = "image_helper library not available" },
      })
      return
    end

    local budget = (tonumber(props.frameBudgetMs) or 4) / 1000  -- seconds

    -- ── Phase: LOAD ─────────────────────────────────────────────────
    if state.phase == "load" then
      local src = props.src
      if not src or src == "" then
        state.phase = "error"
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError",
                      message = "No source path provided" },
        })
        return
      end

      local pixels = img_lib.image_load(src, _ow, _oh, _oc)
      if pixels == nil then
        state.phase = "error"
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError",
                      message = "Failed to load: " .. tostring(src) },
        })
        return
      end

      state.pixels = pixels
      state.in_w   = _ow[0]
      state.in_h   = _oh[0]

      local want_w = tonumber(props.width)
      local want_h = tonumber(props.height)
      state.out_w, state.out_h = computeOutputSize(state.in_w, state.in_h, want_w, want_h)

      -- If no resize needed, skip straight to encode
      if state.out_w == state.in_w and state.out_h == state.in_h then
        state.phase = "encode"
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onProgress",
                      phase = "resize", progress = 1.0 },
        })
      else
        -- Start incremental resize
        local ctx = img_lib.image_resize_begin(pixels, state.in_w, state.in_h,
                                                state.out_w, state.out_h)
        if ctx == nil then
          state.phase = "error"
          pushEvent({
            type = "capability",
            payload = { targetId = nodeId, handler = "onError",
                        message = "Failed to allocate resize context" },
          })
          return
        end
        state.resizeCtx = ctx
        state.phase = "resize"

        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onProgress",
                      phase = "load", progress = 0.0 },
        })
      end
      return  -- yield: let next frame start resize
    end

    -- ── Phase: RESIZE (frame-distributed) ───────────────────────────
    if state.phase == "resize" then
      local ctx = state.resizeCtx
      local t0 = clock()
      local totalProcessed = 0

      -- Adaptive batch loop: keep processing rows until we hit the frame budget
      -- NOTE: FFI returns cdata int, which is always truthy in Lua. Compare == 0.
      while img_lib.image_resize_done(ctx) == 0 do
        local batch = state.rowsPerBatch
        local bt0 = clock()
        local done = img_lib.image_resize_rows(ctx, batch)
        local bt1 = clock()
        totalProcessed = totalProcessed + done

        -- Adapt batch size to stay within budget
        local batchTime = bt1 - bt0
        if batchTime > 0 then
          -- Target 80% of remaining budget per batch for headroom
          local remaining = budget - (bt1 - t0)
          if remaining <= 0 then break end
          local targetBatch = math.floor(done * (remaining * 0.8) / batchTime)
          state.rowsPerBatch = math.max(4, math.min(targetBatch, state.out_h))
        end

        -- Check total time spent this frame
        if (bt1 - t0) >= budget then break end
      end

      -- Report progress
      local progress = img_lib.image_resize_progress(ctx) / state.out_h
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onProgress",
                    phase = "resize", progress = progress },
      })

      -- Check if resize is complete
      if img_lib.image_resize_done(ctx) ~= 0 then
        state.phase = "encode"
      end
      return  -- yield
    end

    -- ── Phase: ENCODE (single frame) ────────────────────────────────
    if state.phase == "encode" then
      local output = props.output
      if not output or output == "" then
        state.phase = "error"
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError",
                      message = "No output path provided" },
        })
        return
      end

      -- Get the final pixel buffer
      local outPixels, outW, outH
      if state.resizeCtx ~= nil then
        outPixels = img_lib.image_resize_result(state.resizeCtx)
        outW = state.out_w
        outH = state.out_h
      else
        -- No resize was needed
        outPixels = state.pixels
        outW = state.in_w
        outH = state.in_h
      end

      -- Encode to file
      local fmt = (props.format or "jpeg"):lower()
      local quality = tonumber(props.quality) or 80
      local ok = 0

      if fmt == "jpeg" or fmt == "jpg" then
        ok = img_lib.image_write_jpg(output, outW, outH, outPixels, quality)
      elseif fmt == "png" then
        ok = img_lib.image_write_png(output, outW, outH, outPixels)
      elseif fmt == "bmp" then
        ok = img_lib.image_write_bmp(output, outW, outH, outPixels)
      else
        state.phase = "error"
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError",
                      message = "Unknown format: " .. tostring(fmt) },
        })
        return
      end

      -- Cleanup resize context (output buffer freed with it)
      if state.resizeCtx ~= nil then
        img_lib.image_resize_free(state.resizeCtx)
        state.resizeCtx = nil
      end
      -- Free source pixels
      if state.pixels ~= nil then
        img_lib.image_free(state.pixels)
        state.pixels = nil
      end

      if ok == 0 then
        state.phase = "error"
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError",
                      message = "Failed to write: " .. tostring(output) },
        })
        return
      end

      state.phase = "done"
      local sz = fileSize(output)
      pushEvent({
        type = "capability",
        payload = {
          targetId   = nodeId,
          handler    = "onComplete",
          outputPath = output,
          width      = outW,
          height     = outH,
          sizeBytes  = sz,
          format     = fmt,
        },
      })
    end
  end,
})
