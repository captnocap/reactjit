--[[
  gpio/serial.lua — LuaJIT FFI bindings to POSIX termios

  Serial/UART communication for microcontrollers (Arduino, ESP32, Pico)
  and any serial device. Uses standard POSIX termios — no external deps,
  works on every Linux system.

  Usage:
    local serial = require("lua.gpio.serial")
    local port = serial.open("/dev/ttyUSB0", 115200)
    serial.write(port, "hello\n")
    local line = serial.readLine(port)
    serial.close(port)
]]

local ffi = require("ffi")
local bit = require("bit")

-- ── FFI declarations ────────────────────────────────────────

ffi.cdef[[
  // termios struct (Linux x86_64 / aarch64)
  typedef unsigned int tcflag_t;
  typedef unsigned char cc_t;
  typedef unsigned int speed_t;

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

  int open(const char *pathname, int flags);
  int close(int fd);
  long read(int fd, void *buf, size_t count);
  long write(int fd, const void *buf, size_t count);
  int tcgetattr(int fd, struct termios *termios_p);
  int tcsetattr(int fd, int optional_actions, const struct termios *termios_p);
  int cfsetispeed(struct termios *termios_p, speed_t speed);
  int cfsetospeed(struct termios *termios_p, speed_t speed);
  int tcflush(int fd, int queue_selector);
  int fcntl(int fd, int cmd, int arg);

  typedef struct { int fd; short events; short revents; } serial_pollfd_t;
  int poll(serial_pollfd_t *fds, unsigned long nfds, int timeout);

  char *strerror(int errnum);
  int *__errno_location(void);
]]

-- ── Constants ───────────────────────────────────────────────

-- open flags
local O_RDWR   = 0x0002
local O_NOCTTY = 0x0100
local O_NONBLOCK = 0x0800

-- fcntl
local F_SETFL = 4
local F_GETFL = 3

-- tcsetattr
local TCSANOW = 0

-- tcflush
local TCIFLUSH  = 0
local TCOFLUSH  = 1
local TCIOFLUSH = 2

-- termios c_cflag
local CSIZE  = 0x0030
local CS5    = 0x0000
local CS6    = 0x0010
local CS7    = 0x0020
local CS8    = 0x0030
local CSTOPB = 0x0040
local CREAD  = 0x0080
local PARENB = 0x0100
local PARODD = 0x0200
local CLOCAL = 0x0800
local CRTSCTS = 0x80000000

-- termios c_iflag
local IGNPAR  = 0x0004
local ICRNL   = 0x0100
local IXON    = 0x0400
local IXOFF   = 0x1000
local IXANY   = 0x0800
local INPCK   = 0x0010
local ISTRIP  = 0x0020

-- termios c_oflag
local OPOST = 0x0001

-- termios c_lflag
local ICANON = 0x0002
local ECHO   = 0x0008
local ECHOE  = 0x0010
local ISIG   = 0x0001
local IEXTEN = 0x8000

-- c_cc indices
local VTIME = 5
local VMIN  = 6

-- poll
local POLLIN = 0x0001

-- Baud rate constants (Linux)
local BAUD_MAP = {
  [1200]    = 0x0009,  -- B1200
  [2400]    = 0x000B,  -- B2400
  [4800]    = 0x000C,  -- B4800
  [9600]    = 0x000D,  -- B9600
  [19200]   = 0x000E,  -- B19200
  [38400]   = 0x000F,  -- B38400
  [57600]   = 0x1001,  -- B57600
  [115200]  = 0x1002,  -- B115200
  [230400]  = 0x1003,  -- B230400
  [460800]  = 0x1004,  -- B460800
  [500000]  = 0x1005,  -- B500000
  [576000]  = 0x1006,  -- B576000
  [921600]  = 0x1007,  -- B921600
  [1000000] = 0x1008,  -- B1000000
  [1500000] = 0x100A,  -- B1500000
  [2000000] = 0x100B,  -- B2000000
}

-- ── Module ──────────────────────────────────────────────────

local serial = {}

local function getErrno()
  local ok, ptr = pcall(ffi.C.__errno_location)
  if not ok then return 0 end
  return ptr[0]
end

local function getError()
  return ffi.string(ffi.C.strerror(getErrno()))
end

