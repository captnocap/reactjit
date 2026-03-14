--[[
  quickjs_bridge.lua

  LuaJIT FFI bindings to QuickJS. Creates a JavaScript runtime embedded
  inside the Love2D process. Exposes host functions to JS:

    __hostFlush(jsonStr)       -- JS sends mutation commands (JSON string) to Lua
    __hostGetEvents()          -- JS polls for input events from Lua (JS array)
    __hostMeasureText(params)  -- JS queries text dimensions (JS object) from Love2D

  __hostFlush receives a JSON string from JS (JSON.stringify on the command array).
  This avoids a QuickJS GC race condition where large string properties get silently
  dropped during recursive FFI object property enumeration.

  Other host functions still use direct FFI traversal for small, predictable objects.

  Host functions use C trampolines (qjs_ffi_shim.c) because LuaJIT cannot
  create FFI callbacks that return structs by value (JSValue is a 16-byte struct).
  The trampolines call void-returning Lua callbacks with pointer-based signatures.
]]

local ffi = require("ffi")
local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then error("[reactjit] JSON library required but not found (tried 'json', 'lib.json', 'lua.json')") end
local Measure = require("lua.measure")

-- ============================================================================
-- QuickJS C API declarations
-- Subset needed for evaluation + host function exposure
-- Guard: ffi.cdef must only run once per process. On Lua HMR, this module
-- stays cached (init.lua skips eviction), but if it IS re-required, the
-- guard prevents LuaJIT from choking on duplicate type definitions.
-- ============================================================================

if not rawget(_G, "_qjs_cdef_done") then
_G._qjs_cdef_done = true
ffi.cdef[[
  typedef struct JSRuntime JSRuntime;
  typedef struct JSContext JSContext;

  /* JSValue is a 128-bit struct on 64-bit systems in newer QuickJS.
     For simplicity we treat it as opaque and use helper functions.
     In practice you'd match the exact ABI of your QuickJS build. */

  typedef struct { int64_t u; int64_t tag; } JSValue;

  JSRuntime *JS_NewRuntime(void);
  void JS_SetMaxStackSize(JSRuntime *rt, size_t stack_size);
  void JS_SetMemoryLimit(JSRuntime *rt, size_t limit);
  JSContext *JS_NewContext(JSRuntime *rt);
  void JS_FreeContext(JSContext *ctx);
  void JS_FreeRuntime(JSRuntime *rt);
  void JS_FreeValue(JSContext *ctx, JSValue val);
  JSValue JS_DupValue(JSContext *ctx, JSValue val);

  /* Evaluation */
  JSValue JS_Eval(JSContext *ctx, const char *input, size_t input_len,
                  const char *filename, int eval_flags);

  /* String conversion */
  const char *JS_ToCString(JSContext *ctx, JSValue val);
  void JS_FreeCString(JSContext *ctx, const char *ptr);
  JSValue JS_NewString(JSContext *ctx, const char *str);

  /* Object/property access */
  JSValue JS_GetGlobalObject(JSContext *ctx);
  JSValue JS_GetPropertyStr(JSContext *ctx, JSValue this_obj, const char *prop);
  int JS_SetPropertyStr(JSContext *ctx, JSValue this_obj, const char *prop, JSValue val);

  /* Type checking */
  int JS_IsException(JSValue val);
  int JS_IsUndefined(JSValue val);
  int JS_IsFunction(JSContext *ctx, JSValue val);
  JSValue JS_GetException(JSContext *ctx);

  /* Function calls */
  JSValue JS_Call(JSContext *ctx, JSValue func_obj, JSValue this_val,
                  int argc, JSValue *argv);

  /* Job queue (promises, async) */
  int JS_ExecutePendingJob(JSRuntime *rt, JSContext **pctx);

  /* Standard library init (console, setTimeout, etc.) */
  void js_std_init_handlers(JSRuntime *rt);
  void js_std_add_helpers(JSContext *ctx, int argc, char **argv);

  /* Array/object traversal (direct FFI value passing) */
  int JS_IsArray(JSValue val);
  JSValue JS_GetPropertyUint32(JSContext *ctx, JSValue this_obj, uint32_t idx);
  int JS_ToFloat64(JSContext *ctx, double *pres, JSValue val);
  int JS_ToBool(JSContext *ctx, JSValue val);
  int JS_ToInt32(JSContext *ctx, int32_t *pres, JSValue val);

  /* JS value construction */
  JSValue JS_NewObject(JSContext *ctx);
  JSValue JS_NewArray(JSContext *ctx);
  JSValue JS_NewFloat64(JSContext *ctx, double d);
  JSValue JS_NewBool(JSContext *ctx, int val);
  JSValue JS_NewInt32(JSContext *ctx, int32_t val);
  int JS_SetPropertyUint32(JSContext *ctx, JSValue this_obj, uint32_t idx, JSValue val);

  /* Property enumeration */
  typedef uint32_t JSAtom;
  typedef struct { int is_enumerable; JSAtom atom; } JSPropertyEnum;
  int JS_GetOwnPropertyNames(JSContext *ctx, JSPropertyEnum **ptab, uint32_t *plen, JSValue obj, int flags);
  const char *JS_AtomToCString(JSContext *ctx, JSAtom atom);
  void JS_FreeAtom(JSContext *ctx, JSAtom atom);
  void js_free(JSContext *ctx, void *ptr);

  /* ---- C trampoline API (qjs_ffi_shim.c) ---- */
  /* Lua callbacks use this signature (void return, pointer args) to avoid
     LuaJIT's inability to return structs from FFI callbacks. */
  typedef void (*HostCallback)(JSContext *ctx, int argc,
                               JSValue *argv, JSValue *ret);

  void qjs_set_host_flush(HostCallback cb);
  void qjs_set_host_events(HostCallback cb);
  void qjs_set_host_log(HostCallback cb);
  void qjs_set_host_measure(HostCallback cb);
  void qjs_set_host_report_error(HostCallback cb);
  void qjs_set_host_random(HostCallback cb);
  void qjs_register_host_functions(JSContext *ctx);
]]
end -- _qjs_cdef_done guard

local JS_EVAL_TYPE_GLOBAL = 0
local JS_EVAL_TYPE_MODULE = 1
local JS_EVAL_FLAG_STRICT = 8

-- QuickJS 64-bit JSValue tags (validated at init time)
local TAG_INT       = 0
local TAG_BOOL      = 1
local TAG_NULL      = 2
local TAG_UNDEFINED = 3
local TAG_FLOAT64   = 7
local TAG_OBJECT    = -1  -- arrays are objects too
local TAG_STRING    = -7

local JS_GPN_STRING_MASK = 1   -- enumerate string-named keys
local JS_GPN_ENUM_ONLY   = 16  -- enumerable only

-- ============================================================================
-- JSValue <-> Lua value converters (direct FFI, no JSON)
-- ============================================================================

-- Pre-allocated buffers for numeric conversions (avoid per-call allocation)
local _double_buf = ffi.new("double[1]")
local _int32_buf  = ffi.new("int32_t[1]")

