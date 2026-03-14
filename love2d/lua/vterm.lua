--[[
  vterm.lua — LuaJIT FFI binding to libvterm with damage-driven updates

  Uses a tiny C shim (libvterm_shim.so) to bridge the ABI gap between
  libvterm's struct-by-value callbacks and LuaJIT's scalar-only FFI callbacks.

  The shim unwraps VTermRect/VTermPos into flat ints:
    damage(rect, user)         → damage(sr, er, sc, ec, user)
    moverect(dest, src, user)  → moverect(dsr,der,dsc,dec, ssr,ser,ssc,sec, user)
    movecursor(pos, old, vis)  → movecursor(r, c, oldr, oldc, vis, user)
    settermprop(prop, val)     → settermprop(prop, intval, user)

  Architecture:
    PTY bytes → vt:feed() → libvterm state machine → shim callbacks →
    LuaJIT callbacks → dirty row bitset + cursor state + render signals →
    vt:drain() returns accumulated events since last drain

  Usage:
    local VTerm = require("lua.vterm")
    local vt = VTerm.new(40, 120)

    vt:feed(pty_data)           -- triggers damage callbacks
    local events = vt:drain()   -- returns { damaged, dirtyRows, cursorVisible, ... }
    for _, row in ipairs(events.dirtyRows) do
      local text = vt:getRowText(row)
    end
]]

local ffi = require("ffi")
local bit = require("bit")

-- ── FFI declarations (split to isolate failures) ────────────────────

pcall(ffi.cdef, [[
  typedef struct VTerm VTerm;
  typedef struct VTermState VTermState;
  typedef struct VTermScreen VTermScreen;
]])

pcall(ffi.cdef, [[ typedef struct { int row; int col; } VTermPos; ]])

pcall(ffi.cdef, [[
  typedef struct {
    int start_row; int end_row;
    int start_col; int end_col;
  } VTermRect;
]])

pcall(ffi.cdef, [[
  typedef union {
    uint8_t type;
    struct { uint8_t type; uint8_t red, green, blue; } rgb;
    struct { uint8_t type; uint8_t idx; } indexed;
  } VTermColor;
]])

pcall(ffi.cdef, [[
  typedef struct {
    unsigned int bold      : 1;
    unsigned int underline : 2;
    unsigned int italic    : 1;
    unsigned int blink     : 1;
    unsigned int reverse   : 1;
    unsigned int conceal   : 1;
    unsigned int strike    : 1;
    unsigned int font      : 4;
    unsigned int dwl       : 1;
    unsigned int dhl       : 2;
    unsigned int small     : 1;
    unsigned int baseline  : 2;
  } VTermScreenCellAttrs;
]])

pcall(ffi.cdef, [[
  typedef struct {
    uint32_t chars[6];
    char     width;
    VTermScreenCellAttrs attrs;
    VTermColor fg, bg;
  } VTermScreenCell;
]])

pcall(ffi.cdef, [[
  VTerm *vterm_new(int rows, int cols);
  void   vterm_free(VTerm *vt);
  void   vterm_get_size(const VTerm *vt, int *rowsp, int *colsp);
  void   vterm_set_size(VTerm *vt, int rows, int cols);
  void   vterm_set_utf8(VTerm *vt, int is_utf8);
  size_t vterm_input_write(VTerm *vt, const char *bytes, size_t len);
]])

pcall(ffi.cdef, [[
  VTermScreen *vterm_obtain_screen(VTerm *vt);
  void   vterm_screen_reset(VTermScreen *screen, int hard);
  int    vterm_screen_get_cell(const VTermScreen *screen, VTermPos pos, VTermScreenCell *cell);
  size_t vterm_screen_get_text(const VTermScreen *screen, char *str, size_t len, const VTermRect rect);
  int    vterm_screen_is_eol(const VTermScreen *screen, VTermPos pos);
  void   vterm_screen_flush_damage(VTermScreen *screen);
  void   vterm_screen_set_damage_merge(VTermScreen *screen, int size);
  void   vterm_screen_enable_altscreen(VTermScreen *screen, int altscreen);
  void   vterm_screen_enable_reflow(VTermScreen *screen, int reflow);
  void   vterm_screen_convert_color_to_rgb(const VTermScreen *screen, VTermColor *col);
]])