--- Open and configure a serial port.
--- @param port string  device path, e.g. "/dev/ttyUSB0"
--- @param baud number  baud rate (default 9600)
--- @param opts table   { dataBits=8, stopBits=1, parity="none", flowControl="none" }
--- @return table  port handle { fd, readBuf, lineBuf }
function serial.open(port, baud, opts)
  baud = baud or 9600
  opts = opts or {}
  local dataBits = opts.dataBits or 8
  local stopBits = opts.stopBits or 1
  local parity = opts.parity or "none"
  local flowControl = opts.flowControl or "none"

  -- Open port
  local fd = ffi.C.open(port, bit.bor(O_RDWR, O_NOCTTY, O_NONBLOCK))
  if fd < 0 then
    error("serial: failed to open " .. port .. ": " .. getError())
  end

  -- Get current termios
  local tio = ffi.new("struct termios")
  if ffi.C.tcgetattr(fd, tio) ~= 0 then
    ffi.C.close(fd)
    error("serial: tcgetattr failed: " .. getError())
  end

  -- Set baud rate
  local baudConst = BAUD_MAP[baud]
  if not baudConst then
    ffi.C.close(fd)
    error("serial: unsupported baud rate: " .. baud)
  end
  ffi.C.cfsetispeed(tio, baudConst)
  ffi.C.cfsetospeed(tio, baudConst)

  -- Raw mode: disable canonical, echo, signals
  tio.c_lflag = bit.band(tio.c_lflag, bit.bnot(bit.bor(ICANON, ECHO, ECHOE, ISIG, IEXTEN)))
  tio.c_oflag = bit.band(tio.c_oflag, bit.bnot(OPOST))
  tio.c_iflag = bit.band(tio.c_iflag, bit.bnot(bit.bor(IXON, IXOFF, IXANY, ICRNL, INPCK, ISTRIP)))

  -- Data bits
  tio.c_cflag = bit.band(tio.c_cflag, bit.bnot(CSIZE))
  local csMap = { [5] = CS5, [6] = CS6, [7] = CS7, [8] = CS8 }
  tio.c_cflag = bit.bor(tio.c_cflag, csMap[dataBits] or CS8)

  -- Stop bits
  if stopBits == 2 then
    tio.c_cflag = bit.bor(tio.c_cflag, CSTOPB)
  else
    tio.c_cflag = bit.band(tio.c_cflag, bit.bnot(CSTOPB))
  end

  -- Parity
  if parity == "even" then
    tio.c_cflag = bit.bor(tio.c_cflag, PARENB)
    tio.c_cflag = bit.band(tio.c_cflag, bit.bnot(PARODD))
  elseif parity == "odd" then
    tio.c_cflag = bit.bor(tio.c_cflag, bit.bor(PARENB, PARODD))
  else
    tio.c_cflag = bit.band(tio.c_cflag, bit.bnot(PARENB))
  end

  -- Flow control
  if flowControl == "hardware" then
    tio.c_cflag = bit.bor(tio.c_cflag, CRTSCTS)
  else
    tio.c_cflag = bit.band(tio.c_cflag, bit.bnot(CRTSCTS))
  end

  -- Enable receiver, local mode
  tio.c_cflag = bit.bor(tio.c_cflag, bit.bor(CREAD, CLOCAL))

  -- Non-blocking: return immediately with whatever is available
  tio.c_cc[VMIN] = 0
  tio.c_cc[VTIME] = 0

  -- Apply
  ffi.C.tcflush(fd, TCIOFLUSH)
  if ffi.C.tcsetattr(fd, TCSANOW, tio) ~= 0 then
    ffi.C.close(fd)
    error("serial: tcsetattr failed: " .. getError())
  end

  return {
    fd = fd,
    port = port,
    baud = baud,
    readBuf = ffi.new("char[4096]"),
    lineBuf = "",    -- accumulator for line-oriented reading
  }
end

--- Check if data is available (non-blocking).
--- @param handle table  port handle
--- @return boolean
function serial.available(handle)
  local pfd = ffi.new("serial_pollfd_t[1]")
  pfd[0].fd = handle.fd
  pfd[0].events = POLLIN
  pfd[0].revents = 0
  local ret = ffi.C.poll(pfd, 1, 0)
  return ret > 0
end

--- Read raw bytes (non-blocking).
--- @param handle table  port handle
--- @param maxBytes number  max bytes to read (default 4096)
--- @return string|nil  data or nil if nothing available
function serial.read(handle, maxBytes)
  maxBytes = maxBytes or 4096
  if maxBytes > 4096 then maxBytes = 4096 end

  local n = ffi.C.read(handle.fd, handle.readBuf, maxBytes)
  if n > 0 then
    return ffi.string(handle.readBuf, n)
  end
  return nil
end

--- Read a complete line (non-blocking, buffered).
--- Accumulates data across calls until a newline is found.
--- @param handle table  port handle
--- @return string|nil  complete line (without trailing \n) or nil
function serial.readLine(handle)
  -- Try to read any available data
  local data = serial.read(handle)
  if data then
    handle.lineBuf = handle.lineBuf .. data
  end

  -- Check for newline in buffer
  local nlPos = handle.lineBuf:find("\n")
  if nlPos then
    local line = handle.lineBuf:sub(1, nlPos - 1)
    -- Strip trailing \r if present (Windows-style line endings from Arduino)
    if line:sub(-1) == "\r" then
      line = line:sub(1, -2)
    end
    handle.lineBuf = handle.lineBuf:sub(nlPos + 1)
    return line
  end

  return nil
end

--- Read all available complete lines (non-blocking).
--- @param handle table  port handle
--- @return table  array of lines (may be empty)
function serial.readLines(handle)
  local lines = {}
  while true do
    local line = serial.readLine(handle)
    if not line then break end
    lines[#lines + 1] = line
  end
  return lines
end

--- Write data to the serial port.
--- @param handle table  port handle
--- @param data string  data to write
--- @return number  bytes written
function serial.write(handle, data)
  local n = ffi.C.write(handle.fd, data, #data)
  if n < 0 then
    error("serial: write failed: " .. getError())
  end
  return tonumber(n)
end

--- Flush input/output buffers.
--- @param handle table  port handle
--- @param which string  "input", "output", or "both" (default "both")
function serial.flush(handle, which)
  which = which or "both"
  local qMap = { input = TCIFLUSH, output = TCOFLUSH, both = TCIOFLUSH }
  ffi.C.tcflush(handle.fd, qMap[which] or TCIOFLUSH)
  if which == "input" or which == "both" then
    handle.lineBuf = ""
  end
end

--- Close the serial port.
function serial.close(handle)
  if handle and handle.fd >= 0 then
    ffi.C.close(handle.fd)
    handle.fd = -1
  end
end

return serial
