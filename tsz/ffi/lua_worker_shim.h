#ifndef LUA_WORKER_SHIM_H
#define LUA_WORKER_SHIM_H

// LuaJIT worker thread — spawns a Lua VM on a background thread
// with message-passing bridge to the main thread.

long lua_worker_start(void);
long lua_worker_send(long count);
long lua_worker_recv_count(void);
long lua_worker_bridge_n(void);
long lua_worker_set_n(long n);
long lua_worker_elapsed_us(void);

#endif
