--[[
  imaging/shader_cache.lua — Compile-once GLSL shader cache

  Compiles shaders on first use and returns cached instances.
  Handles compilation errors gracefully with fallback to CPU path.
]]

local ShaderCache = {}

local cache = {}

--- Get or compile a shader by name.
--- @param name string  Unique shader identifier
--- @param code string  GLSL shader source
--- @return love.Shader|nil  Compiled shader, or nil on failure
--- @return string|nil  Error message on failure
function ShaderCache.get(name, code)
  if cache[name] then return cache[name], nil end

  local ok, shaderOrErr = pcall(love.graphics.newShader, code)
  if ok then
    cache[name] = shaderOrErr
    return shaderOrErr, nil
  else
    io.write("[imaging:shader] Failed to compile '" .. name .. "': " .. tostring(shaderOrErr) .. "\n")
    io.flush()
    return nil, tostring(shaderOrErr)
  end
end

--- Check if a shader is cached.
--- @param name string
--- @return boolean
function ShaderCache.has(name)
  return cache[name] ~= nil
end

--- Release all cached shaders.
function ShaderCache.clear()
  for name, shader in pairs(cache) do
    shader:release()
  end
  cache = {}
end

return ShaderCache
