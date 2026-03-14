--[[
  gpio/gpiod.lua — LuaJIT FFI bindings to libgpiod v2

  Provides GPIO digital I/O for any Linux SBC (Raspberry Pi, Orange Pi,
  Le Potato, etc.) via the standard kernel character device interface.

  Uses libgpiod v2 API — the modern replacement for sysfs GPIO.
  Install: sudo apt install libgpiod-dev

  Usage:
    local gpiod = require("lua.gpio.gpiod")
    local chip = gpiod.open("/dev/gpiochip0")
    local req = gpiod.requestOutput(chip, 17, "my-app")
    gpiod.write(req, 17, 1)   -- pin HIGH
    gpiod.write(req, 17, 0)   -- pin LOW
    gpiod.release(req)
    gpiod.close(chip)
]]

local ffi = require("ffi")
local bit = require("bit")

-- ── FFI declarations ────────────────────────────────────────

ffi.cdef[[
  // Opaque handles
  typedef struct gpiod_chip gpiod_chip;
  typedef struct gpiod_line_request gpiod_line_request;
  typedef struct gpiod_line_config gpiod_line_config;
  typedef struct gpiod_line_settings gpiod_line_settings;
  typedef struct gpiod_request_config gpiod_request_config;
  typedef struct gpiod_edge_event_buffer gpiod_edge_event_buffer;
  typedef struct gpiod_edge_event gpiod_edge_event;

  // ── Chip ──
  gpiod_chip *gpiod_chip_open(const char *path);
  void gpiod_chip_close(gpiod_chip *chip);
  const char *gpiod_chip_get_name(gpiod_chip *chip);
  int gpiod_chip_get_num_lines(gpiod_chip *chip);

  // ── Line settings ──
  gpiod_line_settings *gpiod_line_settings_new(void);
  void gpiod_line_settings_free(gpiod_line_settings *settings);
  int gpiod_line_settings_set_direction(gpiod_line_settings *settings, int direction);
  int gpiod_line_settings_set_edge_detection(gpiod_line_settings *settings, int edge);
  int gpiod_line_settings_set_bias(gpiod_line_settings *settings, int bias);
  int gpiod_line_settings_set_active_low(gpiod_line_settings *settings, bool active_low);
  int gpiod_line_settings_set_output_value(gpiod_line_settings *settings, int value);

  // ── Line config ──
  gpiod_line_config *gpiod_line_config_new(void);
  void gpiod_line_config_free(gpiod_line_config *config);
  int gpiod_line_config_add_line_settings(gpiod_line_config *config,
      const unsigned int *offsets, size_t num_offsets,
      gpiod_line_settings *settings);

  // ── Request config ──
  gpiod_request_config *gpiod_request_config_new(void);
  void gpiod_request_config_free(gpiod_request_config *config);
  void gpiod_request_config_set_consumer(gpiod_request_config *config, const char *consumer);

  // ── Line request ──
  gpiod_line_request *gpiod_chip_request_lines(gpiod_chip *chip,
      gpiod_request_config *req_cfg, gpiod_line_config *line_cfg);
  void gpiod_line_request_release(gpiod_line_request *request);
  int gpiod_line_request_get_value(gpiod_line_request *request, unsigned int offset);
  int gpiod_line_request_set_value(gpiod_line_request *request,
      unsigned int offset, int value);

  // ── Edge events ──
  gpiod_edge_event_buffer *gpiod_edge_event_buffer_new(size_t capacity);
  void gpiod_edge_event_buffer_free(gpiod_edge_event_buffer *buffer);
  int gpiod_line_request_read_edge_events(gpiod_line_request *request,
      gpiod_edge_event_buffer *buffer, size_t max_events);
  int gpiod_edge_event_buffer_get_num_events(gpiod_edge_event_buffer *buffer);
  gpiod_edge_event *gpiod_edge_event_buffer_get_event(
      gpiod_edge_event_buffer *buffer, unsigned long index);
  int gpiod_edge_event_get_event_type(gpiod_edge_event *event);
  unsigned int gpiod_edge_event_get_line_offset(gpiod_edge_event *event);
  uint64_t gpiod_edge_event_get_timestamp_ns(gpiod_edge_event *event);

  // ── File descriptor for non-blocking poll ──
  int gpiod_line_request_get_fd(gpiod_line_request *request);

  // ── POSIX poll (for non-blocking edge detection) ──
  typedef struct { int fd; short events; short revents; } pollfd_t;
  int poll(pollfd_t *fds, unsigned long nfds, int timeout);
]]

-- ── Load library ────────────────────────────────────────────

local lib
local ok, err = pcall(function()
  lib = ffi.load("gpiod")
end)
if not ok then
  -- Graceful fallback: module loads but functions error on use
  lib = nil
end

-- ── Constants ───────────────────────────────────────────────

local DIRECTION_INPUT  = 1
local DIRECTION_OUTPUT = 2

local EDGE_NONE    = 1
local EDGE_RISING  = 2
local EDGE_FALLING = 3
local EDGE_BOTH    = 4

