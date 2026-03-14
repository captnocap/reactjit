--[[
  cart_reader.lua — Cartridge file reader for the inspector

  Reads files from absolute disk paths (dropped files live outside
  Love2D's VFS).  Handles manifest extraction from raw .json files
  and from directories containing manifest.json.

  Phase 2 will add: extraction from self-extracting binaries
  (find __ARCHIVE__ marker, decompress tar.gz, locate manifest.json).

  Usage:
    local reader = require("lua.cart_reader")
    local contents = reader.readFile("/path/to/manifest.json")
    local manifest = reader.readManifest("/path/to/manifest.json")
]]

local json = nil
local ok_json
ok_json, json = pcall(require, "lua.lib.json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then json = nil end

local manifestMod = require("lua.manifest")

local CartReader = {}

-- ---------------------------------------------------------------------------
-- File reading (absolute paths — outside Love2D VFS)
-- ---------------------------------------------------------------------------

--- Read a file from an absolute disk path.
--- @param absPath string  absolute file path
--- @return string|nil contents, string|nil error
function CartReader.readFile(absPath)
  local f, err = io.open(absPath, "r")
  if not f then
    return nil, "cannot open: " .. tostring(err)
  end
  local contents = f:read("*a")
  f:close()
  return contents, nil
end

--- Read file size without reading contents.
--- @param absPath string
--- @return number|nil  size in bytes
function CartReader.fileSize(absPath)
  local f = io.open(absPath, "r")
  if not f then return nil end
  local size = f:seek("end")
  f:close()
  return size
end

-- ---------------------------------------------------------------------------
-- Manifest extraction
-- ---------------------------------------------------------------------------

--- Load and parse a manifest from a dropped file path.
---
--- Accepts:
---   - Direct path to a manifest.json file
---   - Path to a directory containing manifest.json
---   - Path to a .love file (zip) containing manifest.json (future)
---   - Path to a self-extracting binary (future)
---
--- @param path string  absolute path
--- @return table|nil manifest, string|nil error
function CartReader.readManifest(path)
  if not json then
    return nil, "JSON library not available"
  end

  -- Check if the path is a directory
  -- (directories end with / or we can try to open path/manifest.json)
  local dirManifest = path .. "/manifest.json"
  local dirContents = CartReader.readFile(dirManifest)
  if dirContents then
    local ok, parsed = pcall(json.decode, dirContents)
    if ok and type(parsed) == "table" then
      return parsed, nil
    else
      return nil, "invalid JSON in " .. dirManifest .. ": " .. tostring(parsed)
    end
  end

  -- Try reading the path directly as a JSON file
  local contents, readErr = CartReader.readFile(path)
  if not contents then
    return nil, readErr
  end

  -- Try parsing as JSON directly (manifest.json dropped)
  local ok, parsed = pcall(json.decode, contents)
  if ok and type(parsed) == "table" then
    -- Validate it looks like a manifest
    if parsed.capabilities or parsed.name then
      return parsed, nil
    end
  end

  -- Not a JSON file — check for self-extracting binary
  -- Look for __ARCHIVE__ marker (Phase 2)
  if contents:find("__ARCHIVE__") then
    return nil, "self-extracting binary detected — archive extraction not yet implemented (Phase 2)"
  end

  return nil, "unrecognized file format — expected manifest.json or a cartridge binary"
end

-- ---------------------------------------------------------------------------
-- RPC handlers
-- ---------------------------------------------------------------------------

function CartReader.getHandlers()
  return {
    --- Read raw file contents from absolute path
    ["inspector:loadFile"] = function(args)
      if not args or not args.path then
        return { error = "path required" }
      end
      local contents, err = CartReader.readFile(args.path)
      if not contents then
        return { error = err }
      end
      return { contents = contents, size = #contents }
    end,

    --- Load and parse manifest from a dropped file
    ["inspector:loadManifest"] = function(args)
      if not args or not args.path then
        return { error = "path required" }
      end

      local manifest, err = CartReader.readManifest(args.path)
      if not manifest then
        return { error = err }
      end

      -- Validate
      local valid, validErrs = manifestMod.validate(manifest)

      return {
        manifest = manifest,
        valid = valid,
        errors = validErrs,
        path = args.path,
        size = CartReader.fileSize(args.path),
      }
    end,
  }
end

return CartReader
