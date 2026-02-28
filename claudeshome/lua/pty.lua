--[[
  pty.lua — Non-blocking PTY (pseudo-terminal) via LuaJIT FFI

  Opens a PTY master/slave pair, forks a shell into the slave, and provides
  non-blocking bidirectional I/O via the master fd.

  Unlike plain pipes, a PTY gives shells proper terminal behavior: readline
  editing, color output, Ctrl+C handling, job control, cursor movement.
  Programs use isatty() to detect they're in a real terminal — this passes
  that check.

  The correct POSIX sequence (what all previous attempts missed):
    1. posix_openpt(O_RDWR|O_NOCTTY|O_CLOEXEC)  — open master
    2. grantpt(master) + unlockpt(master)          — prepare slave
    3. ptsname_r(master)                           — get /dev/pts/N
    4. fork()
    5. child: close(master) → setsid() → open(slave) → ioctl(TIOCSCTTY)
              → dup2 stdio → execvp(shell)
    6. parent: TIOCSWINSZ → fcntl(O_NONBLOCK) → read/write loop

  Usage:
    local PTY = require("lua.pty")

    local pty, err = PTY.open({
      shell = "bash",           -- or "zsh"
      args  = { "--login" },    -- optional
      cwd   = "/home/user",
      env   = { MY_VAR = "hi", TERM = "xterm-256color" },
      rows  = 24,
      cols  = 80,
    })

    -- Per-frame (non-blocking): drain all available output
    local data = pty:read()   -- returns string or nil

    -- Send keystrokes / commands to the shell
    pty:write("ls -la\n")
    pty:write("\x03")          -- Ctrl+C
    pty:write("\x04")          -- Ctrl+D (EOF / logout)

    -- Resize (send SIGWINCH to shell)
    pty:resize(30, 120)

    -- Lifecycle
    if not pty:alive() then
      print("exited with:", pty:exitCode())
    end
    pty:close()

  Requirements:
    Linux glibc (posix_openpt, ptsname_r, setsid are glibc/POSIX extensions)
    LuaJIT 2.x with FFI
]]

local ffi = require("ffi")
local bit = require("bit")

-- ── FFI declarations ──────────────────────────────────────────────────────────

-- Guard each cdef block with pcall so we don't re-declare types/functions
-- that Love2D or another module already registered.

pcall(ffi.cdef, [[
  typedef int    pid_t;
  typedef long   ssize_t;
]])

pcall(ffi.cdef, [[
  // File I/O
  int     open(const char *path, int flags, ...);
  int     close(int fd);
  ssize_t read(int fd, void *buf, size_t n);
  ssize_t write(int fd, const void *buf, size_t n);
  int     dup2(int oldfd, int newfd);
  int     fcntl(int fd, int cmd, ...);
]])

pcall(ffi.cdef, [[
  // Process
  pid_t  fork(void);
  void   _exit(int status);
  int    execvp(const char *file, char *const argv[]);
  pid_t  setsid(void);
  int    chdir(const char *path);
  int    setenv(const char *name, const char *value, int overwrite);
  int    unsetenv(const char *name);
  int    waitpid(int pid, int *status, int options);
  int    kill(int pid, int sig);
]])

pcall(ffi.cdef, [[
  // PTY
  int    posix_openpt(int flags);
  int    grantpt(int fd);
  int    unlockpt(int fd);
  int    ptsname_r(int fd, char *buf, size_t buflen);
]])

pcall(ffi.cdef, [[
  struct winsize {
    unsigned short ws_row;
    unsigned short ws_col;
    unsigned short ws_xpixel;
    unsigned short ws_ypixel;
  };
]])

pcall(ffi.cdef, [[
  int ioctl(int fd, unsigned long request, ...);
]])

pcall(ffi.cdef, [[
  int  *__errno_location(void);
  char *strerror(int errnum);
]])

