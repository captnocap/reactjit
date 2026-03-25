// LuaJIT Worker Shim — embeds a LuaJIT VM on a background pthread
// with atomic message counting for bridge stress testing.
//
// The worker runs a tight Lua loop processing messages.
// Main thread sends non-blocking, polls results each frame.

#include <lua.h>
#include <lauxlib.h>
#include <lualib.h>
#include <pthread.h>
#include <stdatomic.h>
#include <time.h>
#include <stdio.h>

// ── Shared state (atomic) ──────────────────────────────────────────────

static atomic_long g_inbox = 0;       // messages sent TO worker
static atomic_long g_outbox = 0;      // messages processed BY worker
static atomic_long g_bridge_n = 10;   // messages per frame
static atomic_int  g_running = 0;     // worker alive flag
static atomic_long g_send_time_ns = 0; // timestamp of last send
static atomic_long g_recv_time_ns = 0; // timestamp of last worker ack

static long clock_ns(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1000000000L + t.tv_nsec;
}

// ── Lua host functions ─────────────────────────────────────────────────

static int l_host_recv(lua_State *L) {
    long pending = atomic_load(&g_inbox);
    long processed = atomic_load(&g_outbox);
    long available = pending - processed;
    lua_pushinteger(L, available);
    return 1;
}

static int l_host_ack(lua_State *L) {
    long count = luaL_checkinteger(L, 1);
    atomic_fetch_add(&g_outbox, count);
    atomic_store(&g_recv_time_ns, clock_ns());
    return 0;
}

static int l_host_running(lua_State *L) {
    lua_pushboolean(L, atomic_load(&g_running));
    return 1;
}

// ── Worker thread ──────────────────────────────────────────────────────

static void *worker_main(void *arg) {
    (void)arg;

    lua_State *L = luaL_newstate();
    if (!L) {
        fprintf(stderr, "[lua-worker] Failed to create Lua state\n");
        return NULL;
    }
    luaL_openlibs(L);

    lua_pushcfunction(L, l_host_recv);
    lua_setglobal(L, "host_recv");
    lua_pushcfunction(L, l_host_ack);
    lua_setglobal(L, "host_ack");
    lua_pushcfunction(L, l_host_running);
    lua_setglobal(L, "host_running");

    // Worker: process messages in a tight loop
    const char *script =
        "while host_running() do\n"
        "  local avail = host_recv()\n"
        "  if avail > 0 then\n"
        "    for i = 1, avail do\n"
        "      local sum = 0\n"
        "      for j = 1, 100 do\n"
        "        sum = sum + j * j\n"
        "      end\n"
        "    end\n"
        "    host_ack(avail)\n"
        "  end\n"
        "end\n";

    if (luaL_dostring(L, script) != 0) {
        fprintf(stderr, "[lua-worker] Lua error: %s\n", lua_tostring(L, -1));
    }

    lua_close(L);
    return NULL;
}

// ── Public API ─────────────────────────────────────────────────────────

static pthread_t g_thread;

long lua_worker_start(void) {
    if (atomic_load(&g_running)) return 0;
    atomic_store(&g_running, 1);
    atomic_store(&g_inbox, 0);
    atomic_store(&g_outbox, 0);
    pthread_create(&g_thread, NULL, worker_main, NULL);
    return 1;
}

// Non-blocking send — fires N messages, returns total inbox count
long lua_worker_send(long count) {
    long n = (count > 0) ? count : atomic_load(&g_bridge_n);
    long total = atomic_fetch_add(&g_inbox, n) + n;
    atomic_store(&g_send_time_ns, clock_ns());
    return total;
}

// How many total messages the worker has processed
long lua_worker_recv_count(void) {
    return atomic_load(&g_outbox);
}

// Current N setting
long lua_worker_bridge_n(void) {
    return atomic_load(&g_bridge_n);
}

// Set N (escalation)
long lua_worker_set_n(long n) {
    atomic_store(&g_bridge_n, n);
    return n;
}

// Round-trip latency: time between last send and last worker ack (microseconds)
long lua_worker_elapsed_us(void) {
    long send_t = atomic_load(&g_send_time_ns);
    long recv_t = atomic_load(&g_recv_time_ns);
    if (recv_t > send_t) return (recv_t - send_t) / 1000;
    return 0; // worker hasn't caught up yet
}
