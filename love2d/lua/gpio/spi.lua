--[[
  gpio/spi.lua — LuaJIT FFI bindings to Linux spidev

  SPI bus access for high-speed peripherals (displays, ADCs, flash,
  shift registers, LED drivers, etc.). Uses the standard Linux spidev
  interface via ioctl — no extra libraries needed.

  Enable: sudo raspi-config → Interface Options → SPI → Enable

  Usage:
    local spi = require("lua.gpio.spi")
    local dev = spi.open(0, 0, { speed = 1000000, mode = 0 })
    local rx = spi.transfer(dev, {0xFF, 0x00})
    spi.close(dev)
]]

local ffi = require("ffi")
local bit = require("bit")

-- ── FFI declarations ────────────────────────────────────────

ffi.cdef[[
  int open(const char *pathname, int flags);
  int close(int fd);
  int ioctl(int fd, unsigned long request, ...);
  char *strerror(int errnum);
  int *__errno_location(void);

  // SPI transfer structure (linux/spi/spidev.h)
  struct spi_ioc_transfer {
    uint64_t tx_buf;
    uint64_t rx_buf;
    uint32_t len;
    uint32_t speed_hz;
    uint16_t delay_usecs;
    uint8_t  bits_per_word;
    uint8_t  cs_change;
    uint8_t  tx_nbits;
    uint8_t  rx_nbits;
    uint8_t  word_delay_usecs;
    uint8_t  pad;
  };
]]

-- ── Constants ───────────────────────────────────────────────

local O_RDWR = 0x0002

-- SPI ioctl commands
local SPI_IOC_MAGIC = 0x6B  -- 'k'
-- _IOW(SPI_IOC_MAGIC, 1, uint8_t)  = mode
-- _IOW(SPI_IOC_MAGIC, 3, uint8_t)  = bits per word
-- _IOW(SPI_IOC_MAGIC, 4, uint32_t) = max speed
-- _IOR(SPI_IOC_MAGIC, 1, uint8_t)  = read mode
-- _IOR(SPI_IOC_MAGIC, 3, uint8_t)  = read bits
-- _IOR(SPI_IOC_MAGIC, 4, uint32_t) = read speed

-- Computed ioctl numbers for Linux
local SPI_IOC_WR_MODE          = 0x40016B01
local SPI_IOC_WR_BITS_PER_WORD = 0x40016B03
local SPI_IOC_WR_MAX_SPEED_HZ  = 0x40046B04
local SPI_IOC_RD_MODE          = 0x80016B01
local SPI_IOC_RD_BITS_PER_WORD = 0x80016B03
local SPI_IOC_RD_MAX_SPEED_HZ  = 0x80046B04

-- SPI_IOC_MESSAGE(1) = _IOW(SPI_IOC_MAGIC, 0, struct spi_ioc_transfer)
-- size of spi_ioc_transfer = 32 bytes
local SPI_IOC_MESSAGE_1 = 0x40206B00  -- _IOW('k', 0, 32)

-- SPI modes
local SPI_MODE_0 = 0  -- CPOL=0, CPHA=0
local SPI_MODE_1 = 1  -- CPOL=0, CPHA=1
local SPI_MODE_2 = 2  -- CPOL=1, CPHA=0
local SPI_MODE_3 = 3  -- CPOL=1, CPHA=1

-- ── Module ──────────────────────────────────────────────────

local spi = {}

local function getError()
  return ffi.string(ffi.C.strerror(ffi.C.__errno_location()[0]))
end

--- Open an SPI device.
--- @param bus number  SPI bus number (e.g. 0)
--- @param device number  chip select (e.g. 0 for CE0, 1 for CE1)
--- @param opts table  { speed=1000000, mode=0, bitsPerWord=8 }
--- @return table  handle
function spi.open(bus, device, opts)
  opts = opts or {}
  local speed = opts.speed or 1000000      -- 1 MHz default
  local mode = opts.mode or 0
  local bpw = opts.bitsPerWord or 8

  local path = string.format("/dev/spidev%d.%d", bus, device)
  local fd = ffi.C.open(path, O_RDWR)
  if fd < 0 then
    error("spi: failed to open " .. path .. ": " .. getError())
  end

  -- Set mode
  local modeBuf = ffi.new("uint8_t[1]", mode)
  if ffi.C.ioctl(fd, SPI_IOC_WR_MODE, modeBuf) < 0 then
    ffi.C.close(fd)
    error("spi: failed to set mode: " .. getError())
  end

  -- Set bits per word
  local bpwBuf = ffi.new("uint8_t[1]", bpw)
  if ffi.C.ioctl(fd, SPI_IOC_WR_BITS_PER_WORD, bpwBuf) < 0 then
    ffi.C.close(fd)
    error("spi: failed to set bits per word: " .. getError())
  end

  -- Set speed
  local speedBuf = ffi.new("uint32_t[1]", speed)
  if ffi.C.ioctl(fd, SPI_IOC_WR_MAX_SPEED_HZ, speedBuf) < 0 then
    ffi.C.close(fd)
    error("spi: failed to set speed: " .. getError())
  end

  return {
    fd = fd,
    bus = bus,
    device = device,
    speed = speed,
    mode = mode,
    bitsPerWord = bpw,
  }
end

--- Full-duplex SPI transfer.
--- Sends txData and simultaneously receives rxData.
--- @param handle table  SPI handle
--- @param txData table  array of bytes to send
--- @param opts table  { speed=nil, delayUsecs=0 }  (override per-transfer)
--- @return table  array of received bytes
function spi.transfer(handle, txData, opts)
  opts = opts or {}
  local n = #txData

  local txBuf = ffi.new("uint8_t[?]", n)
  local rxBuf = ffi.new("uint8_t[?]", n)
  for i = 1, n do txBuf[i - 1] = txData[i] end

  local tr = ffi.new("struct spi_ioc_transfer")
  tr.tx_buf = ffi.cast("uint64_t", ffi.cast("intptr_t", txBuf))
  tr.rx_buf = ffi.cast("uint64_t", ffi.cast("intptr_t", rxBuf))
  tr.len = n
  tr.speed_hz = opts.speed or handle.speed
  tr.delay_usecs = opts.delayUsecs or 0
  tr.bits_per_word = handle.bitsPerWord

  if ffi.C.ioctl(handle.fd, SPI_IOC_MESSAGE_1, tr) < 0 then
    error("spi: transfer failed: " .. getError())
  end

  local result = {}
  for i = 0, n - 1 do
    result[i + 1] = rxBuf[i]
  end
  return result
end

--- Write-only SPI transfer (ignore received data).
--- @param handle table
--- @param txData table  array of bytes
function spi.write(handle, txData)
  spi.transfer(handle, txData)
end

--- Read-only SPI transfer (send zeros, return received).
--- @param handle table
--- @param count number  bytes to read
--- @return table  array of received bytes
function spi.read(handle, count)
  local zeros = {}
  for i = 1, count do zeros[i] = 0 end
  return spi.transfer(handle, zeros)
end

--- Close the SPI device.
function spi.close(handle)
  if handle and handle.fd >= 0 then
    ffi.C.close(handle.fd)
    handle.fd = -1
  end
end

-- Export mode constants
spi.MODE_0 = SPI_MODE_0
spi.MODE_1 = SPI_MODE_1
spi.MODE_2 = SPI_MODE_2
spi.MODE_3 = SPI_MODE_3

return spi
