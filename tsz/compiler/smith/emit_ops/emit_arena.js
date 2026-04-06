function emitArenaDecl() {
  return `var _pool_arena: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.page_allocator);\n`;
}
