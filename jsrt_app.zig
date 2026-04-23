//! jsrt_app.zig — React running through the LuaJIT-hosted JSRT evaluator.
//!
//! Build:
//!   zig build app -Dapp-name=hello -Dapp-source=jsrt_app.zig -Doptimize=ReleaseFast

const std = @import("std");
const build_options = @import("build_options");
const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;

const layout = @import("framework/layout.zig");
const Node = layout.Node;
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
const luajit_runtime = @import("framework/luajit_runtime.zig");
const lua_guard = @import("framework/lua_guard.zig");
const fs_mod = @import("framework/fs.zig");
const localstore = @import("framework/localstore.zig");
const click_latency = @import("framework/lua/jsrt/click_latency.zig");
comptime {
    if (!IS_LIB) _ = @import("framework/core.zig");
}

const lua = lua_guard.lua;

const WINDOW_TITLE = std.fmt.comptimePrint("{s}", .{
    if (@hasDecl(build_options, "app_name") and build_options.app_name.len > 0)
        build_options.app_name
    else
        "reactjit",
});

const AST_FILE_NAME = std.fmt.comptimePrint("bundle-{s}.ast.lua", .{
    if (@hasDecl(build_options, "app_name") and build_options.app_name.len > 0)
        build_options.app_name
    else
        "app",
});
const AST_BYTES = @embedFile(AST_FILE_NAME);
const AST_LABEL: [:0]const u8 = "<embedded-jsrt-ast>";

const LUAJIT_MODULES = [_]struct { name: [:0]const u8, source: []const u8 }{
    .{ .name = "renderer.hostConfig", .source = @embedFile("renderer/hostConfig.lua") },
    .{ .name = "framework.lua.jsrt.json", .source = @embedFile("framework/lua/jsrt/json.lua") },
    .{ .name = "framework.lua.jsrt.values", .source = @embedFile("framework/lua/jsrt/values.lua") },
    .{ .name = "framework.lua.jsrt.scope", .source = @embedFile("framework/lua/jsrt/scope.lua") },
    .{ .name = "framework.lua.jsrt.evaluator", .source = @embedFile("framework/lua/jsrt/evaluator.lua") },
    .{ .name = "framework.lua.jsrt.builtins", .source = @embedFile("framework/lua/jsrt/builtins.lua") },
    .{ .name = "framework.lua.jsrt.host", .source = @embedFile("framework/lua/jsrt/host.lua") },
    .{ .name = "framework.lua.jsrt.init", .source = @embedFile("framework/lua/jsrt/init.lua") },
};

