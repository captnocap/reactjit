--[[
  process.lua — Bidirectional process spawning via LuaJIT FFI

  io.popen() is unidirectional. This module uses fork/exec/pipe to get
  both stdin writes and non-blocking stdout reads from a child process.

  Usage:
    local Process = require("lua.process")

    local proc = Process.spawn("claude", {
      "-p", "--verbose",
      "--output-format", "stream-json",
    }, {
      cwd = "/path/to/project",
      env = { KEY = "value" },
    })

    -- Non-blocking: drains all available data, returns string or nil
    local data = proc:read()

    -- Write to stdin
    proc:write('{"type":"user"}\n')

    -- Lifecycle
    local running = proc:alive()
    proc:kill()
    proc:close()
]]

local ffi = require("ffi")
local bit = require("bit")

-- ── FFI declarations ─────────────────────────────────────────────────

ffi.cdef[[
  // Pipes
  int pipe(int pipefd[2]);

  // Process control
  int fork(void);
  int dup2(int oldfd, int newfd);
  int close(int fd);
  int execvp(const char *file, char *const argv[]);
  int chdir(const char *path);
  void _exit(int status);

  // I/O
  ssize_t read(int fd, void *buf, size_t count);
  ssize_t write(int fd, const void *buf, size_t count);

  // Process lifecycle
  int waitpid(int pid, int *status, int options);
  int kill(int pid, int sig);

  // Non-blocking I/O
  int fcntl(int fd, int cmd, ...);

  // Environment
  int setenv(const char *name, const char *value, int overwrite);
  int unsetenv(const char *name);

  // Error reporting
  char *strerror(int errnum);
  int *__errno_location(void);
]]

-- ── Constants ────────────────────────────────────────────────────────

local F_GETFL    = 3
local F_SETFL    = 4
local O_NONBLOCK = 2048   -- Linux: 0x800
local WNOHANG    = 1
local SIGTERM    = 15
local SIGKILL    = 9
local EAGAIN     = 11     -- Resource temporarily unavailable

local READ_BUF_SIZE = 8192

-- ── Helpers ──────────────────────────────────────────────────────────

local function errno()
  return ffi.C.__errno_location()[0]
end

local function strerror(errnum)
  return ffi.string(ffi.C.strerror(errnum))
end

-- ── Process object ───────────────────────────────────────────────────

local Process = {}
Process.__index = Process