pcall(ffi.cdef, [[
  VTermState *vterm_obtain_state(VTerm *vt);
  void vterm_state_reset(VTermState *state, int hard);
  void vterm_state_get_cursorpos(const VTermState *state, VTermPos *cursorpos);
  size_t vterm_output_read(VTerm *vt, char *buffer, size_t len);
]])

-- Shim API (flat-int callbacks, no struct-by-value)
pcall(ffi.cdef, [[
  void vterm_shim_set_callbacks(
    int (*damage)(int sr, int er, int sc, int ec, void *user),
    int (*moverect)(int dsr, int der, int dsc, int dec,
                    int ssr, int ser, int ssc, int sec, void *user),
    int (*movecursor)(int row, int col, int old_row, int old_col, int visible, void *user),
    int (*settermprop)(int prop, int intval, void *user),
    int (*bell)(void *user),
    int (*sb_pushline)(int cols, void *user)
  );
  void vterm_shim_register(VTermScreen *screen, void *user);
]])

local ok_vterm, lib = pcall(ffi.load, "vterm")
if not ok_vterm then
  error("[vterm] Cannot load libvterm — install it with: sudo apt install libvterm-dev\n" .. tostring(lib))
end

-- Load the shim library — try multiple paths for different contexts (love ., luajit, etc.)
local shim
do
  local libExt = ffi.os == "OSX" and ".dylib" or ".so"
  local paths = {
    "./lua/libvterm_shim" .. libExt,     -- love . from project root
    "lua/libvterm_shim" .. libExt,       -- alt
    "./libvterm_shim" .. libExt,         -- if running from lua/ dir
    "libvterm_shim",                     -- system search fallback
  }
  for _, p in ipairs(paths) do
    local ok, lib_or_err = pcall(ffi.load, p)
    if ok then
      shim = lib_or_err
      break
    end
  end
  if not shim then
    error("[vterm] Cannot load libvterm_shim" .. libExt .. " — build it with: gcc -shared -fPIC -o lua/libvterm_shim" .. libExt .. " lua/vterm_shim.c -lvterm")
  end
end

-- ── libvterm constants ──────────────────────────────────────────────

local VTERM_COLOR_RGB        = 0x00
local VTERM_COLOR_INDEXED    = 0x01
local VTERM_COLOR_TYPE_MASK  = 0x01
local VTERM_COLOR_DEFAULT_FG = 0x02
local VTERM_COLOR_DEFAULT_BG = 0x04

-- Damage merge modes
local VTERM_DAMAGE_CELL   = 0
local VTERM_DAMAGE_ROW    = 1
local VTERM_DAMAGE_SCREEN = 2
local VTERM_DAMAGE_SCROLL = 3

-- Term properties
local VTERM_PROP_CURSORVISIBLE = 1
local VTERM_PROP_CURSORBLINK   = 2
local VTERM_PROP_ALTSCREEN     = 3

-- ── Instance routing ────────────────────────────────────────────────
-- Callbacks receive a void* userdata. We map instance IDs to VTerm objects.

local _instances = {}
local _nextId    = 1

local function _getInstance(user)
  local id = tonumber(ffi.cast("intptr_t", user))
  return _instances[id]
end

-- ── LuaJIT-friendly callbacks (all scalar args, no structs) ─────────
-- CRITICAL: anchor these in module-level vars to prevent GC collection.

