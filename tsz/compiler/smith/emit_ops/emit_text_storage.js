function emitTextStorage(mapIdx, bufId, mapType) {
  if (mapType === 'inline') {
    return `var _map_text_bufs_${mapIdx}_${bufId}: [MAX_INLINE_OUTER_${mapIdx}][MAX_MAP_${mapIdx}][256]u8 = undefined;\n` +
      `var _map_texts_${mapIdx}_${bufId}: [MAX_INLINE_OUTER_${mapIdx}][MAX_MAP_${mapIdx}][]const u8 = undefined;\n`;
  }

  const sizeConst = mapType === 'nested' ? `MAX_FLAT_${mapIdx}` : `MAX_MAP_${mapIdx}`;
  return `var _map_text_bufs_${mapIdx}_${bufId}: [${sizeConst}][256]u8 = undefined;\n` +
    `var _map_texts_${mapIdx}_${bufId}: [${sizeConst}][]const u8 = undefined;\n`;
}
