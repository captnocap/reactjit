--[[
  capabilities/imaging.lua — Image processing capability + RPC handlers

  Registers the Imaging capability for React declarative use, and
  exposes RPC handlers for the useImaging() hook.

  React usage:
    <Imaging src="photo.jpg" operations={[...]} onComplete={...} />

  RPC methods:
    imaging:apply     — run a pipeline on a source image
    imaging:list_ops  — list available operations
    imaging:blend_modes — list available blend modes
]]

local Capabilities = require("lua.capabilities")
local Imaging = require("lua.imaging")
local json = require("lua.json")

-- ============================================================================
-- Capability registration (for declarative <Imaging> component)
-- ============================================================================

Capabilities.register("Imaging", {
  visual = false,

  schema = {
    src        = { type = "string", desc = "Source image path" },
    operations = { type = "string", desc = "JSON-encoded operation pipeline array" },
    output     = { type = "string", desc = "Output file path (optional, for save)" },
  },

  events = { "onComplete", "onError", "onPreview" },

  create = function(nodeId, props)
    return {
      applied = false,
      lastOps = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
    -- Re-run pipeline when src or operations change
    if props.src ~= prev.src or props.operations ~= prev.operations then
      state.applied = false
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end
    if state.applied then return end
    if not props.src or props.src == "" then return end

    state.applied = true

    -- Parse operations
    local opsStr = props.operations or "[]"
    local ok, opsList = pcall(json.decode, opsStr)
    if not ok or type(opsList) ~= "table" then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = "Invalid operations JSON" },
      })
      return
    end

    -- Build pipeline
    local pOk, pipeline = pcall(Imaging.from, props.src)
    if not pOk then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = "Failed to load image: " .. tostring(pipeline) },
      })
      return
    end

    -- Queue operations
    for _, op in ipairs(opsList) do
      local name = op.op
      if name then
        local params = {}
        for k, v in pairs(op) do
          if k ~= "op" then params[k] = v end
        end
        pipeline:op(name, params)
      end
    end

    -- Execute
    local execOk, result = pcall(function() return pipeline:apply() end)
    if not execOk then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = "Pipeline failed: " .. tostring(result) },
      })
      return
    end

    -- Save if output path specified
    if props.output and props.output ~= "" then
      local saveOk, saveErr = pcall(Imaging.save, result, props.output)
      if not saveOk then
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError", message = "Save failed: " .. tostring(saveErr) },
        })
        return
      end
    end

    pushEvent({
      type = "capability",
      payload = {
        targetId = nodeId,
        handler = "onComplete",
        outputPath = props.output,
        width = result:getWidth(),
        height = result:getHeight(),
      },
    })
  end,

  destroy = function(nodeId, state)
    -- nothing to clean up (canvases are GC'd)
  end,
})

-- ============================================================================
-- RPC handlers (for hook-based API)
-- ============================================================================

-- These are registered in init.lua's RPC handler table.
-- We export them so init.lua can pick them up.

local handlers = {
  ["imaging:list_ops"] = function()
    return Imaging.listOps()
  end,

  ["imaging:blend_modes"] = function()
    return Imaging.blendModes and Imaging.blendModes() or {}
  end,
}

-- Return handlers for registration
return handlers
