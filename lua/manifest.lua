--[[
  manifest.lua — Target-agnostic cartridge manifest loader

  Loads manifest.json from the filesystem at init time.  Works with Love2D
  VFS (love.filesystem.read) and raw Lua IO (io.open) for SDL2 and any
  future target.

  The manifest declares:
    - name, version — cartridge identity
    - capabilities   — what the cart needs (fed to permit.mint())
    - sources        — source file hashes for reproducibility
    - build          — commit, timestamp, toolchain, bundle hash
    - signature      — developer signature (Phase 3, nullable)

  Usage:
    local Manifest = require("lua.manifest")
    local manifest = Manifest.load(basePath)
    if manifest then
      local ok, errs = Manifest.validate(manifest)
      if ok then
        permit.mint(manifest.capabilities, audit)
      end
    end
]]

local json = nil
local ok_json
ok_json, json = pcall(require, "lua.lib.json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then json = nil end

local Manifest = {}

-- ---------------------------------------------------------------------------
-- File reading (target-agnostic)
-- ---------------------------------------------------------------------------

--- Read a file's contents.  Tries Love2D VFS first, falls back to raw IO.
--- @param path string  file path
--- @return string|nil  contents, or nil if not found
local function readFile(path)
  -- Try Love2D VFS first (works inside .love archives and fused binaries)
  -- Guard with getInfo — love.js (Emscripten) turns read-of-missing-file into
  -- a hard error on the canvas instead of returning nil.
  if love and love.filesystem then
    if love.filesystem.getInfo and not love.filesystem.getInfo(path) then
      -- file doesn't exist, skip
    elseif love.filesystem.read then
      local contents, err = love.filesystem.read(path)
      if contents then return contents end
    end
  end

  -- Fall back to raw IO (SDL2, LuaJIT standalone, etc.)
  local f = io.open(path, "r")
  if f then
    local contents = f:read("*a")
    f:close()
    return contents
  end

  return nil
end

-- ---------------------------------------------------------------------------
-- Loading
-- ---------------------------------------------------------------------------

--- Load manifest.json from a base path.
--- Tries multiple locations: basePath/manifest.json, then just "manifest.json".
---
--- @param basePath string|nil  directory containing the manifest (e.g. the lua/ dir parent)
--- @return table|nil  parsed manifest, or nil if not found/invalid
function Manifest.load(basePath)
  if not json then
    io.write("[MANIFEST] JSON library not available — cannot load manifest\n"); io.flush()
    return nil
  end

  local paths = {}
  if basePath and basePath ~= "" then
    -- basePath is typically the lua/ directory; manifest lives one level up
    local parent = basePath:match("^(.*[/\\])lua[/\\]?$") or basePath
    paths[#paths + 1] = parent .. "manifest.json"
    paths[#paths + 1] = basePath .. "manifest.json"
    paths[#paths + 1] = basePath .. "../manifest.json"
  end
  paths[#paths + 1] = "manifest.json"

  for _, path in ipairs(paths) do
    local contents = readFile(path)
    if contents then
      local ok, result = pcall(json.decode, contents)
      if ok and type(result) == "table" then
        io.write("[MANIFEST] Loaded from: " .. path .. "\n"); io.flush()
        return result
      else
        io.write("[MANIFEST] Failed to parse " .. path .. ": " .. tostring(result) .. "\n"); io.flush()
      end
    end
  end

  return nil
end

--- Parse a manifest from a raw JSON string.
--- @param jsonStr string  raw JSON
--- @return table|nil  parsed manifest, or nil on error
function Manifest.parse(jsonStr)
  if not json then return nil end
  local ok, result = pcall(json.decode, jsonStr)
  if ok and type(result) == "table" then
    return result
  end
  return nil
end

-- ---------------------------------------------------------------------------
-- Validation
-- ---------------------------------------------------------------------------

-- Valid capability categories and their expected types
local CAPABILITY_TYPES = {
  network    = { "table", "boolean" },   -- list of ports/hosts, or true/false
  filesystem = { "table", "boolean" },   -- { path = access }, or true/false
  clipboard  = { "boolean" },
  storage    = { "boolean" },
  ipc        = { "table", "boolean" },   -- list of peer IDs, or true/false
  gpu        = { "boolean" },
  process    = { "table", "boolean" },   -- list of executables, or true/false
  sysmon     = { "boolean" },
  browse     = { "boolean" },
}

--- Validate a manifest's structure.
--- Returns true if valid, or false + array of error strings.
---
--- @param manifest table  parsed manifest
--- @return boolean, string[]|nil
function Manifest.validate(manifest)
  local errors = {}

  -- Required top-level fields
  if type(manifest.name) ~= "string" or manifest.name == "" then
    errors[#errors + 1] = "missing or empty 'name' field"
  end

  if type(manifest.version) ~= "string" or manifest.version == "" then
    errors[#errors + 1] = "missing or empty 'version' field"
  end

  -- Capabilities block
  if manifest.capabilities == nil then
    errors[#errors + 1] = "missing 'capabilities' block"
  elseif type(manifest.capabilities) ~= "table" then
    errors[#errors + 1] = "'capabilities' must be an object"
  else
    for key, value in pairs(manifest.capabilities) do
      local allowed = CAPABILITY_TYPES[key]
      if not allowed then
        errors[#errors + 1] = "unknown capability: '" .. tostring(key) .. "'"
      else
        local typeOk = false
        local vtype = type(value)
        for _, t in ipairs(allowed) do
          if vtype == t then typeOk = true; break end
        end
        if not typeOk then
          errors[#errors + 1] = "capability '" .. key .. "' has invalid type '" .. vtype .. "' (expected: " .. table.concat(allowed, " or ") .. ")"
        end
      end
    end
  end

  -- Sources (optional but must be well-formed if present)
  if manifest.sources ~= nil then
    if type(manifest.sources) ~= "table" then
      errors[#errors + 1] = "'sources' must be an array"
    else
      for i, src in ipairs(manifest.sources) do
        if type(src) ~= "table" then
          errors[#errors + 1] = "sources[" .. i .. "] must be an object"
        elseif type(src.file) ~= "string" then
          errors[#errors + 1] = "sources[" .. i .. "].file must be a string"
        end
      end
    end
  end

  -- Build (optional but must be well-formed if present)
  if manifest.build ~= nil and type(manifest.build) ~= "table" then
    errors[#errors + 1] = "'build' must be an object"
  end

  if #errors > 0 then
    return false, errors
  end
  return true, nil
end

-- ---------------------------------------------------------------------------
-- Accessors
-- ---------------------------------------------------------------------------

--- Extract the capabilities block from a manifest.
--- Returns the capabilities table, or an empty table if missing.
--- @param manifest table
--- @return table
function Manifest.getCapabilities(manifest)
  if manifest and type(manifest.capabilities) == "table" then
    return manifest.capabilities
  end
  return {}
end

--- Get the manifest's identity (name + version).
--- @param manifest table
--- @return string name, string version
function Manifest.getIdentity(manifest)
  return manifest.name or "unknown", manifest.version or "0.0.0"
end

--- RPC handlers for React-side queries.
--- @return table  { method -> handler }
function Manifest.getHandlers()
  return {
    ["manifest:get"] = function()
      return Manifest._loaded
    end,
    ["manifest:validate"] = function(args)
      if not args or not args.json then return { ok = false, errors = { "no json provided" } } end
      local m = Manifest.parse(args.json)
      if not m then return { ok = false, errors = { "invalid JSON" } } end
      local ok, errs = Manifest.validate(m)
      return { ok = ok, errors = errs }
    end,
  }
end

-- Stash the loaded manifest for RPC queries
Manifest._loaded = nil

return Manifest