local _cb_damage = ffi.cast("int (*)(int, int, int, int, void*)",
  function(sr, er, sc, ec, user)
    local self = _getInstance(user)
    if not self then return 0 end
    for r = sr, er - 1 do
      self._dirtyRows[r] = true
    end
    self._hasDamage = true
    return 0
  end)

local _cb_moverect = ffi.cast("int (*)(int,int,int,int, int,int,int,int, void*)",
  function(dsr, der, dsc, dec, ssr, ser, ssc, sec, user)
    local self = _getInstance(user)
    if not self then return 0 end
    -- Mark both source and destination regions dirty
    for r = dsr, der - 1 do self._dirtyRows[r] = true end
    for r = ssr, ser - 1 do self._dirtyRows[r] = true end
    self._hasDamage = true
    self._scrolled = true
    return 0
  end)

local _cb_movecursor = ffi.cast("int (*)(int, int, int, int, int, void*)",
  function(row, col, old_row, old_col, visible, user)
    local self = _getInstance(user)
    if not self then return 0 end
    self._cursorRow = row
    self._cursorCol = col
    self._cursorVisible = (visible ~= 0)
    self._cursorMoved = true
    return 0
  end)

local _cb_settermprop = ffi.cast("int (*)(int, int, void*)",
  function(prop, intval, user)
    local self = _getInstance(user)
    if not self then return 0 end
    if prop == VTERM_PROP_CURSORVISIBLE then
      local wasVisible = self._cursorVisible
      self._cursorVisible = (intval ~= 0)
      if wasVisible and not self._cursorVisible then
        self._renderInProgress = true
      elseif not wasVisible and self._cursorVisible then
        self._renderInProgress = false
        self._renderCompleted = true
      end
    elseif prop == VTERM_PROP_ALTSCREEN then
      self._altScreen = (intval ~= 0)
    end
    return 1
  end)

local _cb_bell = ffi.cast("int (*)(void*)", function(user) return 0 end)

