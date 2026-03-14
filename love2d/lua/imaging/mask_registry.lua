--[[
  imaging/mask_registry.lua -- In-memory mask handle store

  Shared between the imaging capability (imaging:selection_rasterize) and the
  apply_mask pipeline op so both can reference a mask canvas by string ID
  without touching the filesystem.
]]

local MaskRegistry = {}

local store   = {}
local counter = 0

--- Store a canvas and return a stable string handle ID.
--- The caller is responsible for NOT releasing the canvas -- the registry owns it.
--- @param canvas love.Canvas
--- @return string  Handle ID
function MaskRegistry.store(canvas)
  counter = counter + 1
  local id = "mask_" .. tostring(counter)
  store[id] = canvas
  return id
end

--- Retrieve a stored mask canvas by handle ID (nil if not found).
--- @param id string
--- @return love.Canvas|nil
function MaskRegistry.get(id)
  return store[id]
end

--- Release a mask canvas and remove it from the registry.
--- @param id string
function MaskRegistry.release(id)
  local canvas = store[id]
  if canvas and canvas.release then
    canvas:release()
  end
  store[id] = nil
end

--- Release all stored mask canvases (called on shutdown / test teardown).
function MaskRegistry.releaseAll()
  for _, canvas in pairs(store) do
    if canvas and canvas.release then canvas:release() end
  end
  store   = {}
  counter = 0
end

--- Return the number of masks currently stored (for diagnostics).
--- @return number
function MaskRegistry.count()
  local n = 0
  for _ in pairs(store) do n = n + 1 end
  return n
end

return MaskRegistry
