function emitHandlerStorage(mapIdx, handlerIdx, bufSize, mapType) {
  if (mapType === 'inline') {
    return `var _map_lua_bufs_${mapIdx}_${handlerIdx}: [MAX_INLINE_OUTER_${mapIdx}][MAX_MAP_${mapIdx}][${bufSize}]u8 = undefined;\n` +
      `var _map_lua_ptrs_${mapIdx}_${handlerIdx}: [MAX_INLINE_OUTER_${mapIdx}][MAX_MAP_${mapIdx}]?[*:0]const u8 = undefined;\n`;
  }

  const sizeConst = mapType === 'nested' ? `MAX_FLAT_${mapIdx}` : `MAX_MAP_${mapIdx}`;
  let out = `var _map_lua_bufs_${mapIdx}_${handlerIdx}: [${sizeConst}][${bufSize}]u8 = undefined;\n`;
  out += `var _map_lua_ptrs_${mapIdx}_${handlerIdx}: [${sizeConst}]?[*:0]const u8 = .{null} ** ${sizeConst};\n`;

  // Simple flat handlers only need the loop index, so they can precompute
  // pointer strings up front instead of rebuilding them every iteration.
  if (mapType === 'flat' && bufSize <= 48) {
    out += `fn _initMapLuaPtrs${mapIdx}_${handlerIdx}() void {\n`;
    out += `    for (0..${sizeConst}) |_i| {\n`;
    out += `        const n = std.fmt.bufPrint(_map_lua_bufs_${mapIdx}_${handlerIdx}[_i][0..${bufSize - 1}], "__mapPress_${mapIdx}_${handlerIdx}({d})", .{_i}) catch continue;\n`;
    out += `        _map_lua_bufs_${mapIdx}_${handlerIdx}[_i][n.len] = 0;\n`;
    out += `        _map_lua_ptrs_${mapIdx}_${handlerIdx}[_i] = @ptrCast(_map_lua_bufs_${mapIdx}_${handlerIdx}[_i][0..n.len :0]);\n`;
    out += `    }\n`;
    out += `}\n`;
  }

  return out;
}