local _cb_sb_pushline = ffi.cast("int (*)(int, void*)",
  function(cols, user)
    local self = _getInstance(user)
    if not self then return 0 end
    -- Capture the top row (row 0) content + colors before it's pushed off
    local cells = {}
    for c = 0, self._cols - 1 do
      local pos = ffi.new("VTermPos")
      pos.row = 0
      pos.col = c
      local cell = ffi.new("VTermScreenCell")
      lib.vterm_screen_get_cell(self._screen, pos, cell)

      local char = ""
      if cell.chars[0] ~= 0 then
        local cp = cell.chars[0]
        if cp < 0x80 then
          char = string.char(cp)
        elseif cp < 0x800 then
          char = string.char(0xC0 + bit.rshift(cp, 6), 0x80 + bit.band(cp, 0x3F))
        elseif cp < 0x10000 then
          char = string.char(0xE0 + bit.rshift(cp, 12), 0x80 + bit.band(bit.rshift(cp, 6), 0x3F), 0x80 + bit.band(cp, 0x3F))
        elseif cp <= 0x10FFFF then
          char = string.char(0xF0 + bit.rshift(cp, 18), 0x80 + bit.band(bit.rshift(cp, 12), 0x3F), 0x80 + bit.band(bit.rshift(cp, 6), 0x3F), 0x80 + bit.band(cp, 0x3F))
        end
      end

      local fg = nil
      if bit.band(cell.fg.type, 0x02) == 0 then -- not default fg
        if bit.band(cell.fg.type, 0x01) == 0x01 then -- indexed
          local tmp = ffi.new("VTermColor")
          ffi.copy(tmp, cell.fg, ffi.sizeof("VTermColor"))
          lib.vterm_screen_convert_color_to_rgb(self._screen, tmp)
          fg = { tmp.rgb.red, tmp.rgb.green, tmp.rgb.blue }
        else
          fg = { cell.fg.rgb.red, cell.fg.rgb.green, cell.fg.rgb.blue }
        end
      end

      local bg = nil
      if bit.band(cell.bg.type, 0x04) == 0 then -- not default bg
        if bit.band(cell.bg.type, 0x01) == 0x01 then -- indexed
          local tmp = ffi.new("VTermColor")
          ffi.copy(tmp, cell.bg, ffi.sizeof("VTermColor"))
          lib.vterm_screen_convert_color_to_rgb(self._screen, tmp)
          bg = { tmp.rgb.red, tmp.rgb.green, tmp.rgb.blue }
        else
          bg = { cell.bg.rgb.red, cell.bg.rgb.green, cell.bg.rgb.blue }
        end
      end

      cells[c + 1] = { char = char, fg = fg, bg = bg, bold = cell.attrs.bold == 1 }
    end
    local sb = self._scrollback
    sb[#sb + 1] = cells
    -- Cap scrollback at max lines
    if #sb > self._maxScrollback then
      table.remove(sb, 1)
    end
    self._scrollbackLines = #sb
    return 0
  end)

-- Register all callbacks with the shim (once, at module load)
shim.vterm_shim_set_callbacks(
  _cb_damage, _cb_moverect, _cb_movecursor,
  _cb_settermprop, _cb_bell, _cb_sb_pushline
)

-- ── VTerm wrapper class ─────────────────────────────────────────────

local VTerm = {}
VTerm.__index = VTerm

function VTerm.new(rows, cols)
  rows = rows or 40
  cols = cols or 120

  local vt = lib.vterm_new(rows, cols)
  if vt == nil then
    error("[vterm] Failed to create VTerm (" .. rows .. "x" .. cols .. ")")
  end

  lib.vterm_set_utf8(vt, 1)

  local screen = lib.vterm_obtain_screen(vt)
  lib.vterm_screen_enable_altscreen(screen, 1)
  lib.vterm_screen_enable_reflow(screen, 1)

  -- Assign instance ID for callback routing
  local id = _nextId
  _nextId = _nextId + 1

  local self = setmetatable({
    _vt       = vt,
    _screen   = screen,
    _rows     = rows,
    _cols     = cols,
    _id       = id,
    _cell     = ffi.new("VTermScreenCell"),
    _pos      = ffi.new("VTermPos"),
    _textbuf  = ffi.new("char[?]", cols * 4 + 1),

    -- Damage tracking (populated by callbacks via shim)
    _dirtyRows        = {},
    _hasDamage        = false,
    _scrolled         = false,

    -- Cursor state (populated by movecursor callback)
    _cursorRow        = 0,
    _cursorCol        = 0,
    _cursorVisible    = true,
    _cursorMoved      = false,

    -- Render lifecycle (populated by settermprop callback)
    _renderInProgress = false,
    _renderCompleted  = false,
    _altScreen        = false,

    -- Scrollback
    _scrollbackLines  = 0,
    _scrollback       = {},       -- array of saved row cell arrays
    _maxScrollback    = 5000,     -- max scrollback lines to keep
  }, VTerm)

  -- Register instance for callback routing
  _instances[id] = self

  -- Register shim callbacks with this screen + our instance ID as userdata
  local userdata = ffi.cast("void*", ffi.cast("intptr_t", id))
  shim.vterm_shim_register(screen, userdata)

  -- ROW-level damage merge: coalesce per-cell damage into row ranges
  lib.vterm_screen_set_damage_merge(screen, VTERM_DAMAGE_ROW)

  -- Reset screen (triggers initial damage for all rows)
  lib.vterm_screen_reset(screen, 1)

  -- Clear initial damage from reset
  self._dirtyRows = {}
  self._hasDamage = false

  return self
end

--- Feed raw bytes from a PTY into the terminal emulator.
function VTerm:feed(data)
  if not data or #data == 0 then return end
  lib.vterm_input_write(self._vt, data, #data)
  lib.vterm_screen_flush_damage(self._screen)
end

--- Read any pending output bytes (terminal query responses).
--- Apps send queries like \e[c (device attributes) and vterm generates responses.
--- These must be written back to the PTY so the app receives the answers.
--- @return string|nil  Response bytes, or nil if nothing pending
function VTerm:readOutput()
  local buf = ffi.new("char[?]", 1024)
  local len = lib.vterm_output_read(self._vt, buf, 1024)
  if len > 0 then
    return ffi.string(buf, len)
  end
  return nil
end

--- Drain accumulated events since last drain.
function VTerm:drain()
  local rows = {}
  if self._hasDamage then
    for r in pairs(self._dirtyRows) do
      rows[#rows + 1] = r
    end
    table.sort(rows)
  end

  local result = {
    damaged         = self._hasDamage,
    dirtyRows       = rows,
    scrolled        = self._scrolled,
    cursorMoved     = self._cursorMoved,
    cursorRow       = self._cursorRow,
    cursorCol       = self._cursorCol,
    cursorVisible   = self._cursorVisible,
    renderCompleted = self._renderCompleted,
    altScreen       = self._altScreen,
  }

  -- Reset accumulators
  self._dirtyRows       = {}
  self._hasDamage       = false
  self._scrolled        = false
  self._cursorMoved     = false
  self._renderCompleted = false

  return result
end

--- Check if there are pending dirty rows without draining.
function VTerm:hasDamage()
  return self._hasDamage
end

--- Resize the virtual terminal.
function VTerm:resize(rows, cols)
  self._rows = rows
  self._cols = cols
  lib.vterm_set_size(self._vt, rows, cols)
  if cols * 4 + 1 > ffi.sizeof(self._textbuf) then
    self._textbuf = ffi.new("char[?]", cols * 4 + 1)
  end
end

--- Get current cursor position as { row, col } (0-indexed).
function VTerm:getCursor()
  return { row = self._cursorRow, col = self._cursorCol }
end

--- Is the cursor currently visible?
function VTerm:isCursorVisible()
  return self._cursorVisible
end

--- Resolve a VTermColor to {r, g, b} (0-255).
function VTerm:_resolveColor(col)
  if bit.band(col.type, VTERM_COLOR_DEFAULT_FG) ~= 0 then return nil end
  if bit.band(col.type, VTERM_COLOR_DEFAULT_BG) ~= 0 then return nil end
  if bit.band(col.type, VTERM_COLOR_TYPE_MASK) == VTERM_COLOR_INDEXED then
    local tmp = ffi.new("VTermColor")
    ffi.copy(tmp, col, ffi.sizeof("VTermColor"))
    lib.vterm_screen_convert_color_to_rgb(self._screen, tmp)
    return { tmp.rgb.red, tmp.rgb.green, tmp.rgb.blue }
  end
  return { col.rgb.red, col.rgb.green, col.rgb.blue }
end

--- Get a single cell at (row, col). Returns a Lua table.
function VTerm:getCell(row, col)
  self._pos.row = row
  self._pos.col = col
  lib.vterm_screen_get_cell(self._screen, self._pos, self._cell)

  local c = self._cell
  local char = ""
  if c.chars[0] ~= 0 then
    local cp = c.chars[0]
    if cp < 0x80 then
      char = string.char(cp)
    elseif cp < 0x800 then
      char = string.char(
        0xC0 + bit.rshift(cp, 6),
        0x80 + bit.band(cp, 0x3F))
    elseif cp < 0x10000 then
      char = string.char(
        0xE0 + bit.rshift(cp, 12),
        0x80 + bit.band(bit.rshift(cp, 6), 0x3F),
        0x80 + bit.band(cp, 0x3F))
    elseif cp <= 0x10FFFF then
      char = string.char(
        0xF0 + bit.rshift(cp, 18),
        0x80 + bit.band(bit.rshift(cp, 12), 0x3F),
        0x80 + bit.band(bit.rshift(cp, 6), 0x3F),
        0x80 + bit.band(cp, 0x3F))
    end -- else: invalid codepoint, leave char as ""
  end

  return {
    char   = char,
    width  = c.width,
    fg     = self:_resolveColor(c.fg),
    bg     = self:_resolveColor(c.bg),
    bold   = c.attrs.bold == 1,
    italic = c.attrs.italic == 1,
    underline = c.attrs.underline,
    strike = c.attrs.strike == 1,
    blink  = c.attrs.blink == 1,
    reverse = c.attrs.reverse == 1,
  }
end

--- Get plain text for a row (0-indexed). Trailing spaces trimmed.
function VTerm:getRowText(row)
  local rect = ffi.new("VTermRect")
  rect.start_row = row
  rect.end_row   = row + 1
  rect.start_col = 0
  rect.end_col   = self._cols

  local len = lib.vterm_screen_get_text(self._screen, self._textbuf,
                                         self._cols * 4, rect)
  if len == 0 then return "" end
  local text = ffi.string(self._textbuf, len)
  return text:match("^(.-)%s*$") or ""
end

--- Get plain text for a rectangular region.
function VTerm:getText(startRow, startCol, endRow, endCol)
  local rect = ffi.new("VTermRect")
  rect.start_row = startRow
  rect.end_row   = endRow + 1
  rect.start_col = startCol
  rect.end_col   = (endCol or self._cols - 1) + 1

  local bufsize = (endRow - startRow + 1) * self._cols * 4 + 1
  local buf = ffi.new("char[?]", bufsize)
  local len = lib.vterm_screen_get_text(self._screen, buf, bufsize - 1, rect)
  if len == 0 then return "" end
  return ffi.string(buf, len)
end

--- Get all rows as a table of strings.
function VTerm:getRows()
  local rows = {}
  for r = 0, self._rows - 1 do
    rows[r + 1] = self:getRowText(r)
  end
  return rows
end

--- Get all non-empty rows as a table of strings.
function VTerm:getVisibleRows()
  local rows = {}
  for r = 0, self._rows - 1 do
    local text = self:getRowText(r)
    if #text > 0 then
      rows[#rows + 1] = text
    end
  end
  return rows
end

--- Search the screen for a pattern. Returns {row, col, text} or nil.
function VTerm:findText(pattern)
  for r = 0, self._rows - 1 do
    local text = self:getRowText(r)
    local s, e = text:find(pattern)
    if s then
      return { row = r, col = s - 1, text = text:sub(s, e), fullRow = text }
    end
  end
  return nil
end

--- Search all rows for a pattern. Returns all matches.
function VTerm:findAllText(pattern)
  local matches = {}
  for r = 0, self._rows - 1 do
    local text = self:getRowText(r)
    local s, e = text:find(pattern)
    if s then
      matches[#matches + 1] = { row = r, col = s - 1, text = text:sub(s, e), fullRow = text }
    end
  end
  return matches
end

--- Get a row with full cell info (char + colors + attrs per cell).
function VTerm:getRowCells(row)
  local cells = {}
  for c = 0, self._cols - 1 do
    cells[c + 1] = self:getCell(row, c)
  end
  return cells
end

--- Get terminal dimensions.
function VTerm:size()
  return self._rows, self._cols
end

--- Get the number of scrollback lines stored.
function VTerm:scrollbackCount()
  return #self._scrollback
end

--- Get a scrollback row's cells (1-indexed from oldest).
--- Returns array of { char, fg, bg, bold } or nil.
function VTerm:getScrollbackRow(idx)
  return self._scrollback[idx]
end

--- Free the virtual terminal.
function VTerm:free()
  if self._vt ~= nil then
    _instances[self._id] = nil
    lib.vterm_free(self._vt)
    self._vt = nil
    self._screen = nil
  end
end

io.write("[vterm] libvterm FFI + shim loaded (v0.5 — damage callbacks via C shim)\n"); io.flush()

return VTerm
