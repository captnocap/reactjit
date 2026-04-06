function emitMapDecl(mapIdx, mapType, parentPoolSize) {
  if (mapType === 'flat') {
    return `const MAX_MAP_${mapIdx}: usize = 4096;\n` +
      `var _map_pool_${mapIdx}: []Node = undefined;\n` +
      `var _map_count_${mapIdx}: usize = 0;\n`;
  }
  if (mapType === 'nested') {
    return `const MAX_MAP_${mapIdx}: usize = 64;\n` +
      `const MAX_FLAT_${mapIdx}: usize = 4096;\n` +
      `const MAX_NESTED_OUTER_${mapIdx}: usize = ${parentPoolSize};\n` +
      `var _map_pool_${mapIdx}: [MAX_NESTED_OUTER_${mapIdx}][MAX_MAP_${mapIdx}]Node = undefined;\n` +
      `var _map_count_${mapIdx}: [MAX_NESTED_OUTER_${mapIdx}]usize = undefined;\n`;
  }
  if (mapType === 'inline') {
    return `const MAX_MAP_${mapIdx}: usize = 16;\n` +
      `const MAX_INLINE_OUTER_${mapIdx}: usize = 8;\n` +
      `var _map_pool_${mapIdx}: [MAX_INLINE_OUTER_${mapIdx}][MAX_MAP_${mapIdx}]Node = undefined;\n` +
      `var _map_count_${mapIdx}: [MAX_INLINE_OUTER_${mapIdx}]usize = undefined;\n`;
  }
  throw new Error('Unknown map type for emitMapDecl: ' + mapType);
}
