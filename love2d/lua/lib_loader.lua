--[[
  lib_loader.lua -- Cross-platform shared library loading for LuaJIT FFI.

  All FFI library loads should go through this module so that bundled libs
  (in lib/) are found on every platform without per-call boilerplate.

  Usage:
    local loader = require("lua.lib_loader")
    local sdl = loader.load("SDL2")           -- tries bundled, then system
    local gl  = loader.opengl()               -- platform-correct OpenGL
    local ext = loader.ext()                  -- ".so" / ".dll" / ".dylib"
]]
local ffi = require("ffi")

local M = {}

-- ── Platform detection ──────────────────────────────────────────────────────

local OS   = ffi.os              -- "Windows", "OSX", "Linux"
local ARCH = ffi.arch            -- "x64", "arm64", "x86", etc.

function M.os()   return OS   end
function M.arch() return ARCH end

function M.ext()
  if OS == "Windows" then return ".dll"
  elseif OS == "OSX"  then return ".dylib"
  else                     return ".so"
  end
end

-- ── Library search ──────────────────────────────────────────────────────────

-- Working directory for the running process. On SDL2 target this is the
-- project root. On Love2D, love.filesystem.getSource() is more reliable.
local function cwd()
  if love and love.filesystem then
    return love.filesystem.getSource()
  end
  return "."
end

--[[
  load(name [, extra_paths])

  Tries to load a shared library by name. Search order:
    1. Bundled: <cwd>/lib/lib<name><ext>  (e.g. lib/libSDL2.so)
    2. Bundled: <cwd>/lib/<name><ext>     (e.g. lib/SDL2.dll — Windows convention)
    3. Any extra_paths provided by the caller
    4. Bare name: ffi.load("<name>")      (system search via ld.so / dyld / LoadLibrary)

  Returns the loaded library handle, or errors with a diagnostic message.
]]
function M.load(name, extra_paths)
  local ext = M.ext()
  local base = cwd()
  local candidates = {}

  -- Bundled paths (project-local lib/)
  candidates[#candidates + 1] = base .. "/lib/lib" .. name .. ext
  candidates[#candidates + 1] = base .. "/lib/" .. name .. ext

  -- Caller-provided extras
  if extra_paths then
    for _, p in ipairs(extra_paths) do
      candidates[#candidates + 1] = p
    end
  end

  -- System (bare name)
  candidates[#candidates + 1] = name

  -- Try each candidate
  local errors = {}
  for _, path in ipairs(candidates) do
    local ok, lib = pcall(ffi.load, path)
    if ok then return lib end
    errors[#errors + 1] = "  " .. path .. ": " .. tostring(lib)
  end

  error("[lib_loader] Could not load '" .. name .. "':\n" .. table.concat(errors, "\n"))
end

--[[
  try_load(name [, extra_paths])

  Same as load() but returns nil instead of erroring on failure.
]]
function M.try_load(name, extra_paths)
  local ok, result = pcall(M.load, name, extra_paths)
  if ok then return result end
  return nil
end

-- ── OpenGL ──────────────────────────────────────────────────────────────────

--[[
  opengl()

  Loads the platform-correct OpenGL library:
    Linux:   ffi.load("GL")
    macOS:   ffi.load("/System/Library/Frameworks/OpenGL.framework/OpenGL")
    Windows: ffi.load("opengl32")
]]
function M.opengl()
  if OS == "Windows" then
    return ffi.load("opengl32")
  elseif OS == "OSX" then
    return ffi.load("/System/Library/Frameworks/OpenGL.framework/OpenGL")
  else
    return ffi.load("GL")
  end
end

return M