-- termios for disabling echo on the PTY master
pcall(ffi.cdef, [[
  typedef unsigned int  tcflag_t;
  typedef unsigned char cc_t;
  typedef unsigned int  speed_t;

  struct termios {
    tcflag_t c_iflag;
    tcflag_t c_oflag;
    tcflag_t c_cflag;
    tcflag_t c_lflag;
    cc_t     c_line;
    cc_t     c_cc[32];
    speed_t  c_ispeed;
    speed_t  c_ospeed;
  };

  int tcgetattr(int fd, struct termios *termios_p);
  int tcsetattr(int fd, int optional_actions, const struct termios *termios_p);
  void cfmakeraw(struct termios *termios_p);
]])

-- ── Linux x86-64 constants ────────────────────────────────────────────────────

local O_RDWR      = 2
local O_NOCTTY    = 0x400      -- don't assign as controlling terminal when opening master
local O_CLOEXEC   = 0x80000    -- close-on-exec so master doesn't leak into child
local O_NONBLOCK  = 0x800
local F_GETFL     = 3
local F_SETFL     = 4
local TIOCSCTTY   = 0x540E     -- set controlling terminal (arg = 0: only if none)
local TIOCSWINSZ  = 0x5414     -- set window size
local WNOHANG     = 1
local SIGTERM     = 15
local SIGKILL     = 9
local EAGAIN      = 11
local EINTR       = 4
local ECHO        = 0x0008    -- termios c_lflag: echo input
local ICANON      = 0x0002    -- termios c_lflag: canonical (line-buffered) mode
local ISIG        = 0x0001    -- termios c_lflag: signal generation (Ctrl+C → SIGINT)
local IEXTEN      = 0x8000    -- termios c_lflag: extended input processing
local OPOST       = 0x0001    -- termios c_oflag: output post-processing (\n → \r\n)
local TCSANOW     = 0         -- tcsetattr: apply changes immediately
local EIO         = 5          -- returned on master read when all slaves closed

local READ_BUF = 4096

-- ── Helpers ───────────────────────────────────────────────────────────────────

local function errno()
  return ffi.C.__errno_location()[0]
end

local function strerror(e)
  return ffi.string(ffi.C.strerror(e or errno()))
end

-- ── PTY object ────────────────────────────────────────────────────────────────

local PTY = {}
PTY.__index = PTY