--- Convert a QuickJS JSValue to a Lua value via direct FFI traversal.
--- @param ctx  JSContext pointer
--- @param qjs  FFI library handle
--- @param val  JSValue struct (NOT owned by us -- caller manages lifetime)
--- @param depth  recursion depth (default 0, max 32)
--- @return any  Lua value (string, number, boolean, table, or nil)
local function jsValueToLua(ctx, qjs, val, depth)
  depth = depth or 0
  if depth > 32 then
    print("[reactjit] jsValueToLua: max depth exceeded")
    return nil
  end

  local tag = tonumber(val.tag)

  if tag == TAG_STRING then
    local cstr = qjs.JS_ToCString(ctx, val)
    if cstr == nil then return nil end
    local s = ffi.string(cstr)
    qjs.JS_FreeCString(ctx, cstr)
    return s

  elseif tag == TAG_INT then
    if qjs.JS_ToInt32(ctx, _int32_buf, val) ~= 0 then return nil end
    return tonumber(_int32_buf[0])

  elseif tag == TAG_FLOAT64 then
    if qjs.JS_ToFloat64(ctx, _double_buf, val) ~= 0 then return nil end
    return tonumber(_double_buf[0])

  elseif tag == TAG_BOOL then
    return qjs.JS_ToBool(ctx, val) ~= 0

  elseif tag == TAG_NULL or tag == TAG_UNDEFINED then
    return nil

  elseif tag == TAG_OBJECT then
    -- Check if array
    if qjs.JS_IsArray(val) ~= 0 then
      local lengthVal = qjs.JS_GetPropertyStr(ctx, val, "length")
      local len = 0
      if qjs.JS_ToInt32(ctx, _int32_buf, lengthVal) == 0 then
        len = tonumber(_int32_buf[0])
      end
      qjs.JS_FreeValue(ctx, lengthVal)

      -- Phase 1: Pin all elements to prevent GC during conversion
      local elems = {}
      for i = 0, len - 1 do
        local elem = qjs.JS_GetPropertyUint32(ctx, val, i)
        elems[i + 1] = qjs.JS_DupValue(ctx, elem)
        qjs.JS_FreeValue(ctx, elem)
      end

      -- Phase 2: Convert pinned elements
      local arr = {}
      for i = 1, len do
        arr[i] = jsValueToLua(ctx, qjs, elems[i], depth + 1)
        qjs.JS_FreeValue(ctx, elems[i])
      end
      return arr
    else
      -- Object: enumerate own properties
      local ptab = ffi.new("JSPropertyEnum*[1]")
      local plen = ffi.new("uint32_t[1]")
      local flags = JS_GPN_STRING_MASK + JS_GPN_ENUM_ONLY

      if qjs.JS_GetOwnPropertyNames(ctx, ptab, plen, val, flags) ~= 0 then
        return {}
      end

      local count = tonumber(plen[0])

      -- Phase 1: Collect all keys and pin (JS_DupValue) all property values
      -- BEFORE converting any of them. This prevents GC from collecting
      -- large string values during the recursive conversion of other properties.
      local keys = {}
      local vals = {}
      for i = 0, count - 1 do
        local prop = ptab[0][i]
        local keyCstr = qjs.JS_AtomToCString(ctx, prop.atom)
        if keyCstr ~= nil then
          local key = ffi.string(keyCstr)
          qjs.JS_FreeCString(ctx, keyCstr)
          local propVal = qjs.JS_GetPropertyStr(ctx, val, key)
          -- Pin the value so GC cannot collect it during conversion
          local pinned = qjs.JS_DupValue(ctx, propVal)
          keys[#keys + 1] = key
          vals[#vals + 1] = pinned
          qjs.JS_FreeValue(ctx, propVal)
        end
        qjs.JS_FreeAtom(ctx, prop.atom)
      end

      -- Free the property names array
      qjs.js_free(ctx, ptab[0])

      -- Phase 2: Convert pinned values to Lua (safe from GC now)
      local obj = {}
      for i = 1, #keys do
        obj[keys[i]] = jsValueToLua(ctx, qjs, vals[i], depth + 1)
        qjs.JS_FreeValue(ctx, vals[i])
      end

      return obj
    end

  else
    -- Unknown tag
    print(string.format("[reactjit] jsValueToLua: unknown tag %d", tag))
    return nil
  end
end

--- Convert a Lua value to a QuickJS JSValue via direct FFI construction.
--- The returned JSValue is OWNED by the caller (must be freed or passed to
--- a function that takes ownership, like JS_SetPropertyStr).
--- @param ctx  JSContext pointer
--- @param qjs  FFI library handle
--- @param val  Lua value
--- @param depth  recursion depth (default 0, max 32)
--- @return JSValue
local function luaToJSValue(ctx, qjs, val, depth)
  depth = depth or 0
  if depth > 32 then
    print("[reactjit] luaToJSValue: max depth exceeded")
    return ffi.new("JSValue", {0, TAG_NULL})
  end

  local t = type(val)

  if t == "string" then
    return qjs.JS_NewString(ctx, val)

  elseif t == "number" then
    -- Use int32 for values that fit, float64 otherwise
    if val == math.floor(val) and val >= -2147483648 and val <= 2147483647 then
      return qjs.JS_NewInt32(ctx, val)
    else
      return qjs.JS_NewFloat64(ctx, val)
    end

  elseif t == "boolean" then
    return qjs.JS_NewBool(ctx, val and 1 or 0)

  elseif t == "nil" then
    return ffi.new("JSValue", {0, TAG_NULL})

  elseif t == "table" then
    -- Heuristic: array if val[1] ~= nil OR table is empty, object otherwise.
    -- Matches json.lua: empty tables become empty arrays.
    if val[1] ~= nil or next(val) == nil then
      -- Array mode
      local arr = qjs.JS_NewArray(ctx)
      local len = #val
      for i = 1, len do
        local child = luaToJSValue(ctx, qjs, val[i], depth + 1)
        -- SetPropertyUint32 takes ownership of child, do NOT free
        qjs.JS_SetPropertyUint32(ctx, arr, i - 1, child)
      end
      return arr
    else
      -- Object mode
      local obj = qjs.JS_NewObject(ctx)
      for k, v in pairs(val) do
        local child = luaToJSValue(ctx, qjs, v, depth + 1)
        -- SetPropertyStr takes ownership of child, do NOT free
        qjs.JS_SetPropertyStr(ctx, obj, tostring(k), child)
      end
      return obj
    end

  else
    -- Unsupported type (function, userdata, etc.)
    return ffi.new("JSValue", {0, TAG_NULL})
  end
end

--- Validate JSValue tag layout by creating known values and checking their tags.
--- Auto-detects tags rather than asserting, so it works across QuickJS builds.
local function validateTags(ctx, qjs)
  local str = qjs.JS_NewString(ctx, "test")
  local strTag = tonumber(str.tag)
  qjs.JS_FreeValue(ctx, str)

  local intVal = qjs.JS_Eval(ctx, "42", 2, "<tag>", 0)
  local intTag = tonumber(intVal.tag)
  qjs.JS_FreeValue(ctx, intVal)

  local boolVal = qjs.JS_Eval(ctx, "true", 4, "<tag>", 0)
  local boolTag = tonumber(boolVal.tag)
  qjs.JS_FreeValue(ctx, boolVal)

  local nullVal = qjs.JS_Eval(ctx, "null", 4, "<tag>", 0)
  local nullTag = tonumber(nullVal.tag)
  qjs.JS_FreeValue(ctx, nullVal)

  local floatVal = qjs.JS_Eval(ctx, "3.14", 4, "<tag>", 0)
  local floatTag = tonumber(floatVal.tag)
  qjs.JS_FreeValue(ctx, floatVal)

  local objVal = qjs.JS_Eval(ctx, "({})", 4, "<tag>", 0)
  local objTag = tonumber(objVal.tag)
  qjs.JS_FreeValue(ctx, objVal)

  -- Update constants if they differ from expected
  if strTag ~= TAG_STRING or intTag ~= TAG_INT or boolTag ~= TAG_BOOL
     or nullTag ~= TAG_NULL or floatTag ~= TAG_FLOAT64 or objTag ~= TAG_OBJECT then
    TAG_STRING = strTag
    TAG_INT = intTag
    TAG_BOOL = boolTag
    TAG_NULL = nullTag
    TAG_FLOAT64 = floatTag
    TAG_OBJECT = objTag
  end
end

-- ============================================================================
-- Bridge object
-- ============================================================================

local Bridge = {}
Bridge.__index = Bridge
local _quarantine = nil  -- set via Bridge.setQuarantine() from init.lua

function Bridge.new(libpath)
  libpath = libpath or "lib/libquickjs"

  -- ffi.load uses dlopen which resolves relative to process CWD, not Love2D's
  -- game directory. Resolve to an absolute path using love.filesystem.getSource().
  local isAbsolute = libpath:sub(1, 1) == "/" or libpath:match("^%a:\\")
  if not isAbsolute and love and love.filesystem and love.filesystem.getSource then
    local source = love.filesystem.getSource()
    if source then
      -- getSource() returns a file path (fused binary or .love file), not a
      -- directory. Strip the filename to get the containing directory.
      -- Use [/\\] to handle both Unix and Windows path separators.
      local isFused = love.filesystem.isFused and love.filesystem.isFused()
      local isLoveFile = source:match("%.love$")
      if isFused or isLoveFile then
        source = source:match("(.+)[/\\][^/\\]+$") or source
      end
      libpath = source .. "/" .. libpath
    end
  end

  -- Append the correct extension for the platform if not already present.
  -- ffi.load doesn't auto-add extensions when the path contains a slash.
  if not libpath:match("%.so") and not libpath:match("%.dylib") and not libpath:match("%.dll") then
    local os = love and love.system and love.system.getOS()
    if os == "Windows" then
      libpath = libpath .. ".dll"
    elseif os == "OS X" then
      libpath = libpath .. ".dylib"
    else
      libpath = libpath .. ".so"
    end
  end

  local ok, qjs = pcall(ffi.load, libpath)
  if not ok then
    error("[bridge_quickjs] Cannot load libquickjs from " .. libpath .. " — run `make setup` to build it.\n" .. tostring(qjs))
  end

  local self = setmetatable({
    qjs = qjs,
    rt = nil,
    ctx = nil,
    commandBuffer = {},
    eventQueue = {},
    useDirectFFI = true,  -- direct FFI value passing (fallback to JSON on error)
    _callbacks = {},  -- prevent GC of FFI callbacks
  }, Bridge)

  -- Create runtime with reasonable limits for game UI
  self.rt = qjs.JS_NewRuntime()
  qjs.JS_SetMaxStackSize(self.rt, 1024 * 1024)      -- 1MB stack
  qjs.JS_SetMemoryLimit(self.rt, 64 * 1024 * 1024)   -- 64MB heap

  self.ctx = qjs.JS_NewContext(self.rt)

  -- Initialize standard handlers (gives us console.log, setTimeout, etc.)
  -- Note: js_std_add_helpers may not exist in all QuickJS builds.
  -- If using a minimal build, you'll need to polyfill setTimeout/console.
  pcall(function()
    qjs.js_std_init_handlers(self.rt)
    qjs.js_std_add_helpers(self.ctx, 0, nil)
  end)

  -- Validate JSValue tag layout for this QuickJS build
  validateTags(self.ctx, qjs)

  -- Expose host functions via C trampolines
  -- (LuaJIT can't create callbacks returning JSValue structs, so the C shim
  --  provides trampoline functions that call these void-returning Lua callbacks)
  self:_setupHostFunctions()

  -- Polyfill basics if std helpers aren't available
  self:eval([[
    if (typeof console === 'undefined') {
      globalThis.console = {};
    }
    if (typeof console.log !== 'function') {
      console.log = function() { __hostLog(Array.from(arguments).join(' ')); };
    }
    if (typeof console.warn !== 'function') {
      console.warn = function() { __hostLog('[WARN] ' + Array.from(arguments).join(' ')); };
    }
    if (typeof console.error !== 'function') {
      console.error = function() {
        var args = Array.from(arguments);
        // If the first or second arg is an Error, report it with stack trace
        for (var i = 0; i < args.length; i++) {
          if (args[i] instanceof Error) {
            if (typeof __hostReportError === 'function') {
              __hostReportError({
                name: args[i].name || 'Error',
                message: args[i].message || String(args[i]),
                stack: args[i].stack || '',
                context: 'console.error'
              });
            }
            break;
          }
        }
        __hostLog('[ERROR] ' + args.join(' '));
      };
    }
    if (typeof setTimeout === 'undefined') {
      // QuickJS doesn't have timers by default -- we approximate with a job queue
      const _timers = [];
      let _timerId = 0;
      globalThis.setTimeout = function(fn, ms) {
        const id = ++_timerId;
        _timers.push({ id, fn, at: Date.now() + (ms || 0) });
        return id;
      };
      globalThis.clearTimeout = function(id) {
        const idx = _timers.findIndex(t => t.id === id);
        if (idx !== -1) _timers.splice(idx, 1);
      };
      globalThis.setInterval = function(fn, ms) {
        const id = ++_timerId;
        function tick() {
          fn();
          const t = _timers.find(t => t.id === id);
          if (t) t.at = Date.now() + ms;
        }
        _timers.push({ id, fn: tick, at: Date.now() + ms, interval: true });
        return id;
      };
      globalThis.clearInterval = globalThis.clearTimeout;
      // Tick function called from Lua
      globalThis.__tickTimers = function() {
        const now = Date.now();
        const ready = _timers.filter(t => t.at <= now);
        for (const t of ready) {
          try {
            t.fn();
          } catch (e) {
            if (typeof globalThis.__hostReportError === 'function') {
              globalThis.__hostReportError({
                name: e && e.name || 'Error',
                message: e && e.message || String(e),
                stack: e && e.stack || '',
                context: 'timer callback'
              });
            }
          }
          if (!t.interval) {
            const idx = _timers.indexOf(t);
            if (idx !== -1) _timers.splice(idx, 1);
          }
        }
      };
    }

    // ---- crypto.getRandomValues() polyfill ----
    // Uses __hostRandomBytes to read /dev/urandom via Lua (synchronous call)
    if (typeof globalThis.crypto === 'undefined') {
      globalThis.crypto = {};
    }
    if (typeof globalThis.crypto.getRandomValues !== 'function') {
      globalThis.crypto.getRandomValues = function(arr) {
        var bytes = __hostRandomBytes(arr.length);
        for (var i = 0; i < arr.length; i++) arr[i] = bytes[i];
        return arr;
      };
    }

    // ---- TextEncoder/TextDecoder polyfill ----
    if (typeof globalThis.TextEncoder === 'undefined') {
      globalThis.TextEncoder = function() {};
      globalThis.TextEncoder.prototype.encode = function(str) {
        var arr = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i) & 0xFF;
        return arr;
      };
    }
    if (typeof globalThis.TextDecoder === 'undefined') {
      globalThis.TextDecoder = function() {};
      globalThis.TextDecoder.prototype.decode = function(arr) {
        var s = '';
        for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
        return s;
      };
    }

    // Override queueMicrotask to use our timer queue instead of QuickJS's
    // internal Promise job queue. React's scheduler uses queueMicrotask
    // which creates an infinite microtask chain that blocks JS_Eval return.
    globalThis.queueMicrotask = function(fn) {
      globalThis.setTimeout(fn, 0);
    };

    // ---- fetch() polyfill ----
    // Routes HTTP URLs to Lua's love.thread + LuaSocket workers,
    // local file paths to love.filesystem.read(). Both resolve as Promises.
    //
    // ---- fetchStream() polyfill ----
    // Same transport but streams response chunks via callbacks instead of
    // buffering the full body. Used by @reactjit/ai for SSE streaming.
    (function() {
      var _fetchId = 0;
      var _fetchCallbacks = {};   // id -> { resolve, reject }
      var _streamCallbacks = {};  // id -> { onChunk, onDone, onError }

      // Called by Lua when an HTTP/file response arrives
      globalThis.__handleHttpResponse = function(id, response) {
        var cb = _fetchCallbacks[id];
        if (!cb) return;
        delete _fetchCallbacks[id];

        if (response.error) {
          cb.reject(new TypeError('fetch failed: ' + response.error));
          return;
        }

        var status = response.status || 0;
        var headers = response.headers || {};
        var body = response.body || '';

        // Build a Response-like object
        var res = {
          ok: status >= 200 && status < 300,
          status: status,
          statusText: '',
          headers: headers,
          url: response.url || '',
          // body is already fully buffered — no streaming
          text: function() { return Promise.resolve(body); },
          json: function() {
            return new Promise(function(resolve, reject) {
              try { resolve(JSON.parse(body)); }
              catch (e) { reject(e); }
            });
          },
          blob: function() { return Promise.resolve(body); },
          arrayBuffer: function() { return Promise.resolve(body); },
        };

        cb.resolve(res);
      };

      // Called by Lua when a streaming chunk arrives
      globalThis.__handleHttpStreamChunk = function(id, data) {
        var cb = _streamCallbacks[id];
        if (cb && cb.onChunk) cb.onChunk(data);
      };

      // Called by Lua when a stream completes
      globalThis.__handleHttpStreamDone = function(id, status, headers) {
        var cb = _streamCallbacks[id];
        if (!cb) return;
        delete _streamCallbacks[id];
        if (cb.onDone) cb.onDone(status, headers);
      };

      // Called by Lua when a stream errors
      globalThis.__handleHttpStreamError = function(id, error) {
        var cb = _streamCallbacks[id];
        if (!cb) return;
        delete _streamCallbacks[id];
        if (cb.onError) cb.onError(error);
      };

      globalThis.fetch = function(url, init) {
        init = init || {};
        var id = ++_fetchId;

        return new Promise(function(resolve, reject) {
          _fetchCallbacks[id] = { resolve: resolve, reject: reject };

          var headers = {};
          if (init.headers) {
            if (typeof init.headers.forEach === 'function') {
              init.headers.forEach(function(v, k) { headers[k] = v; });
            } else {
              var keys = Object.keys(init.headers);
              for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                headers[k] = init.headers[k];
              }
            }
          }

          __hostFlush(JSON.stringify([{
            type: 'http:request',
            payload: {
              id: id,
              url: String(url),
              method: (init.method || 'GET').toUpperCase(),
              headers: headers,
              body: init.body ? String(init.body) : '',
              proxy: init.proxy ? String(init.proxy) : '',
            }
          }]));
        });
      };

      // Streaming fetch: sends chunks via callbacks instead of buffering.
      // Returns the stream ID (can be used to identify or cancel the stream).
      globalThis.fetchStream = function(url, init, onChunk, onDone, onError) {
        init = init || {};
        var id = ++_fetchId;
        _streamCallbacks[id] = { onChunk: onChunk, onDone: onDone, onError: onError };

        var headers = {};
        if (init.headers) {
          if (typeof init.headers.forEach === 'function') {
            init.headers.forEach(function(v, k) { headers[k] = v; });
          } else {
            var keys = Object.keys(init.headers);
            for (var i = 0; i < keys.length; i++) {
              var k = keys[i];
              headers[k] = init.headers[k];
            }
          }
        }

        __hostFlush(JSON.stringify([{
          type: 'http:stream',
          payload: {
            id: id,
            url: String(url),
            method: (init.method || 'POST').toUpperCase(),
            headers: headers,
            body: init.body ? String(init.body) : '',
            proxy: init.proxy ? String(init.proxy) : '',
          }
        }]));

        return id;
      };
    })();

    // ---- Browse session polyfill ----
    // Sends commands to a running stealth browse session (Firefox) via TCP.
    // Commands are routed through Lua's browse.lua worker thread.
    // Returns a Promise that resolves with the command result.
    (function() {
      var _browseId = 0;
      var _browseCallbacks = {};  // id -> { resolve, reject }

      // Called by Lua when a browse response arrives
      globalThis.__handleBrowseResponse = function(resp) {
        var cb = _browseCallbacks[resp.id];
        if (!cb) return;
        delete _browseCallbacks[resp.id];
        if (resp.error) {
          cb.reject(new Error(resp.error));
        } else {
          cb.resolve(resp.result);
        }
      };

      // Send a command to the browse session.
      // cmd: { cmd: "navigate", url: "..." } etc.
      // options: { host, port } (optional, defaults to 127.0.0.1:7331)
      globalThis.browseRequest = function(cmd, options) {
        options = options || {};
        var id = ++_browseId;

        return new Promise(function(resolve, reject) {
          _browseCallbacks[id] = { resolve: resolve, reject: reject };

          __hostFlush(JSON.stringify([{
            type: 'browse:request',
            payload: {
              id: id,
              cmd: cmd,
              host: options.host || '127.0.0.1',
              port: options.port || 7331,
            }
          }]));
        });
      };
    })();

    // ---- WebSocket polyfill ----
    // Mimics the browser WebSocket API. Sends ws:connect/ws:send/ws:close
    // commands via __hostFlush. Receives ws:open/ws:message/ws:error/ws:close
    // events from Lua via __handleWsEvent.
    (function() {
      var _wsId = 0;
      var _wsInstances = {};  // id -> WebSocket instance

      // Called by Lua when a WebSocket event arrives
      globalThis.__handleWsEvent = function(event) {
        var ws = _wsInstances[event.id];
        if (!ws) return;

        if (event.type === 'ws:open') {
          ws.readyState = 1;  // OPEN
          if (typeof ws.onopen === 'function') ws.onopen({ type: 'open' });
        } else if (event.type === 'ws:message') {
          if (typeof ws.onmessage === 'function') {
            ws.onmessage({ type: 'message', data: event.data || '' });
          }
        } else if (event.type === 'ws:error') {
          if (typeof ws.onerror === 'function') {
            ws.onerror({ type: 'error', message: event.error || '' });
          }
        } else if (event.type === 'ws:close') {
          ws.readyState = 3;  // CLOSED
          delete _wsInstances[event.id];
          if (typeof ws.onclose === 'function') {
            ws.onclose({ type: 'close', code: event.code || 1005, reason: event.reason || '' });
          }
        }
      };

      globalThis.WebSocket = function(url) {
        var id = ++_wsId;
        var ws = {
          url: url,
          readyState: 0,  // CONNECTING
          _id: id,
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
          send: function(data) {
            if (ws.readyState !== 1) return;
            __hostFlush(JSON.stringify([{
              type: 'ws:send',
              payload: { id: id, data: String(data) }
            }]));
          },
          close: function(code, reason) {
            ws.readyState = 2;  // CLOSING
            __hostFlush(JSON.stringify([{
              type: 'ws:close',
              payload: { id: id, code: code || 1000, reason: reason || '' }
            }]));
          },
        };

        // Constants
        ws.CONNECTING = 0;
        ws.OPEN = 1;
        ws.CLOSING = 2;
        ws.CLOSED = 3;

        _wsInstances[id] = ws;

        // Send connect command
        __hostFlush(JSON.stringify([{
          type: 'ws:connect',
          payload: { id: id, url: String(url) }
        }]));

        return ws;
      };
      globalThis.WebSocket.CONNECTING = 0;
      globalThis.WebSocket.OPEN = 1;
      globalThis.WebSocket.CLOSING = 2;
      globalThis.WebSocket.CLOSED = 3;

      // ---- WebSocket Server API ----
      // Allows hosting a WebSocket server for P2P connections.
      // Server events arrive via __handleWsPeerEvent.

      var _serverListeners = {};  // serverId -> { onconnect, onmessage, ondisconnect, onready, onerror }

      globalThis.__handleWsPeerEvent = function(event) {
        var listeners = _serverListeners[event.serverId];
        if (!listeners) return;

        if (event.type === 'ws:server:ready') {
          if (typeof listeners.onready === 'function') listeners.onready(event);
        } else if (event.type === 'ws:server:error') {
          if (typeof listeners.onerror === 'function') listeners.onerror(event);
        } else if (event.type === 'ws:peer:connect') {
          if (typeof listeners.onconnect === 'function') listeners.onconnect(event.clientId);
        } else if (event.type === 'ws:peer:message') {
          if (typeof listeners.onmessage === 'function') listeners.onmessage(event.clientId, event.data);
        } else if (event.type === 'ws:peer:disconnect') {
          if (typeof listeners.ondisconnect === 'function') listeners.ondisconnect(event.clientId, event.code, event.reason);
        }
      };

      // globalThis.__wsListen(serverId, port, callbacks)
      globalThis.__wsListen = function(serverId, port, callbacks) {
        _serverListeners[serverId] = callbacks || {};
        __hostFlush(JSON.stringify([{
          type: 'ws:listen',
          payload: { serverId: String(serverId), port: Number(port) }
        }]));
      };

      // globalThis.__wsBroadcast(serverId, data)
      globalThis.__wsBroadcast = function(serverId, data) {
        __hostFlush(JSON.stringify([{
          type: 'ws:broadcast',
          payload: { serverId: String(serverId), data: String(data) }
        }]));
      };

      // globalThis.__wsSendToClient(serverId, clientId, data)
      globalThis.__wsSendToClient = function(serverId, clientId, data) {
        __hostFlush(JSON.stringify([{
          type: 'ws:peer:send',
          payload: { serverId: String(serverId), clientId: Number(clientId), data: String(data) }
        }]));
      };

      // globalThis.__wsStopServer(serverId)
      globalThis.__wsStopServer = function(serverId) {
        delete _serverListeners[serverId];
        __hostFlush(JSON.stringify([{
          type: 'ws:server:stop',
          payload: { serverId: String(serverId) }
        }]));
      };
    })();
  ]], "<polyfills>")

  return self