local BIAS_UNKNOWN  = 1
local BIAS_DISABLED = 2
local BIAS_PULL_UP  = 3
local BIAS_PULL_DOWN = 4

local EDGE_EVENT_RISING  = 1
local EDGE_EVENT_FALLING = 2

local POLLIN = 0x0001

-- ── Module ──────────────────────────────────────────────────

local gpiod = {}

local function checkLib()
  if not lib then
    error("libgpiod not available. Install with: sudo apt install libgpiod-dev")
  end
end

--- Open a GPIO chip by path.
--- @param path string  e.g. "/dev/gpiochip0"
--- @return userdata chip handle
function gpiod.open(path)
  checkLib()
  path = path or "/dev/gpiochip0"
  local chip = lib.gpiod_chip_open(path)
  if chip == nil then
    error("gpiod: failed to open chip: " .. path)
  end
  return chip
end

--- Close a GPIO chip.
function gpiod.close(chip)
  checkLib()
  if chip ~= nil then
    lib.gpiod_chip_close(chip)
  end
end

--- Get chip info.
function gpiod.chipInfo(chip)
  checkLib()
  return {
    name = ffi.string(lib.gpiod_chip_get_name(chip)),
    numLines = lib.gpiod_chip_get_num_lines(chip),
  }
end

--- Request a line for output.
--- @param chip userdata  chip handle from gpiod.open()
--- @param pin number  GPIO line offset
--- @param consumer string  consumer name for identification
--- @param initialValue number  0 or 1 (default 0)
--- @return userdata request handle
function gpiod.requestOutput(chip, pin, consumer, initialValue)
  checkLib()
  consumer = consumer or "reactjit"
  initialValue = initialValue or 0

  local settings = lib.gpiod_line_settings_new()
  lib.gpiod_line_settings_set_direction(settings, DIRECTION_OUTPUT)
  lib.gpiod_line_settings_set_output_value(settings, initialValue)

  local lineConfig = lib.gpiod_line_config_new()
  local offsets = ffi.new("unsigned int[1]", pin)
  lib.gpiod_line_config_add_line_settings(lineConfig, offsets, 1, settings)

  local reqConfig = lib.gpiod_request_config_new()
  lib.gpiod_request_config_set_consumer(reqConfig, consumer)

  local request = lib.gpiod_chip_request_lines(chip, reqConfig, lineConfig)

  lib.gpiod_request_config_free(reqConfig)
  lib.gpiod_line_config_free(lineConfig)
  lib.gpiod_line_settings_free(settings)

  if request == nil then
    error("gpiod: failed to request output on pin " .. pin)
  end

  return request
end

--- Request a line for input.
--- @param chip userdata  chip handle
--- @param pin number  GPIO line offset
--- @param consumer string  consumer name
--- @param opts table  { edge="none"|"rising"|"falling"|"both", bias="none"|"up"|"down", activeLow=false }
--- @return userdata request handle
function gpiod.requestInput(chip, pin, consumer, opts)
  checkLib()
  consumer = consumer or "reactjit"
  opts = opts or {}

  local settings = lib.gpiod_line_settings_new()
  lib.gpiod_line_settings_set_direction(settings, DIRECTION_INPUT)

  -- Edge detection
  local edgeMap = { none = EDGE_NONE, rising = EDGE_RISING, falling = EDGE_FALLING, both = EDGE_BOTH }
  local edge = edgeMap[opts.edge or "none"] or EDGE_NONE
  lib.gpiod_line_settings_set_edge_detection(settings, edge)

  -- Bias (pull-up / pull-down)
  local biasMap = { none = BIAS_DISABLED, up = BIAS_PULL_UP, down = BIAS_PULL_DOWN }
  local bias = biasMap[opts.bias or "none"] or BIAS_DISABLED
  lib.gpiod_line_settings_set_bias(settings, bias)

  -- Active low
  if opts.activeLow then
    lib.gpiod_line_settings_set_active_low(settings, true)
  end

  local lineConfig = lib.gpiod_line_config_new()
  local offsets = ffi.new("unsigned int[1]", pin)
  lib.gpiod_line_config_add_line_settings(lineConfig, offsets, 1, settings)

  local reqConfig = lib.gpiod_request_config_new()
  lib.gpiod_request_config_set_consumer(reqConfig, consumer)

  local request = lib.gpiod_chip_request_lines(chip, reqConfig, lineConfig)

  lib.gpiod_request_config_free(reqConfig)
  lib.gpiod_line_config_free(lineConfig)
  lib.gpiod_line_settings_free(settings)

  if request == nil then
    error("gpiod: failed to request input on pin " .. pin)
  end

  return request
end

