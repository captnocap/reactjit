/*
 * vterm_shim.c — Thin ABI bridge between libvterm callbacks and LuaJIT FFI
 *
 * LuaJIT callbacks cannot receive structs by value (VTermRect, VTermPos).
 * This shim registers itself as libvterm's callback target, unwraps the
 * structs into flat ints, and forwards to LuaJIT-compatible function pointers.
 *
 * Build:
 *   gcc -shared -fPIC -o libvterm_shim.so vterm_shim.c -lvterm
 *
 * The shim is ~60 lines of C. It exists solely to cross the ABI boundary.
 */

#include <vterm.h>
#include <stdint.h>

/* ── LuaJIT-friendly callback typedefs (all scalar args) ──────────── */

typedef int (*lua_damage_cb)(int start_row, int end_row, int start_col, int end_col, void *user);
typedef int (*lua_moverect_cb)(int dest_sr, int dest_er, int dest_sc, int dest_ec,
                               int src_sr, int src_er, int src_sc, int src_ec, void *user);
typedef int (*lua_movecursor_cb)(int row, int col, int old_row, int old_col, int visible, void *user);
typedef int (*lua_settermprop_cb)(int prop, int intval, void *user);
typedef int (*lua_bell_cb)(void *user);
typedef int (*lua_sb_pushline_cb)(int cols, void *user);

/* ── Stored LuaJIT callbacks (set by vterm_shim_set_callbacks) ────── */

static lua_damage_cb        g_damage       = NULL;
static lua_moverect_cb      g_moverect     = NULL;
static lua_movecursor_cb    g_movecursor   = NULL;
static lua_settermprop_cb   g_settermprop  = NULL;
static lua_bell_cb          g_bell         = NULL;
static lua_sb_pushline_cb   g_sb_pushline  = NULL;

/* ── libvterm callback implementations (unwrap structs) ───────────── */

static int shim_damage(VTermRect rect, void *user) {
    if (g_damage) return g_damage(rect.start_row, rect.end_row, rect.start_col, rect.end_col, user);
    return 0;
}

static int shim_moverect(VTermRect dest, VTermRect src, void *user) {
    if (g_moverect) return g_moverect(
        dest.start_row, dest.end_row, dest.start_col, dest.end_col,
        src.start_row, src.end_row, src.start_col, src.end_col, user);
    return 0;
}

static int shim_movecursor(VTermPos pos, VTermPos oldpos, int visible, void *user) {
    if (g_movecursor) return g_movecursor(pos.row, pos.col, oldpos.row, oldpos.col, visible, user);
    return 0;
}

static int shim_settermprop(VTermProp prop, VTermValue *val, void *user) {
    if (g_settermprop) {
        /* Extract int from union — works for boolean, number, and enum props */
        int intval = val ? val->boolean : 0;
        return g_settermprop((int)prop, intval, user);
    }
    return 0;
}

static int shim_bell(void *user) {
    if (g_bell) return g_bell(user);
    return 0;
}

static int shim_sb_pushline(int cols, const VTermScreenCell *cells, void *user) {
    if (g_sb_pushline) return g_sb_pushline(cols, user);
    return 0;
}

/* ── The callbacks struct (static, lives forever) ─────────────────── */

static VTermScreenCallbacks shim_callbacks = {
    .damage      = shim_damage,
    .moverect    = shim_moverect,
    .movecursor  = shim_movecursor,
    .settermprop = shim_settermprop,
    .bell        = shim_bell,
    .resize      = NULL,
    .sb_pushline = shim_sb_pushline,
    .sb_popline  = NULL,
    .sb_clear    = NULL,
};

/* ── Public API for LuaJIT ────────────────────────────────────────── */

/* Set LuaJIT-friendly callbacks. Call before vterm_shim_register. */
void vterm_shim_set_callbacks(
    lua_damage_cb       damage,
    lua_moverect_cb     moverect,
    lua_movecursor_cb   movecursor,
    lua_settermprop_cb  settermprop,
    lua_bell_cb         bell,
    lua_sb_pushline_cb  sb_pushline
) {
    g_damage      = damage;
    g_moverect    = moverect;
    g_movecursor  = movecursor;
    g_settermprop = settermprop;
    g_bell        = bell;
    g_sb_pushline = sb_pushline;
}

/* Register the shim as libvterm's screen callbacks for the given screen. */
void vterm_shim_register(VTermScreen *screen, void *user) {
    vterm_screen_set_callbacks(screen, &shim_callbacks, user);
}