const JSRT_BOOTSTRAP =
    \\local JSRT = require("framework.lua.jsrt.init")
    \\local Values = require("framework.lua.jsrt.values")
    \\local Evaluator = require("framework.lua.jsrt.evaluator")
    \\_G.__debugFlood = false
    \\
    \\local hostCreate = __hostCreate
    \\local hostCreateText = __hostCreateText
    \\local hostAppend = __hostAppend
    \\local hostAppendToRoot = __hostAppendToRoot
    \\local hostUpdateText = __hostUpdateText
    \\local hostUpdate = __hostUpdate
    \\local hostRemove = __hostRemove
    \\local hostRemoveFromRoot = __hostRemoveFromRoot
    \\local hostInsertBefore = __hostInsertBefore
    \\local hostInsertBeforeRoot = __hostInsertBeforeRoot
    \\local hostLog = __hostLog
    \\local hostGetInputText = getInputText
    \\local dispatchSlot = { fn = nil }
    \\
    \\local globals = {
    \\  __hostCreate = Values.newNativeFunction(function(args)
    \\    if #args >= 4 then
    \\      return hostCreate(args[1], args[2], args[3] or {}, args[4] or {})
    \\    end
    \\    if #args >= 3 then
    \\      return hostCreate(args[1], args[2], args[3] or {}, {})
    \\    end
    \\    return hostCreate(args[1], args[2] or {})
    \\  end),
    \\  __hostCreateText = Values.newNativeFunction(function(args)
    \\    if #args >= 2 then
    \\      return hostCreateText(args[1], args[2] or "")
    \\    end
    \\    return hostCreateText(args[1] or "")
    \\  end),
    \\  __hostAppend = Values.newNativeFunction(function(args)
    \\    hostAppend(args[1], args[2])
    \\    return Values.UNDEFINED
    \\  end),
    \\  __hostAppendToRoot = Values.newNativeFunction(function(args)
    \\    hostAppendToRoot(args[1])
    \\    return Values.UNDEFINED
    \\  end),
    \\  __hostUpdateText = Values.newNativeFunction(function(args)
    \\    hostUpdateText(args[1], args[2] or "")
    \\    return Values.UNDEFINED
    \\  end),
    \\  __hostUpdate = Values.newNativeFunction(function(args)
    \\    hostUpdate(args[1], args[2] or {}, args[3] or {})
    \\    return Values.UNDEFINED
    \\  end),
    \\  __hostRemove = Values.newNativeFunction(function(args)
    \\    hostRemove(args[1], args[2])
    \\    return Values.UNDEFINED
    \\  end),
    \\  __hostRemoveFromRoot = Values.newNativeFunction(function(args)
    \\    hostRemoveFromRoot(args[1])
    \\    return Values.UNDEFINED
    \\  end),
    \\  __hostInsertBefore = Values.newNativeFunction(function(args)
    \\    hostInsertBefore(args[1], args[2], args[3])
    \\    return Values.UNDEFINED
    \\  end),
    \\  __hostInsertBeforeRoot = Values.newNativeFunction(function(args)
    \\    hostInsertBeforeRoot(args[1], args[2])
    \\    return Values.UNDEFINED
    \\  end),
    \\  __getInputTextForNode = Values.newNativeFunction(function(args)
    \\    local id = tonumber(args[1]) or 0
    \\    return hostGetInputText(id)
    \\  end),
    \\  __hostLog = Values.newNativeFunction(function(args)
    \\    if #args >= 2 then
    \\      return hostLog(tostring(args[1] or "info"), tostring(args[2] or ""))
    \\    end
    \\    return hostLog(tostring(args[1] or ""))
    \\  end),
    \\  __hostGetEvents = Values.newNativeFunction(function(_args)
    \\    return Values.newArray()
    \\  end),
    \\}
    \\
    \\_G.__dispatchEventFromZig = function(id, eventType)
    \\  if dispatchSlot.fn == nil then
    \\    return Values.UNDEFINED
    \\  end
    \\  return Evaluator.callFunction(dispatchSlot.fn, { id, eventType }, Values.UNDEFINED, nil, "__dispatchEventFromZig")
    \\end
    \\
    \\local function applyCommand(cmd)
    \\  local op = cmd.op
    \\  if op == "CREATE_TEXT" then
    \\    __hostCreateText(cmd.id, cmd.text or "")
    \\  elseif op == "CREATE" then
    \\    __hostCreate(cmd.id, cmd.type or "", cmd.props or {}, cmd.handlerNames or {})
    \\  elseif op == "APPEND" then
    \\    __hostAppend(cmd.parentId, cmd.childId)
    \\  elseif op == "APPEND_TO_ROOT" then
    \\    __hostAppendToRoot(cmd.childId)
    \\  elseif op == "UPDATE_TEXT" then
    \\    __hostUpdateText(cmd.id, cmd.text or "")
    \\  elseif op == "UPDATE" then
    \\    __hostUpdate(cmd.id, cmd.props or {}, cmd.handlerNames or {})
    \\  elseif op == "REMOVE" then
    \\    __hostRemove(cmd.parentId, cmd.childId)
    \\  elseif op == "REMOVE_FROM_ROOT" then
    \\    __hostRemoveFromRoot(cmd.childId)
    \\  elseif op == "INSERT_BEFORE" then
    \\    __hostInsertBefore(cmd.parentId, cmd.childId, cmd.beforeId)
    \\  elseif op == "INSERT_BEFORE_ROOT" then
    \\    __hostInsertBeforeRoot(cmd.childId, cmd.beforeId)
    \\  end
    \\end
    \\
    \\local function normalizeCommands(commands)
    \\  if type(commands) ~= "table" then
    \\    return {}
    \\  end
    \\  if #commands > 0 then
    \\    return commands
    \\  end
    \\  local keyed = {}
    \\  for k, v in pairs(commands) do
    \\    local idx = tonumber(k)
    \\    if idx and idx >= 1 then
    \\      keyed[#keyed + 1] = { idx = idx, value = v }
    \\    end
    \\  end
    \\  table.sort(keyed, function(a, b) return a.idx < b.idx end)
    \\  local out = {}
    \\  for i = 1, #keyed do
    \\    out[i] = keyed[i].value
    \\  end
    \\  return out
    \\end
    \\
    \\local function onFlush(commands)
    \\  local list = normalizeCommands(commands)
    \\  for i = 1, #list do
    \\    applyCommand(list[i])
    \\  end
    \\  __hostFlush()
    \\end
    \\
    \\JSRT.run(__embedded_ast, { host = { dispatchSlot = dispatchSlot, onFlush = onFlush }, globals = globals })
;

fn setLoadedModule(L: *lua.lua_State, name: [:0]const u8) void {
    _ = lua.lua_getglobal(L, "package");
    if (!lua.lua_istable(L, -1)) {
        lua.lua_pop(L, 1);
        return;
    }
    lua.lua_getfield(L, -1, "loaded");
    if (!lua.lua_istable(L, -1)) {
        lua.lua_pop(L, 2);
        return;
    }
    lua.lua_pushvalue(L, -3);
    lua.lua_setfield(L, -2, name);
    lua.lua_pop(L, 3);
}

fn preloadModule(name: [:0]const u8, source: []const u8) bool {
    const raw_L = luajit_runtime.g_lua orelse return false;
    const L: *lua.lua_State = @ptrCast(raw_L);
    const guard = lua_guard.StackGuard.init(L);
    defer guard.deinit();

    if (lua.luaL_loadbuffer(L, source.ptr, source.len, name) != 0) {
        lua_guard.logLuaError(L, name);
        lua.lua_pop(L, 1);
        return false;
    }
    if (lua.lua_pcall(L, 0, 1, 0) != 0) {
        lua_guard.logLuaError(L, name);
        lua.lua_pop(L, 1);
        return false;
    }
    setLoadedModule(L, name);
    return true;
}

fn loadEmbeddedAst() bool {
    const raw_L = luajit_runtime.g_lua orelse return false;
    const L: *lua.lua_State = @ptrCast(raw_L);
    const guard = lua_guard.StackGuard.init(L);
    defer guard.deinit();

    if (lua.luaL_loadbuffer(L, AST_BYTES.ptr, AST_BYTES.len, AST_LABEL) != 0) {
        lua_guard.logLuaError(L, "embedded-jsrt-ast");
        lua.lua_pop(L, 1);
        return false;
    }
    if (lua.lua_pcall(L, 0, 1, 0) != 0) {
        lua_guard.logLuaError(L, "embedded-jsrt-ast");
        lua.lua_pop(L, 1);
        return false;
    }
    _ = lua.lua_getglobal(L, "require");
    lua.lua_pushstring(L, "framework.lua.jsrt.json");
    if (lua.lua_pcall(L, 1, 1, 0) != 0) {
        lua_guard.logLuaError(L, "embedded-jsrt-json");
        lua.lua_pop(L, 1);
        lua.lua_pop(L, 1);
        return false;
    }
    lua.lua_getfield(L, -1, "decode");
    lua.lua_pushvalue(L, -3);
    if (lua.lua_pcall(L, 1, 1, 0) != 0) {
        lua_guard.logLuaError(L, "embedded-jsrt-json-decode");
        lua.lua_pop(L, 1);
        lua.lua_pop(L, 2);
        return false;
    }
    lua.lua_setglobal(L, "__embedded_ast");
    lua.lua_pop(L, 2);
    return true;
}

fn appInit() void {
    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});

    for (LUAJIT_MODULES) |module| {
        if (!preloadModule(module.name, module.source)) {
            @panic("jsrt_app: failed to preload Lua module");
        }
    }

    if (!loadEmbeddedAst()) {
        @panic("jsrt_app: failed to load embedded AST");
    }
}