end

-- ============================================================================
-- Host functions via C trampolines
--
-- Each host function is a void-returning Lua callback registered via the C shim.
-- Signature: void callback(JSContext *ctx, int argc, JSValue *argv, JSValue *ret)
-- The C trampoline calls this, then returns *ret to QuickJS.
-- ============================================================================

function Bridge:_setupHostFunctions()
  local selfRef = self
  local qjs = self.qjs

  -- __hostFlush: JS sends mutation commands as a JSON string to Lua.
  -- The JS side calls JSON.stringify() on the command array before sending,
  -- so we receive a single string and decode it here. This bypasses the
  -- QuickJS GC race condition that silently drops large string properties
  -- during recursive FFI object traversal.
  --
  -- Track recent flushes for crash diagnostics.
  -- Ring buffer of last 20 flush summaries, written to disk when budget exceeded.
  -- Crisis data written via FFI direct write every 500 flushes (survives SIGKILL).
  -- At 1M (budget), write crash error data. Watchdog merges crisis file on kill.
  local FLUSH_BUDGET = 1000000
  local SEIZURE_THRESHOLD = 10  -- flushes per tick that trigger aggressive writes
  local flushLog = {}       -- ring buffer of { count, ops, timestamp }
  local flushLogIdx = 0
  local flushLogMax = 20
  local flushCrashWritten = false
  local flushCallCount = 0
  local tickFlushCount = 0  -- flushes in current tick (reset by init.lua before tick())
  local tmpDir = os.getenv("TMPDIR") or os.getenv("TEMP") or os.getenv("TMP") or "/tmp"

  -- Crisis analysis: tracks WHO is flooding the command buffer.
  -- Always active from the first flush — overhead is negligible (a few table increments).
  -- Data is written to disk periodically by init.lua (flight recorder pattern).
  -- When the watchdog kills, the last checkpoint is already on disk.
  --
  -- Additionally: during a seizure, __hostFlush uses FFI direct write() syscalls
  -- (bypassing stdio buffering) to push the latest crisis data to disk every 500
  -- flushes. This catches the exact component that caused the seizure.
  local crisisOps = {}        -- op name -> count  (CREATE, UPDATE, REMOVE, etc.)
  local crisisTypes = {}      -- node type -> count (View, Text, __TEXT__, CodeBlock, etc.)
  local crisisComponents = {} -- debugName -> count (which React component is creating/updating)
  local nodeDebugNames = {}   -- nodeId -> debugName (lookup for UPDATE attribution)

  -- Expose crisis tables on self so init.lua can read them each frame
  selfRef._crisisOps = crisisOps
  selfRef._crisisTypes = crisisTypes
  selfRef._crisisComponents = crisisComponents
  selfRef._crisisFlushCount = 0

  -- Reset crisis tables (called by init.lua for rolling window)
  function selfRef:resetCrisis()
    for k in pairs(crisisOps) do crisisOps[k] = nil end
    for k in pairs(crisisTypes) do crisisTypes[k] = nil end
    for k in pairs(crisisComponents) do crisisComponents[k] = nil end
    selfRef._crisisFlushCount = 0
  end

  -- Reset per-tick flush counter (called by init.lua BEFORE bridge:tick())
  function selfRef:resetTickFlush()
    tickFlushCount = 0
  end

  -- FFI direct write: bypasses stdio buffering so data reaches disk even
  -- when the process is about to be SIGKILL'd. Previous attempts using
  -- io.open/io.write failed because stdio buffers were never flushed.
  -- Uses creat() instead of open() to avoid variadic arg issues in LuaJIT FFI.
  pcall(ffi.cdef, "int creat(const char *pathname, int mode);")
  pcall(ffi.cdef, "long write(int fd, const void *buf, unsigned long count);")
  pcall(ffi.cdef, "int close(int fd);")
  local crisisPath = tmpDir .. "/reactjit_crisis.lua"
  local crisisPathC = ffi.new("char[?]", #crisisPath + 1, crisisPath)

  local function directWriteCrisis()
    if not next(crisisOps) then return end

    -- Build crisis text in-memory
    local lines = {}
    lines[#lines + 1] = "--- Op Breakdown ---"
    local opKeys = {}
    for k in pairs(crisisOps) do opKeys[#opKeys + 1] = k end
    table.sort(opKeys)
    for _, k in ipairs(opKeys) do
      lines[#lines + 1] = string.format("  %-20s %d", k, crisisOps[k])
    end
    if next(crisisTypes) then
      lines[#lines + 1] = ""
      lines[#lines + 1] = "--- Node Types Created ---"
      local typeList = {}
      for k, v in pairs(crisisTypes) do typeList[#typeList + 1] = { name = k, count = v } end
      table.sort(typeList, function(a, b) return a.count > b.count end)
      for i = 1, math.min(15, #typeList) do
        lines[#lines + 1] = string.format("  %-20s %d", typeList[i].name, typeList[i].count)
      end
    end
    if next(crisisComponents) then
      lines[#lines + 1] = ""
      lines[#lines + 1] = "--- Components (creates + updates) ---"
      local compList = {}
      for k, v in pairs(crisisComponents) do compList[#compList + 1] = { name = k, count = v } end
      table.sort(compList, function(a, b) return a.count > b.count end)
      for i = 1, math.min(15, #compList) do
        lines[#lines + 1] = string.format("  %-20s %d", compList[i].name, compList[i].count)
      end
    end
    local creates = (crisisOps["CREATE"] or 0) + (crisisOps["CREATE_TEXT"] or 0)
    local removes = (crisisOps["REMOVE"] or 0) + (crisisOps["REMOVE_FROM_ROOT"] or 0)
    if creates > 0 then
      lines[#lines + 1] = ""
      if removes == 0 then
        lines[#lines + 1] = string.format("LEAK CONFIRMED: %d creates, 0 removes", creates)
      else
        lines[#lines + 1] = string.format("Create/Remove ratio: %d / %d (%.1fx)", creates, removes, creates / removes)
      end
    end
    local text = table.concat(lines, "\n")

    -- Write using raw syscalls — survives SIGKILL
    -- creat() = open(O_CREAT|O_WRONLY|O_TRUNC), mode 0644
    -- Cast Lua string to const char* — LuaJIT auto-converts for const char*
    -- but NOT for const void* (write's actual signature).
    local content = string.format("return {\n  crisisAnalysis = %q,\n}\n", text)
    local buf = ffi.cast("const char *", content)
    local fd = ffi.C.creat(crisisPathC, 420)
    if fd >= 0 then
      ffi.C.write(fd, buf, #content)
      ffi.C.close(fd)
    end
  end

  -- Expose for init.lua flight recorder
  function selfRef:_directWriteCrisis()
    directWriteCrisis()
  end

  local flushCb = ffi.cast("HostCallback", function(ctx, argc, argv, ret)
    if argc < 1 then return end

    -- argv[0] is a JS string (JSON-encoded command array)
    local cstr = qjs.JS_ToCString(ctx, argv[0])
    if cstr ~= nil then
      local jsonStr = ffi.string(cstr)
      qjs.JS_FreeCString(ctx, cstr)

      local ok, commands = pcall(json.decode, jsonStr)
      if ok and type(commands) == "table" then
        -- Log this flush to the ring buffer
        local ops = {}
        for i = 1, math.min(5, #commands) do
          ops[i] = (commands[i].op or "?") .. ":" .. tostring(commands[i].id or "?")
        end
        flushLogIdx = (flushLogIdx % flushLogMax) + 1
        flushLog[flushLogIdx] = {
          n = #commands,
          buf = #selfRef.commandBuffer,
          ops = table.concat(ops, ", "),
        }

        for _, cmd in ipairs(commands) do
          selfRef.commandBuffer[#selfRef.commandBuffer + 1] = cmd
        end

        -- Track per-command breakdown (always active — negligible overhead)
        for _, cmd in ipairs(commands) do
          local op = cmd.op or "?"
          crisisOps[op] = (crisisOps[op] or 0) + 1
          if op == "CREATE" then
            local t = cmd.type or "?"
            crisisTypes[t] = (crisisTypes[t] or 0) + 1
            local dn = cmd.debugName or cmd.type or "?"
            crisisComponents[dn] = (crisisComponents[dn] or 0) + 1
            -- Remember node → component mapping for UPDATE attribution
            if cmd.id then nodeDebugNames[cmd.id] = dn end
          elseif op == "CREATE_TEXT" then
            crisisTypes["__TEXT__"] = (crisisTypes["__TEXT__"] or 0) + 1
          elseif op == "UPDATE" then
            -- Attribute UPDATE to the component that created this node
            local dn = cmd.id and nodeDebugNames[cmd.id]
            if dn then
              crisisComponents[dn] = (crisisComponents[dn] or 0) + 1
            end
          end
        end

        flushCallCount = flushCallCount + 1
        tickFlushCount = tickFlushCount + 1
        selfRef._crisisFlushCount = flushCallCount

        -- Seizure detection: normal operation = 1-2 flushes per tick.
        -- If we exceed SEIZURE_THRESHOLD, this tick is stuck in an infinite
        -- commit loop. Write crisis data on EVERY subsequent flush via FFI
        -- direct write (bypasses stdio buffering — survives SIGKILL).
        if tickFlushCount > SEIZURE_THRESHOLD then
          directWriteCrisis()
        end

        -- Once over budget, write crash file to disk and stop appending.
        -- The file persists when the watchdog kills us.
        if #selfRef.commandBuffer > FLUSH_BUDGET and not flushCrashWritten then
          flushCrashWritten = true
          local luaMem = collectgarbage("count") / 1024
          -- Dump the flush ring buffer as trail text
          local trail = {}
          for i = 1, flushLogMax do
            local idx = ((flushLogIdx - i) % flushLogMax) + 1
            local entry = flushLog[idx]
            if entry then
              trail[#trail + 1] = string.format("flush #%d: %d cmds (buf=%d) [%s]", flushLogMax - i + 1, entry.n, entry.buf, entry.ops)
            end
          end

          -- Final crisis write via FFI (belt + suspenders)
          directWriteCrisis()

          -- Write as a Lua table literal — the crash reporter just load()s it
          local f = io.open(tmpDir .. "/reactjit_crash.lua", "w")
          if f then
            f:write("return {\n")
            f:write(string.format("  error = %q,\n", "[BUDGET] " .. tostring(#selfRef.commandBuffer) .. " commands buffered in one frame (limit " .. tostring(FLUSH_BUDGET) .. "). Infinite React reconciliation loop."))
            f:write(string.format("  context = %q,\n", "__hostFlush budget exceeded"))
            f:write(string.format("  timestamp = %q,\n", os.date("%Y-%m-%d %H:%M:%S")))
            f:write(string.format("  luaMemMB = %.1f,\n", luaMem))
            f:write(string.format("  trail = %q,\n", table.concat(trail, "\n")))
            f:write("}\n")
            f:close()
          end
          io.write("[BUDGET] Crash data written to " .. tmpDir .. "/reactjit_crash.lua\n"); io.flush()
        end

        -- Stop feeding the leak once over budget
        if #selfRef.commandBuffer > FLUSH_BUDGET then
          selfRef.commandBuffer = {}
        end
      else
        print("[reactjit] __hostFlush JSON decode failed: " .. tostring(commands))
        print("[reactjit] Raw JSON string (first 200 chars): " .. jsonStr:sub(1, 200))
      end
    else
      print("[reactjit] __hostFlush: JS_ToCString returned nil")
    end
    -- ret already points to JS_UNDEFINED (set by C trampoline)
  end)
  self._callbacks[#self._callbacks + 1] = flushCb

  -- __hostGetEvents: JS polls for input events from Lua
  local eventsCb = ffi.cast("HostCallback", function(ctx, argc, argv, ret)
    local events = selfRef.eventQueue
    selfRef.eventQueue = {}

    -- Build a JS array and write it to *ret (ownership transfers to JS)
    local ok, jsArr = pcall(luaToJSValue, ctx, qjs, events)
    if ok then
      ret[0] = jsArr
    else
      print("[reactjit] __hostGetEvents FFI construction failed: " .. tostring(jsArr))
    end
  end)
  self._callbacks[#self._callbacks + 1] = eventsCb

  -- __hostLog: Routes console.log from JS to Love2D's print
  local logCb = ffi.cast("HostCallback", function(ctx, argc, argv, ret)
    if argc >= 1 then
      local cstr = qjs.JS_ToCString(ctx, argv[0])
      if cstr ~= nil then
        local msg = ffi.string(cstr)
        qjs.JS_FreeCString(ctx, cstr)
        -- Protocol: "CLIPBOARD:" prefix → copy to system clipboard
        if msg:sub(1, 10) == "CLIPBOARD:" then
          local text = msg:sub(11)
          pcall(function() love.system.setClipboardText(text) end)
          return
        end
        print("[JS] " .. msg)
      end
    end
  end)
  self._callbacks[#self._callbacks + 1] = logCb

  -- __hostMeasureText: JS queries text dimensions using Love2D's font APIs
  local measureCb = ffi.cast("HostCallback", function(ctx, argc, argv, ret)
    local zeroResult = { width = 0, height = 0 }

    if argc < 1 then
      ret[0] = luaToJSValue(ctx, qjs, zeroResult)
      return
    end

    -- Direct FFI: argv[0] is a raw JS object
    local pok, params = pcall(jsValueToLua, ctx, qjs, argv[0])
    if not pok or type(params) ~= "table" then
      print("[reactjit] __hostMeasureText FFI traversal failed: " .. tostring(params))
      ret[0] = luaToJSValue(ctx, qjs, zeroResult)
      return
    end

    local text = params.text or ""
    local fontSize = params.fontSize or 14
    local maxWidth = params.maxWidth  -- nil means unconstrained

    local result = Measure.measureText(text, fontSize, maxWidth)
    local resultTbl = { width = result.width, height = result.height }

    local rok, jsResult = pcall(luaToJSValue, ctx, qjs, resultTbl)
    if rok then
      ret[0] = jsResult
    else
      print("[reactjit] __hostMeasureText FFI construction failed: " .. tostring(jsResult))
      ret[0] = luaToJSValue(ctx, qjs, zeroResult)
    end
  end)
  self._callbacks[#self._callbacks + 1] = measureCb

  -- __hostReportError: JS sends structured error objects to Lua error overlay
  local reportErrorCb = ffi.cast("HostCallback", function(ctx, argc, argv, ret)
    if argc < 1 then return end

    local pok, errObj = pcall(jsValueToLua, ctx, qjs, argv[0])
    if not pok or type(errObj) ~= "table" then
      -- Fallback: try to at least get a string
      pcall(function()
        local cstr = qjs.JS_ToCString(ctx, argv[0])
        if cstr ~= nil then
          local msg = ffi.string(cstr)
          qjs.JS_FreeCString(ctx, cstr)
          local errors = require("lua.errors")
          errors.push({ source = "js", message = msg, context = "unknown" })
        end
      end)
      return
    end

    -- Push structured error to the errors module
    local eok, _ = pcall(function()
      local errors = require("lua.errors")
      errors.push({
        source = errObj.name or "js",
        message = errObj.message or "unknown error",
        stack = errObj.stack or "",
        context = errObj.context or "",
      })
    end)
  end)
  self._callbacks[#self._callbacks + 1] = reportErrorCb

  -- __hostRandomBytes: JS requests CSPRNG bytes from /dev/urandom
  -- Returns a JS array of byte values (0-255). Used by crypto.getRandomValues() polyfill.
  local randomCb = ffi.cast("HostCallback", function(ctx, argc, argv, ret)
    local n = 32  -- default
    if argc >= 1 then
      if qjs.JS_ToInt32(ctx, _int32_buf, argv[0]) == 0 then
        n = tonumber(_int32_buf[0])
      end
    end
    if n < 1 then n = 1 end
    if n > 65536 then n = 65536 end

    local f = io.open("/dev/urandom", "rb")
    if not f then
      print("[reactjit] __hostRandomBytes: cannot open /dev/urandom")
      ret[0] = qjs.JS_NewArray(ctx)
      return
    end
    local bytes = f:read(n)
    f:close()

    local arr = qjs.JS_NewArray(ctx)
    for i = 1, #bytes do
      qjs.JS_SetPropertyUint32(ctx, arr, i - 1, qjs.JS_NewInt32(ctx, string.byte(bytes, i)))
    end
    ret[0] = arr
  end)
  self._callbacks[#self._callbacks + 1] = randomCb

  -- Register callbacks in C shim, then register JS globals
  qjs.qjs_set_host_flush(flushCb)
  qjs.qjs_set_host_events(eventsCb)
  qjs.qjs_set_host_log(logCb)
  qjs.qjs_set_host_measure(measureCb)
  qjs.qjs_set_host_report_error(reportErrorCb)
  qjs.qjs_set_host_random(randomCb)
  qjs.qjs_register_host_functions(self.ctx)
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Set the quarantine module reference for miner detection scanning.
--- Called from init.lua after quarantine module is loaded.
--- @param q table  The quarantine module
function Bridge.setQuarantine(q)
  _quarantine = q
end

function Bridge:eval(code, filename)
  if self.ctx == nil then error("[QuickJS] Bridge context is destroyed") end
  filename = filename or "<eval>"

  -- Scan for crypto miners before executing (silent — code still runs if detected)
  if _quarantine and not _quarantine.isActive() then
    local result = _quarantine.scanJS(code)
    if result.detected then
      _quarantine.activate("crypto_miner_detected", result.matches)
    end
  end

  local val = self.qjs.JS_Eval(
    self.ctx, code, #code, filename, JS_EVAL_TYPE_GLOBAL
  )

  if self.qjs.JS_IsException(val) ~= 0 then
    local exc = self.qjs.JS_GetException(self.ctx)
    local cstr = self.qjs.JS_ToCString(self.ctx, exc)
    local msg = cstr ~= nil and ffi.string(cstr) or "unknown error"
    if cstr ~= nil then self.qjs.JS_FreeCString(self.ctx, cstr) end
    self.qjs.JS_FreeValue(self.ctx, exc)
    error("[QuickJS] " .. msg)
  end

  self.qjs.JS_FreeValue(self.ctx, val)
end

--- Evaluate JS code and return the result as a Lua value.
--- Like eval() but converts the return value via jsValueToLua.
function Bridge:evalReturn(code, filename)
  if self.ctx == nil then error("[QuickJS] Bridge context is destroyed") end
  filename = filename or "<eval>"
  local val = self.qjs.JS_Eval(
    self.ctx, code, #code, filename, JS_EVAL_TYPE_GLOBAL
  )

  if self.qjs.JS_IsException(val) ~= 0 then
    local exc = self.qjs.JS_GetException(self.ctx)
    local cstr = self.qjs.JS_ToCString(self.ctx, exc)
    local msg = cstr ~= nil and ffi.string(cstr) or "unknown error"
    if cstr ~= nil then self.qjs.JS_FreeCString(self.ctx, cstr) end
    self.qjs.JS_FreeValue(self.ctx, exc)
    error("[QuickJS] " .. msg)
  end

  local luaVal = jsValueToLua(self.ctx, self.qjs, val)
  self.qjs.JS_FreeValue(self.ctx, val)
  return luaVal
end

--- Call a global JS function by name, bypassing JS_Eval.
--- This avoids whatever in JS_Eval prevents it from returning
--- after a complex synchronous React render.
function Bridge:callGlobal(name)
  if self.ctx == nil then return end
  local qjs = self.qjs
  local ctx = self.ctx
  local global = qjs.JS_GetGlobalObject(ctx)
  local fn = qjs.JS_GetPropertyStr(ctx, global, name)

  if qjs.JS_IsUndefined(fn) ~= 0 then
    qjs.JS_FreeValue(ctx, fn)
    qjs.JS_FreeValue(ctx, global)
    return
  end

  if qjs.JS_IsFunction(ctx, fn) == 0 then
    qjs.JS_FreeValue(ctx, fn)
    qjs.JS_FreeValue(ctx, global)
    return
  end

  local result = qjs.JS_Call(ctx, fn, global, 0, nil)

  if qjs.JS_IsException(result) ~= 0 then
    local exc = qjs.JS_GetException(ctx)
    local cstr = qjs.JS_ToCString(ctx, exc)
    local msg = cstr ~= nil and ffi.string(cstr) or "unknown error"
    if cstr ~= nil then qjs.JS_FreeCString(ctx, cstr) end
    qjs.JS_FreeValue(ctx, exc)
    qjs.JS_FreeValue(ctx, fn)
    qjs.JS_FreeValue(ctx, global)
    error("[QuickJS] " .. msg)
  end

  qjs.JS_FreeValue(ctx, result)
  qjs.JS_FreeValue(ctx, fn)
  qjs.JS_FreeValue(ctx, global)
end

--- Call a global JS function by name and return its result as a Lua value.
--- Like callGlobal but converts the return value via jsValueToLua instead
--- of discarding it. Returns nil if the function doesn't exist or throws.
function Bridge:callGlobalReturn(name)
  if self.ctx == nil then return nil end
  local qjs = self.qjs
  local ctx = self.ctx
  local global = qjs.JS_GetGlobalObject(ctx)
  local fn = qjs.JS_GetPropertyStr(ctx, global, name)

  if qjs.JS_IsUndefined(fn) ~= 0 then
    qjs.JS_FreeValue(ctx, fn)
    qjs.JS_FreeValue(ctx, global)
    return nil
  end

  if qjs.JS_IsFunction(ctx, fn) == 0 then
    qjs.JS_FreeValue(ctx, fn)
    qjs.JS_FreeValue(ctx, global)
    return nil
  end

  local result = qjs.JS_Call(ctx, fn, global, 0, nil)

  if qjs.JS_IsException(result) ~= 0 then
    local exc = qjs.JS_GetException(ctx)
    qjs.JS_FreeValue(ctx, exc)
    qjs.JS_FreeValue(ctx, fn)
    qjs.JS_FreeValue(ctx, global)
    return nil
  end

  local luaVal = jsValueToLua(ctx, qjs, result)
  qjs.JS_FreeValue(ctx, result)
  qjs.JS_FreeValue(ctx, fn)
  qjs.JS_FreeValue(ctx, global)
  return luaVal
end

--- Tick the JS event loop (promises, microtasks, timers)
function Bridge:tick()
  if self.ctx == nil then return end
  -- Drain pending microtasks (and clear any exceptions)
  -- Budget: max microtask drains per tick. Prevents infinite promise chains.
  local MICROTASK_BUDGET = 1000000
  local microtaskCount = 0
  local ctx_ptr = ffi.new("JSContext*[1]")
  while true do
    local ret = self.qjs.JS_ExecutePendingJob(self.rt, ctx_ptr)
    if ret <= 0 then
      if ret < 0 then
        -- Clear the exception so it doesn't poison subsequent calls
        local exc = self.qjs.JS_GetException(self.ctx)
        local cstr = self.qjs.JS_ToCString(self.ctx, exc)
        local msg = cstr ~= nil and ffi.string(cstr) or "unknown error"
        if cstr ~= nil then self.qjs.JS_FreeCString(self.ctx, cstr) end
        self.qjs.JS_FreeValue(self.ctx, exc)
        pcall(function()
          local errors = require("lua.errors")
          errors.push({ source = "js", message = msg, context = "pending job exception" })
        end)
      end
      break
    end
    microtaskCount = microtaskCount + 1
    if microtaskCount > MICROTASK_BUDGET then
      error(string.format("[BUDGET] JS microtask drain exceeded %d iterations. Likely infinite promise chain.", MICROTASK_BUDGET))
    end
  end

  -- Tick polyfilled timers (use callGlobal to avoid JS_Eval hang)
  pcall(function() self:callGlobal("__tickTimers") end)
end

--- Drain the command buffer (called by Love2D each frame)
local COMMAND_BUDGET = 1000000
function Bridge:drainCommands()
  local cmds = self.commandBuffer
  self.commandBuffer = {}
  if #cmds > COMMAND_BUDGET then
    error(string.format(
      "[BUDGET] %d commands buffered in one frame (limit %d). Infinite React reconciliation loop.",
      #cmds, COMMAND_BUDGET))
  end
  return cmds
end

--- Push an input event for JS to pick up
function Bridge:pushEvent(event)
  self.eventQueue[#self.eventQueue + 1] = event
end

--- Clean shutdown (idempotent — safe to call multiple times)
function Bridge:destroy()
  if self.ctx ~= nil then
    self.qjs.JS_FreeContext(self.ctx)
    self.ctx = nil
  end
  if self.rt ~= nil then
    self.qjs.JS_FreeRuntime(self.rt)
    self.rt = nil
  end
end

--- Check if the bridge has a live JS context.
function Bridge:isAlive()
  return self.ctx ~= nil and self.rt ~= nil
end

return Bridge
