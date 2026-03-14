--[[
  gpio/i2c.lua — LuaJIT FFI bindings to Linux I2C

  I2C bus access for sensors, displays, ADCs, DACs, and any I2C peripheral.
  Uses standard Linux i2c-dev interface via ioctl — works on all SBCs.

  Install: sudo apt install i2c-tools  (usually pre-installed on RPi OS)
  Enable:  sudo raspi-config → Interface Options → I2C → Enable

  Usage:
    local i2c = require("lua.gpio.i2c")
    local dev = i2c.open(1, 0x48)          -- bus 1, address 0x48
    local temp = i2c.readRegister(dev, 0x00)
    i2c.close(dev)
]]

local ffi = require("ffi")

-- ── FFI declarations ────────────────────────────────────────

ffi.cdef[[
  int open(const char *pathname, int flags);
  int close(int fd);
  int ioctl(int fd, unsigned long request, ...);
  long read(int fd, void *buf, size_t count);
  long write(int fd, const void *buf, size_t count);
  char *strerror(int errnum);
  int *__errno_location(void);
]]

-- ── Constants ───────────────────────────────────────────────

local O_RDWR = 0x0002
local I2C_SLAVE = 0x0703  -- ioctl command to set slave address

-- SMBus-level commands via ioctl (linux/i2c-dev.h)
local I2C_SMBUS       = 0x0720
local I2C_SMBUS_READ  = 1
local I2C_SMBUS_WRITE = 0
local I2C_SMBUS_BYTE       = 1
local I2C_SMBUS_BYTE_DATA  = 2
local I2C_SMBUS_WORD_DATA  = 3
local I2C_SMBUS_BLOCK_DATA = 5

-- ── Module ──────────────────────────────────────────────────

local i2c = {}

local function getError()
  return ffi.string(ffi.C.strerror(ffi.C.__errno_location()[0]))
end

--- Open an I2C device.
--- @param bus number  I2C bus number (e.g. 1 for /dev/i2c-1)
--- @param address number  7-bit device address (e.g. 0x48)
--- @return table  handle { fd, bus, address }
function i2c.open(bus, address)
  local path = "/dev/i2c-" .. tostring(bus)
  local fd = ffi.C.open(path, O_RDWR)
  if fd < 0 then
    error("i2c: failed to open " .. path .. ": " .. getError())
  end

  if ffi.C.ioctl(fd, I2C_SLAVE, ffi.cast("unsigned long", address)) < 0 then
    ffi.C.close(fd)
    error("i2c: failed to set slave address 0x" .. string.format("%02x", address) .. ": " .. getError())
  end

  return {
    fd = fd,
    bus = bus,
    address = address,
    buf = ffi.new("uint8_t[256]"),
  }
end

--- Read a single byte (no register).
--- @param handle table
--- @return number  byte value (0-255)
function i2c.readByte(handle)
  local buf = ffi.new("uint8_t[1]")
  local n = ffi.C.read(handle.fd, buf, 1)
  if n ~= 1 then
    error("i2c: readByte failed: " .. getError())
  end
  return buf[0]
end

--- Write a single byte (no register).
--- @param handle table
--- @param byte number  value to write (0-255)
function i2c.writeByte(handle, byte)
  local buf = ffi.new("uint8_t[1]", byte)
  local n = ffi.C.write(handle.fd, buf, 1)
  if n ~= 1 then
    error("i2c: writeByte failed: " .. getError())
  end
end

--- Read a byte from a specific register.
--- @param handle table
--- @param reg number  register address (0-255)
--- @return number  byte value (0-255)
function i2c.readRegister(handle, reg)
  -- Write register address
  local regBuf = ffi.new("uint8_t[1]", reg)
  if ffi.C.write(handle.fd, regBuf, 1) ~= 1 then
    error("i2c: failed to write register address: " .. getError())
  end
  -- Read value
  local valBuf = ffi.new("uint8_t[1]")
  if ffi.C.read(handle.fd, valBuf, 1) ~= 1 then
    error("i2c: failed to read register: " .. getError())
  end
  return valBuf[0]
end

--- Write a byte to a specific register.
--- @param handle table
--- @param reg number  register address (0-255)
--- @param value number  byte value (0-255)
function i2c.writeRegister(handle, reg, value)
  local buf = ffi.new("uint8_t[2]", reg, value)
  if ffi.C.write(handle.fd, buf, 2) ~= 2 then
    error("i2c: failed to write register: " .. getError())
  end
end

--- Read a 16-bit word from a register (big-endian, MSB first).
--- @param handle table
--- @param reg number  register address
--- @return number  16-bit value
function i2c.readWord(handle, reg)
  local regBuf = ffi.new("uint8_t[1]", reg)
  if ffi.C.write(handle.fd, regBuf, 1) ~= 1 then
    error("i2c: failed to write register address: " .. getError())
  end
  local valBuf = ffi.new("uint8_t[2]")
  if ffi.C.read(handle.fd, valBuf, 2) ~= 2 then
    error("i2c: failed to read word: " .. getError())
  end
  -- Big-endian (MSB first — most I2C sensors)
  return valBuf[0] * 256 + valBuf[1]
end

--- Write a 16-bit word to a register (big-endian).
--- @param handle table
--- @param reg number
--- @param value number  16-bit value
function i2c.writeWord(handle, reg, value)
  local buf = ffi.new("uint8_t[3]", reg, math.floor(value / 256), value % 256)
  if ffi.C.write(handle.fd, buf, 3) ~= 3 then
    error("i2c: failed to write word: " .. getError())
  end
end

--- Read multiple bytes from a starting register.
--- @param handle table
--- @param reg number  starting register (or nil for raw read)
--- @param count number  number of bytes to read
--- @return table  array of byte values
function i2c.readBytes(handle, reg, count)
  if reg then
    local regBuf = ffi.new("uint8_t[1]", reg)
    if ffi.C.write(handle.fd, regBuf, 1) ~= 1 then
      error("i2c: failed to write register address: " .. getError())
    end
  end

  if count > 256 then count = 256 end
  local n = ffi.C.read(handle.fd, handle.buf, count)
  if n < 0 then
    error("i2c: readBytes failed: " .. getError())
  end

  local result = {}
  for i = 0, tonumber(n) - 1 do
    result[i + 1] = handle.buf[i]
  end
  return result
end

--- Write multiple bytes starting at a register.
--- @param handle table
--- @param reg number  starting register (or nil for raw write)
--- @param bytes table  array of byte values
function i2c.writeBytes(handle, reg, bytes)
  local n = #bytes
  local offset = 0

  if reg then
    handle.buf[0] = reg
    offset = 1
  end

  for i = 1, n do
    handle.buf[offset + i - 1] = bytes[i]
  end

  local total = offset + n
  if ffi.C.write(handle.fd, handle.buf, total) ~= total then
    error("i2c: writeBytes failed: " .. getError())
  end
end

--- Change the slave address on an open handle.
--- Useful for talking to multiple devices on the same bus.
--- @param handle table
--- @param address number  new 7-bit address
function i2c.setAddress(handle, address)
  if ffi.C.ioctl(handle.fd, I2C_SLAVE, ffi.cast("unsigned long", address)) < 0 then
    error("i2c: failed to set address 0x" .. string.format("%02x", address) .. ": " .. getError())
  end
  handle.address = address
end

--- Close the I2C device.
function i2c.close(handle)
  if handle and handle.fd >= 0 then
    ffi.C.close(handle.fd)
    handle.fd = -1
  end
end

return i2c
