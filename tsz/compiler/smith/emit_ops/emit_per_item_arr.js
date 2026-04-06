function emitPerItemArrDecl(mapIdx, arrName, elemCount, mapType) {
  if (mapType === 'inline') {
    return `var _map_${arrName}_${mapIdx}: [MAX_INLINE_OUTER_${mapIdx}][MAX_MAP_${mapIdx}][${elemCount}]Node = undefined;\n`;
  }
  if (mapType === 'nested') {
    return `var _map_${arrName}_${mapIdx}: [MAX_MAP_${mapIdx}][${elemCount}]Node = undefined;\n`;
  }
  return '';
}