--- Non-blocking read. Drains ALL available data from stdout.
--- Returns string if data available, nil if nothing to read.
function Process:read()
  if self._closed or self._stdout_fd < 0 then return nil end

  local chunks = {}
  local total = 0

  while true do
    local n = ffi.C.read(self._stdout_fd, self._read_buf, READ_BUF_SIZE)

    if n > 0 then
      chunks[#chunks + 1] = ffi.string(self._read_buf, n)
      total = total + n
    elseif n == 0 then
      -- EOF — process closed its stdout
      break
    else
      local err = errno()
      if err == EAGAIN then
        -- No more data right now (non-blocking)
        break
      else
        -- Real error
        io.write("[process] read error: " .. strerror(err) .. "\n"); io.flush()
        break
      end
    end
  end

  if total == 0 then return nil end
  return table.concat(chunks)
end

--- Write data to the process stdin.
function Process:write(data)
  if self._closed or self._stdin_fd < 0 then
    return false, "process closed"
  end

  local buf = ffi.cast("const char*", data)
  local len = #data
  local written = 0

  while written < len do
    local n = ffi.C.write(self._stdin_fd, buf + written, len - written)
    if n < 0 then
      local err = errno()
      if err == EAGAIN then
        -- Stdin buffer full, try again (rare for pipes)
      else
        io.write("[process] write error: " .. strerror(err) .. "\n"); io.flush()
        return false, strerror(err)
      end
    else
      written = written + n
    end
  end

  return true
end

--- Check if process is still running (non-blocking).
function Process:alive()
  if self._closed then return false end
  if self._exited then return false end

  local status = ffi.new("int[1]")
  local ret = ffi.C.waitpid(self._pid, status, WNOHANG)

  if ret == 0 then
    -- Still running
    return true
  elseif ret == self._pid then
    -- Exited
    self._exited = true
    self._exit_code = bit.rshift(status[0], 8)
    return false
  else
    -- Error (process doesn't exist)
    self._exited = true
    return false
  end
end

--- Get exit code (only valid after alive() returns false).
function Process:exitCode()
  return self._exit_code
end

--- Send SIGTERM to the process.
function Process:kill(signal)
  if self._closed or self._exited then return end
  ffi.C.kill(self._pid, signal or SIGTERM)
end

--- Close all file descriptors and wait for process exit.
function Process:close()
  if self._closed then return end
  self._closed = true

  -- Close stdin (signals EOF to child)
  if self._stdin_fd >= 0 then
    ffi.C.close(self._stdin_fd)
    self._stdin_fd = -1
  end

  -- Close stdout
  if self._stdout_fd >= 0 then
    ffi.C.close(self._stdout_fd)
    self._stdout_fd = -1
  end

  -- Reap child if not already reaped
  if not self._exited then
    local status = ffi.new("int[1]")
    -- Try non-blocking first
    local ret = ffi.C.waitpid(self._pid, status, WNOHANG)
    if ret == 0 then
      -- Still running — kill and wait
      ffi.C.kill(self._pid, SIGTERM)
      -- Brief spin wait (don't block the game loop for long)
      for _ = 1, 100 do
        ret = ffi.C.waitpid(self._pid, status, WNOHANG)
        if ret ~= 0 then break end
      end
      if ret == 0 then
        -- Force kill
        ffi.C.kill(self._pid, SIGKILL)
        ffi.C.waitpid(self._pid, status, 0) -- blocking wait
      end
    end
    self._exited = true
    self._exit_code = bit.rshift(status[0], 8)
  end
end

-- ── Module ───────────────────────────────────────────────────────────

local M = {}

--- Spawn a new process with bidirectional pipes.
--- @param cmd string      Executable name (resolved via PATH)
--- @param args string[]   Command-line arguments
--- @param opts table?     { cwd = string?, env = table?, unsetEnv = string[]? }
--- @return Process
function M.spawn(cmd, args, opts)
  opts = opts or {}
  args = args or {}

  -- Create pipes: [0]=read, [1]=write
  local stdin_pipe  = ffi.new("int[2]")
  local stdout_pipe = ffi.new("int[2]")

  if ffi.C.pipe(stdin_pipe) ~= 0 then
    error("[process] pipe(stdin) failed: " .. strerror(errno()))
  end
  if ffi.C.pipe(stdout_pipe) ~= 0 then
    ffi.C.close(stdin_pipe[0])
    ffi.C.close(stdin_pipe[1])
    error("[process] pipe(stdout) failed: " .. strerror(errno()))
  end

  local pid = ffi.C.fork()

  if pid < 0 then
    -- Fork failed
    ffi.C.close(stdin_pipe[0]); ffi.C.close(stdin_pipe[1])
    ffi.C.close(stdout_pipe[0]); ffi.C.close(stdout_pipe[1])
    error("[process] fork() failed: " .. strerror(errno()))

  elseif pid == 0 then
    -- ── CHILD PROCESS ──────────────────────────────────────────

    -- Close parent's ends
    ffi.C.close(stdin_pipe[1])   -- parent writes to this
    ffi.C.close(stdout_pipe[0])  -- parent reads from this

    -- Redirect stdin
    ffi.C.dup2(stdin_pipe[0], 0)
    ffi.C.close(stdin_pipe[0])

    -- Redirect stdout
    ffi.C.dup2(stdout_pipe[1], 1)

    -- Redirect stderr to stdout (merge streams)
    ffi.C.dup2(stdout_pipe[1], 2)
    ffi.C.close(stdout_pipe[1])

    -- Change working directory
    if opts.cwd then
      ffi.C.chdir(opts.cwd)
    end

    -- Set environment variables
    if opts.env then
      for k, v in pairs(opts.env) do
        if v == "" or v == false then
          ffi.C.unsetenv(k)
        else
          ffi.C.setenv(k, tostring(v), 1)
        end
      end
    end

    -- Unset problematic env vars
    if opts.unsetEnv then
      for _, k in ipairs(opts.unsetEnv) do
        ffi.C.unsetenv(k)
      end
    end

    -- Always unset CLAUDECODE to avoid nested session guard
    ffi.C.unsetenv("CLAUDECODE")

    -- Build argv for execvp: [cmd, args..., NULL]
    local argc = 1 + #args
    local argv = ffi.new("const char*[?]", argc + 1)
    argv[0] = ffi.cast("const char*", cmd)
    for i, arg in ipairs(args) do
      argv[i] = ffi.cast("const char*", arg)
    end
    argv[argc] = nil -- NULL terminator

    ffi.C.execvp(cmd, ffi.cast("char *const *", argv))

    -- If we get here, exec failed
    io.write("[process] execvp failed: " .. strerror(errno()) .. "\n"); io.flush()
    ffi.C._exit(127)
  end

  -- ── PARENT PROCESS ─────────────────────────────────────────

  -- Close child's ends
  ffi.C.close(stdin_pipe[0])   -- child reads from this
  ffi.C.close(stdout_pipe[1])  -- child writes to this

  -- Set stdout to non-blocking
  -- NOTE: fcntl is variadic — LuaJIT passes Lua numbers as doubles in vararg
  -- positions, but fcntl expects int. Must cast explicitly or O_NONBLOCK is lost.
  local flags = ffi.C.fcntl(stdout_pipe[0], F_GETFL)
  if flags < 0 then
    io.write("[process] fcntl(F_GETFL) failed: " .. strerror(errno()) .. "\n"); io.flush()
  end
  local ret = ffi.C.fcntl(stdout_pipe[0], F_SETFL, ffi.cast("int", bit.bor(flags, O_NONBLOCK)))
  if ret < 0 then
    io.write("[process] fcntl(F_SETFL) failed: " .. strerror(errno()) .. "\n"); io.flush()
  end

  -- Create process object
  local proc = setmetatable({
    _pid       = pid,
    _stdin_fd  = stdin_pipe[1],
    _stdout_fd = stdout_pipe[0],
    _read_buf  = ffi.new("char[?]", READ_BUF_SIZE),
    _closed    = false,
    _exited    = false,
    _exit_code = nil,
  }, Process)

  io.write("[process] spawned PID " .. pid .. ": " .. cmd .. " " .. table.concat(args, " ") .. "\n"); io.flush()

  return proc
end

return M
