#ifndef PTY_CLIENT_H
#define PTY_CLIENT_H

/* PTY remote client — connects to supervisor.sock (framework/pty_client.zig)
   All functions use long params/returns to match the .tsz compiler's FFI codegen.
   String-returning functions are registered as QJS host functions directly. */

long pty_client_connect(void);
long pty_client_disconnect(void);
long pty_client_connected(void);
/* pty_client_send(json_string) returns response string — QJS host function only */

#endif