--- Request multiple lines at once.
--- @param chip userdata
--- @param pins table  array of pin offsets
--- @param direction string  "input" or "output"
--- @param consumer string
--- @param opts table  same as requestInput opts
--- @return userdata request handle
function gpiod.requestLines(chip, pins, direction, consumer, opts)
  checkLib()
  consumer = consumer or "reactjit"
  opts = opts or {}
  local isOutput = direction == "output"

  local settings = lib.gpiod_line_settings_new()
  lib.gpiod_line_settings_set_direction(settings, isOutput and DIRECTION_OUTPUT or DIRECTION_INPUT)

  if not isOutput then
    local edgeMap = { none = EDGE_NONE, rising = EDGE_RISING, falling = EDGE_FALLING, both = EDGE_BOTH }
    lib.gpiod_line_settings_set_edge_detection(settings, edgeMap[opts.edge or "none"] or EDGE_NONE)
    local biasMap = { none = BIAS_DISABLED, up = BIAS_PULL_UP, down = BIAS_PULL_DOWN }
    lib.gpiod_line_settings_set_bias(settings, biasMap[opts.bias or "none"] or BIAS_DISABLED)
    if opts.activeLow then
      lib.gpiod_line_settings_set_active_low(settings, true)
    end
  end

  local lineConfig = lib.gpiod_line_config_new()
  local n = #pins
  local offsets = ffi.new("unsigned int[?]", n)
  for i = 1, n do offsets[i - 1] = pins[i] end
  lib.gpiod_line_config_add_line_settings(lineConfig, offsets, n, settings)

  local reqConfig = lib.gpiod_request_config_new()
  lib.gpiod_request_config_set_consumer(reqConfig, consumer)

  local request = lib.gpiod_chip_request_lines(chip, reqConfig, lineConfig)

  lib.gpiod_request_config_free(reqConfig)
  lib.gpiod_line_config_free(lineConfig)
  lib.gpiod_line_settings_free(settings)

  if request == nil then
    error("gpiod: failed to request lines")
  end

  return request
end

--- Read a pin value.
--- @param request userdata  line request handle
--- @param pin number  GPIO line offset
--- @return number  0 or 1
function gpiod.read(request, pin)
  checkLib()
  local val = lib.gpiod_line_request_get_value(request, pin)
  if val < 0 then
    error("gpiod: failed to read pin " .. pin)
  end
  return val
end

--- Write a pin value.
--- @param request userdata  line request handle
--- @param pin number  GPIO line offset
--- @param value number  0 or 1
function gpiod.write(request, pin, value)
  checkLib()
  local ret = lib.gpiod_line_request_set_value(request, pin, value)
  if ret < 0 then
    error("gpiod: failed to write pin " .. pin)
  end
end

--- Create an edge event buffer.
--- @param capacity number  max events to buffer (default 16)
--- @return userdata buffer handle
function gpiod.createEventBuffer(capacity)
  checkLib()
  capacity = capacity or 16
  local buf = lib.gpiod_edge_event_buffer_new(capacity)
  if buf == nil then
    error("gpiod: failed to create edge event buffer")
  end
  return buf
end

--- Free an edge event buffer.
function gpiod.freeEventBuffer(buffer)
  checkLib()
  if buffer ~= nil then
    lib.gpiod_edge_event_buffer_free(buffer)
  end
end

--- Poll for edge events (non-blocking).
--- Returns an array of events or empty table if none.
--- @param request userdata  line request with edge detection enabled
--- @param buffer userdata  edge event buffer
--- @return table  array of { type="rising"|"falling", pin=N, timestamp_ns=N }
function gpiod.pollEdges(request, buffer)
  checkLib()
  local events = {}

  -- Non-blocking poll: check if fd has data (timeout = 0ms)
  local fd = lib.gpiod_line_request_get_fd(request)
  local pfd = ffi.new("pollfd_t[1]")
  pfd[0].fd = fd
  pfd[0].events = POLLIN
  pfd[0].revents = 0

  local ret = ffi.C.poll(pfd, 1, 0)
  if ret <= 0 then return events end

  -- Read available events
  local numRead = lib.gpiod_line_request_read_edge_events(request, buffer, 16)
  if numRead <= 0 then return events end

  local numEvents = lib.gpiod_edge_event_buffer_get_num_events(buffer)
  for i = 0, numEvents - 1 do
    local ev = lib.gpiod_edge_event_buffer_get_event(buffer, i)
    local evType = lib.gpiod_edge_event_get_event_type(ev)
    local pin = lib.gpiod_edge_event_get_line_offset(ev)
    local ts = lib.gpiod_edge_event_get_timestamp_ns(ev)

    events[#events + 1] = {
      type = evType == EDGE_EVENT_RISING and "rising" or "falling",
      pin = pin,
      timestamp_ns = tonumber(ts),
    }
  end

  return events
end

--- Release a line request.
function gpiod.release(request)
  checkLib()
  if request ~= nil then
    lib.gpiod_line_request_release(request)
  end
end

-- Export constants for direct use
gpiod.DIRECTION_INPUT  = DIRECTION_INPUT
gpiod.DIRECTION_OUTPUT = DIRECTION_OUTPUT
gpiod.EDGE_NONE    = EDGE_NONE
gpiod.EDGE_RISING  = EDGE_RISING
gpiod.EDGE_FALLING = EDGE_FALLING
gpiod.EDGE_BOTH    = EDGE_BOTH
gpiod.BIAS_DISABLED  = BIAS_DISABLED
gpiod.BIAS_PULL_UP   = BIAS_PULL_UP
gpiod.BIAS_PULL_DOWN = BIAS_PULL_DOWN

return gpiod
