-- Host FFI globals exposed to JSRT.
--
-- This module wires the evaluator to the same host-op surface used by the
-- renderer tests and, when provided, a live sink for `__hostFlush` batches.

local Values = require("framework.lua.jsrt.values")
local renderer_host = require("renderer.hostConfig")
local has_cjson, cjson = pcall(require, "cjson")
local click_latency_begin = rawget(_G, "__clickLatencyBegin")
local click_latency_stamp_dispatch = rawget(_G, "__clickLatencyStampDispatch")
local click_latency_stamp_handler = rawget(_G, "__clickLatencyStampHandler")
local click_latency_stamp_state_update = rawget(_G, "__clickLatencyStampStateUpdate")
local click_latency_stamp_flush = rawget(_G, "__clickLatencyStampFlush")
local click_latency_stamp_apply_done = rawget(_G, "__clickLatencyStampApplyDone")
local host_log = rawget(_G, "__hostLog")

local M = {}

local function define_native(scope, name, fn)
  scope:define(name, Values.newNativeFunction(fn))
end

local function maybe_store_dispatch(opts, fn)
  if type(opts.dispatchSlot) == "table" then
    opts.dispatchSlot.fn = fn
  end
  if type(opts.onRegisterDispatch) == "function" then
    opts.onRegisterDispatch(fn)
  end
end

local function decode_commands(payload)
  if type(payload) == "table" then
    return payload
  end
  if type(payload) ~= "string" or not has_cjson or not cjson then
    return nil
  end
  local ok, parsed = pcall(cjson.decode, payload)
  if ok then return parsed end
  return nil
end

function M.install(scope, opts)
  opts = opts or {}
  local emitter = opts.emitter
  local tree = opts.tree

  if emitter then
    define_native(scope, "__hostCreateText", function(args)
      return emitter:createText(args[1])
    end)

    define_native(scope, "__hostCreate", function(args)
      local id = emitter:createInstance(tostring(args[1] or ""), args[2] or {})
      return id
    end)

    define_native(scope, "__hostAppend", function(args)
      emitter:append(args[1], args[2])
      return Values.UNDEFINED
    end)

    define_native(scope, "__hostAppendToRoot", function(args)
      emitter:appendToRoot(args[1])
      return Values.UNDEFINED
    end)

    define_native(scope, "__hostUpdateText", function(args)
      emitter:emit({ op = "UPDATE_TEXT", id = args[1], text = tostring(args[2]) })
      return Values.UNDEFINED
    end)

    define_native(scope, "__hostUpdate", function(args)
      emitter:emit({
        op = "UPDATE",
        id = args[1],
        props = args[2] or {},
      })
      return Values.UNDEFINED
    end)

    define_native(scope, "__hostRemove", function(args)
      emitter:remove(args[1], args[2])
      return Values.UNDEFINED
    end)

    define_native(scope, "__hostRemoveFromRoot", function(args)
      emitter:removeFromRoot(args[1])
      return Values.UNDEFINED
    end)

    define_native(scope, "__hostInsertBefore", function(args)
      emitter:emit({
        op = "INSERT_BEFORE",
        parentId = args[1],
        childId = args[2],
        beforeId = args[3],
      })
      return Values.UNDEFINED
    end)

    define_native(scope, "__hostInsertBeforeRoot", function(args)
      emitter:emit({
        op = "INSERT_BEFORE_ROOT",
        childId = args[1],
        beforeId = args[2],
      })
      return Values.UNDEFINED
    end)
  end

  define_native(scope, "__registerDispatch", function(args)
    maybe_store_dispatch(opts, args[1])
    return Values.UNDEFINED
  end)

  define_native(scope, "__clickLatencyBegin", function(_args)
    if type(click_latency_begin) == "function" then
      return click_latency_begin()
    end
    return 0
  end)

  define_native(scope, "__clickLatencyStampDispatch", function(_args)
    if type(click_latency_stamp_dispatch) == "function" then
      return click_latency_stamp_dispatch()
    end
    return Values.UNDEFINED
  end)

  define_native(scope, "__clickLatencyStampHandler", function(_args)
    if type(click_latency_stamp_handler) == "function" then
      return click_latency_stamp_handler()
    end
    return Values.UNDEFINED
  end)

  define_native(scope, "__clickLatencyStampStateUpdate", function(_args)
    if type(click_latency_stamp_state_update) == "function" then
      return click_latency_stamp_state_update()
    end
    return Values.UNDEFINED
  end)

  define_native(scope, "__hostFlush", function(args)
    local payload = args[1]
    local commands = decode_commands(payload)
    if type(click_latency_stamp_flush) == "function" then
      click_latency_stamp_flush()
    end
    if commands and tree then
      renderer_host.applyCommands(tree, commands)
    elseif commands and type(opts.onFlush) == "function" then
      opts.onFlush(commands)
    elseif type(payload) == "table" and tree then
      renderer_host.applyCommands(tree, payload)
    elseif type(payload) == "table" and type(opts.onFlush) == "function" then
      opts.onFlush(payload)
    end
    if type(click_latency_stamp_apply_done) == "function" then
      click_latency_stamp_apply_done()
    end
    return Values.UNDEFINED
  end)
end

return M