--- Non-blocking drain: returns all currently available output as a string, or nil.
--- Safe to call every frame — returns nil immediately when no data is ready.
function PTY:read()
  if self._closed or self._masterfd < 0 then return nil end

  local buf    = ffi.new("char[?]", READ_BUF)
  local chunks = {}

  while true do
    local n = ffi.C.read(self._masterfd, buf, READ_BUF)
    if n > 0 then
      chunks[#chunks + 1] = ffi.string(buf, n)
    elseif n == 0 then
      -- EOF: slave side closed
      self._child_exited = true
      break
    else
      local e = errno()
      if e == EAGAIN or e == EINTR then
        break  -- no more data right now; check again next frame
      elseif e == EIO then
        -- All slave fds closed (normal after child exits)
        self._child_exited = true
        break
      else
        io.write(string.format("[pty] read error (errno=%d): %s\n", e, strerror(e)))
        io.flush()
        break
      end
    end
  end

  if #chunks == 0 then return nil end
  return table.concat(chunks)
end

--- Write raw bytes to the PTY master (sent as keyboard input to the shell).
--- Returns true on success, false on error.
function PTY:write(data)
  if self._closed or self._masterfd < 0 then return false end
  if not data or #data == 0 then return true end

  local buf     = ffi.cast("const char*", data)
  local len     = #data
  local written = 0

  while written < len do
    local n = ffi.C.write(self._masterfd, buf + written, len - written)
    if n < 0 then
      local e = errno()
      if e == EAGAIN or e == EINTR then
        -- Retry (rare for PTY master — it has large buffers)
      elseif e == EIO then
        self._child_exited = true
        return false
      else
        io.write(string.format("[pty] write error (errno=%d): %s\n", e, strerror(e)))
        io.flush()
        return false
      end
    else
      written = written + n
    end
  end

  return true
end

--- Update the terminal window size and send SIGWINCH to the shell.
--- Call this when the display area for the terminal changes.
function PTY:resize(rows, cols)
  if self._closed or self._masterfd < 0 then return end
  local ws = ffi.new("struct winsize")
  ws.ws_row    = rows or 24
  ws.ws_col    = cols or 80
  ws.ws_xpixel = 0
  ws.ws_ypixel = 0
  ffi.C.ioctl(self._masterfd, TIOCSWINSZ, ffi.cast("void*", ws))
end

--- Non-blocking liveness check. Returns false once the child has exited.
function PTY:alive()
  if self._closed  then return false end
  if self._exited  then return false end

  -- If we detected EIO/EOF during read, try to reap the zombie now
  if self._child_exited then
    local status = ffi.new("int[1]")
    local ret = ffi.C.waitpid(self._pid, status, WNOHANG)
    if ret == self._pid or ret < 0 then
      self._exited    = true
      self._exit_code = bit.rshift(status[0], 8)
      return false
    end
    return true  -- exited but not yet reaped (timing window)
  end

  local status = ffi.new("int[1]")
  local ret = ffi.C.waitpid(self._pid, status, WNOHANG)
  if ret == 0 then
    return true
  elseif ret == self._pid then
    self._exited    = true
    self._exit_code = bit.rshift(status[0], 8)
    return false
  else
    self._exited = true
    return false
  end
end

--- Exit code (only valid after alive() returns false).
function PTY:exitCode()
  return self._exit_code
end

--- Send a signal to the child (default: SIGTERM).
function PTY:kill(sig)
  if self._closed or self._exited then return end
  ffi.C.kill(self._pid, sig or SIGTERM)
end

--- Close the PTY and reap the child process.
--- Safe to call multiple times.
function PTY:close()
  if self._closed then return end
  self._closed = true

  -- Closing master sends SIGHUP to the child's process group
  if self._masterfd >= 0 then
    ffi.C.close(self._masterfd)
    self._masterfd = -1
  end

  if not self._exited then
    local status = ffi.new("int[1]")
    local ret = ffi.C.waitpid(self._pid, status, WNOHANG)
    if ret == 0 then
      -- Child still running: SIGTERM, then SIGKILL
      ffi.C.kill(self._pid, SIGTERM)
      for _ = 1, 200 do
        ret = ffi.C.waitpid(self._pid, status, WNOHANG)
        if ret ~= 0 then break end
      end
      if ret == 0 then
        ffi.C.kill(self._pid, SIGKILL)
        ffi.C.waitpid(self._pid, status, 0)  -- blocking final reap
      end
    end
    self._exited    = true
    self._exit_code = bit.rshift(status[0], 8)
  end
end

-- ── Module API ────────────────────────────────────────────────────────────────

local M = {}

---Open a new PTY and fork a shell into it.
---
--- @param opts table
---   shell     string    Shell executable ("bash", "zsh", ...)
---   args      string[]  Extra args to the shell (e.g. {"--login"})
---   cwd       string?   Working directory for the child
---   env       table?    Environment overrides { KEY = "value" | false }
---   rows      number?   Initial rows (default: 24)
---   cols      number?   Initial columns (default: 80)
---
--- @return PTY|nil, string?  PTY object, or nil + error message
function M.open(opts)
  opts  = opts  or {}
  local shell = opts.shell or "bash"
  local args  = opts.args  or {}
  local rows  = opts.rows  or 24
  local cols  = opts.cols  or 80

  -- ── 1. Open PTY master ──────────────────────────────────────────────────────
  local masterfd = ffi.C.posix_openpt(bit.bor(O_RDWR, O_NOCTTY, O_CLOEXEC))
  if masterfd < 0 then
    return nil, "posix_openpt failed: " .. strerror()
  end

  -- ── 2. Grant and unlock slave ───────────────────────────────────────────────
  if ffi.C.grantpt(masterfd) ~= 0 then
    ffi.C.close(masterfd)
    return nil, "grantpt failed: " .. strerror()
  end
  if ffi.C.unlockpt(masterfd) ~= 0 then
    ffi.C.close(masterfd)
    return nil, "unlockpt failed: " .. strerror()
  end

  -- ── 3. Get slave device name (/dev/pts/N) ───────────────────────────────────
  local namebuf = ffi.new("char[64]")
  if ffi.C.ptsname_r(masterfd, namebuf, 64) ~= 0 then
    ffi.C.close(masterfd)
    return nil, "ptsname_r failed: " .. strerror()
  end
  local slavename = ffi.string(namebuf)

  -- ── 4. Fork ─────────────────────────────────────────────────────────────────
  local pid = ffi.C.fork()

  if pid < 0 then
    ffi.C.close(masterfd)
    return nil, "fork failed: " .. strerror()

  elseif pid == 0 then
    -- ── CHILD ─────────────────────────────────────────────────────────────────
    -- O_CLOEXEC handles master cleanup on exec, but close early just in case
    ffi.C.close(masterfd)

    -- CRITICAL: create new session before opening slave.
    -- Without setsid(), TIOCSCTTY will fail because we're still in the parent's
    -- session and process group.
    if ffi.C.setsid() < 0 then
      ffi.C._exit(1)
    end

    -- Open slave PTY (use the namebuf directly — it's still valid in child)
    local slavefd = ffi.C.open(namebuf, O_RDWR, ffi.cast("int", 0))
    if slavefd < 0 then
      ffi.C._exit(1)
    end

    -- CRITICAL: set slave as the controlling terminal for this session.
    -- This enables job control, Ctrl+C delivery, etc.
    -- arg=0 means "only acquire if session has no controlling terminal yet"
    ffi.C.ioctl(slavefd, TIOCSCTTY, ffi.cast("int", 0))

    -- Redirect stdin/stdout/stderr to the slave PTY
    ffi.C.dup2(slavefd, 0)
    ffi.C.dup2(slavefd, 1)
    ffi.C.dup2(slavefd, 2)
    if slavefd > 2 then ffi.C.close(slavefd) end

    -- Put slave into raw mode: kills echo, canonical mode, signal processing.
    -- Claude still sees isatty()=true (permissions work), but the PTY won't
    -- echo writes back or do line buffering. Re-enable OPOST so \n → \r\n
    -- translation is preserved — the line parser needs \n delimiters.
    local tios = ffi.new("struct termios")
    if ffi.C.tcgetattr(0, tios) == 0 then
      ffi.C.cfmakeraw(tios)
      tios.c_oflag = bit.bor(tios.c_oflag, OPOST)
      ffi.C.tcsetattr(0, TCSANOW, tios)
    end

    -- Working directory
    if opts.cwd then ffi.C.chdir(opts.cwd) end

    -- Environment overrides
    if opts.env then
      for k, v in pairs(opts.env) do
        if v == false or v == nil then
          ffi.C.unsetenv(k)
        else
          ffi.C.setenv(k, tostring(v), 1)
        end
      end
    end

    -- Ensure TERM is set; don't clobber if caller already set it
    ffi.C.setenv("TERM", "xterm-256color", 0)

    -- Build argv: [shell, args..., NULL]
    local argc = 1 + #args
    local argv = ffi.new("const char*[?]", argc + 1)
    argv[0] = ffi.cast("const char*", shell)
    for i, a in ipairs(args) do
      argv[i] = ffi.cast("const char*", a)
    end
    argv[argc] = nil

    ffi.C.execvp(shell, ffi.cast("char*const*", argv))

    -- Only reached if exec failed
    ffi.C._exit(127)
  end

  -- ── PARENT ───────────────────────────────────────────────────────────────────

  -- Set initial window size BEFORE the child renders its first prompt
  local ws = ffi.new("struct winsize")
  ws.ws_row = rows
  ws.ws_col = cols
  ffi.C.ioctl(masterfd, TIOCSWINSZ, ffi.cast("void*", ws))

  -- Set master to non-blocking so read() returns EAGAIN when no data is ready
  local flags = ffi.C.fcntl(masterfd, F_GETFL)
  if flags >= 0 then
    ffi.C.fcntl(masterfd, F_SETFL, ffi.cast("int", bit.bor(flags, O_NONBLOCK)))
  end

  local pty = setmetatable({
    _pid          = pid,
    _masterfd     = masterfd,
    _closed       = false,
    _exited       = false,
    _exit_code    = nil,
    _child_exited = false,
  }, PTY)

  io.write(string.format("[pty] PID=%d  slave=%s  shell=%s\n", pid, slavename, shell))
  io.flush()

  return pty
end

return M