fn dumpAst() !void {
    const stdout = std.fs.File.stdout();
    try stdout.writeAll(AST_BYTES);
}

fn dumpClickLatency() void {
    if (luajit_runtime.hasGlobal("__clickLatencyDump")) {
        luajit_runtime.callGlobalInt("__clickLatencyDump", @intCast(click_latency.default_capacity));
    }
}

pub fn main() !void {
    if (IS_LIB) return;

    const args = try std.process.argsAlloc(std.heap.page_allocator);
    defer std.process.argsFree(std.heap.page_allocator, args);
    var dump_click_latency = false;
    for (args[1..]) |arg| {
        if (std.mem.eql(u8, arg, "--dump-ast")) {
            try dumpAst();
            return;
        } else if (std.mem.eql(u8, arg, "--dump-click-latency")) {
            dump_click_latency = true;
        }
    }
    if (dump_click_latency) {
        luajit_runtime.setClickLatencyDumpOnApply(true);
    }

    try engine.run(.{
        .title = WINDOW_TITLE,
        .root = luajit_runtime.jsrtRoot(),
        .js_logic = "",
        .lua_logic = JSRT_BOOTSTRAP,
        .init = appInit,
        .tick = null,
        .shutdown = if (dump_click_latency) dumpClickLatency else null,
        .borderless = false,
        .set_canvas_node_position = null,
    });
}
