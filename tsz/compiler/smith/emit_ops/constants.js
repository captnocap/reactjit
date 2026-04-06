// ── Atom 1: constants.js — Every string defined once ────────────
// Every field name, prefix, and magic string that appears more than
// once across the emit system. Import these instead of hardcoding.

var PRESS_FIELD = 'lua_on_press';
var HANDLER_PREFIX = '__mapPress_';
var POOL_PREFIX = '_map_pool_';
var COUNT_PREFIX = '_map_count_';
var TEXT_BUF_PREFIX = '_map_text_bufs_';
var TEXT_PREFIX = '_map_texts_';
var LUA_BUF_PREFIX = '_map_lua_bufs_';
var LUA_PTR_PREFIX = '_map_lua_ptrs_';
var INNER_PREFIX = '_map_inner_';
var MAX_MAP_PREFIX = 'MAX_MAP_';
var MAX_FLAT_PREFIX = 'MAX_FLAT_';
var MAX_NESTED_OUTER_PREFIX = 'MAX_NESTED_OUTER_';
var MAX_INLINE_OUTER_PREFIX = 'MAX_INLINE_OUTER_';
var ARENA_VAR = '_pool_arena';
var PER_ITEM_PREFIX = '_pi_';
var MAP_ARR_PREFIX = '_map_';
var DEFAULT_BUF_SIZE = 48;
var EXTENDED_BUF_SIZE = 128;
var DEFAULT_MAP_TEXT_BUF = 256;
var DEFAULT_FLAT_MAX = 4096;
var DEFAULT_NESTED_MAX = 64;
var DEFAULT_INLINE_MAX = 16;
var DEFAULT_INLINE_OUTER = 8;
var DEFAULT_NESTED_OUTER = 128;
var DEFAULT_NESTED_OUTER_SMALL = 64;
var DEFAULT_HANDLER_BUF_SMALL = 47;
var DEFAULT_HANDLER_BUF_LARGE = 127;
