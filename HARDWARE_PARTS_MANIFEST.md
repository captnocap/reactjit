# Hardware Parts Manifest — Virtual Component Playground

This is a subsystem spec. Every hardware part becomes a Lua visual capability.
Multiple Claude instances build from this manifest in parallel. The contracts
below are non-negotiable — they exist so 20 parts built by 20 Claudes converge
into one coherent system.

---

## Architecture: Three Systems (NOT One)

The hardware playground is three distinct systems. They share data, not code.
No part may implement concerns from another system.

### System A — Part Renderer
Each hardware capability draws itself and simulates local behavior.
Lives in `lua/capabilities/hw/`. One file per part.

### System B — Wiring / Netlist
Tracks connections between parts: net names, signal propagation, bus grouping,
wire visuals. Lives in `lua/hw/netlist.lua` and `lua/hw/wire.lua`.
Parts do NOT own their wires. Parts expose anchors. The netlist connects them.

### System C — Hardware Backend
Routes part I/O to either simulated signals or real hardware adapters.
Lives in `lua/hw/backend_sim.lua` and `lua/hw/backend_real.lua`.
Parts call `backend:read(pin)` / `backend:write(pin, value)`. They never
call `libgpiod` or `serial` directly.

**If a part draws itself AND manages global connection state AND directly
pokes hardware — that part is wrong. Rewrite it.**

---

## Foundation Rules (NON-NEGOTIABLE)

Every part is a **Lua visual capability**. Not a React component.
Not a .tslx. Not a useEffect animation. Pure Lua.

- `render(node, canvas, opacity)` — all drawing via `love.graphics`
- `tick(node, dt)` — all animation, simulation state, timing
- `pushEvent(node, name, data)` — all events back to React
- React's only job: `<Native type="HW_DHT22" temp={22.5} />` — declare and pass props
- Zero JS in the visual/interactive loop. LuaJIT runs at 60fps. QuickJS does not.

### Reference implementations
- `lua/capabilities/pcb_board.lua` — visual: IC chips, traces, pin headers, LED glow
- `lua/capabilities/led_matrix.lua` — visual + animation: NxM grid, patterns, scroll text
- `lua/capabilities/gpio_pin.lua` — non-visual: real hardware I/O lifecycle

### Naming convention (STRICT)
- Capability type: `HW_ArduinoUno`, `HW_LED`, `HW_DHT22` — always `HW_` prefix
- No mixed abbreviations. No pretty names at runtime layer.
- Human-facing labels can be pretty. Capability IDs stay boring and predictable.
- React usage: `<Native type="HW_ArduinoUno" />`

### File convention
```
lua/capabilities/hw/
  _colors.lua          — shared color palette
  _draw.lua            — shared drawing helpers
  _simulate.lua        — shared simulation helpers
  _anchors.lua         — shared anchor/pin helpers
  _layout.lua          — shared board layout helpers
  development_boards/
    arduino_uno.lua
    arduino_nano.lua
    esp32_devkit.lua
    ...
  displays/
    oled_ssd1306.lua
    lcd_hd44780.lua
    seven_segment.lua
    ...
  sensors/
    dht22.lua
    hc_sr04.lua
    ...
  actuators/
    servo_sg90.lua
    ...
  input/
    rotary_encoder.lua
    potentiometer.lua
    tactile_button.lua
    ...
  communication/
    esp8266_module.lua
    ...
  passive/
    led.lua
    resistor.lua
    capacitor.lua
    breadboard.lua
    wire.lua
    ...
  motor/
    stepper_nema17.lua
    ...
  breakout/
    rtc_ds3231.lua
    ...
```

Each part registers via:
```lua
Capabilities.register("HW_PartName", { visual = true, ... })
```

---

## Mandatory Capability Skeleton

**Every part MUST implement this exact structure.** No variations. No shortcuts.
No "I'll add the pins later." If a field doesn't apply, set it to `nil` or `{}`.

```lua
local Capabilities = require("lua.capabilities")
local Colors = require("lua.capabilities.hw._colors")
local Draw = require("lua.capabilities.hw._draw")
local Anchors = require("lua.capabilities.hw._anchors")

-- ============================================================================
-- Internal coordinate system (part draws at this scale, container scales it)
-- ============================================================================
local INTERNAL_W = 400   -- choose per part
local INTERNAL_H = 260

-- ============================================================================
-- Logical pins (what the part IS electrically)
-- ============================================================================
local PINS = {
  { id = "D13",  kind = "gpio",   direction = "bidirectional" },
  { id = "GND",  kind = "ground", direction = "sink" },
  { id = "5V",   kind = "power",  direction = "source" },
  { id = "A0",   kind = "analog", direction = "input" },
  { id = "SDA",  kind = "i2c",    direction = "bidirectional" },
  -- ...
}

-- ============================================================================
-- Visual anchors (where pins appear in internal coordinate space)
-- Separate from logical pins. Wiring system uses these. Schematic view ignores them.
-- ============================================================================
local ANCHORS = {
  D13 = { x = 340, y = 42 },
  GND = { x = 340, y = 190 },
  ["5V"] = { x = 12, y = 30 },
  A0  = { x = 12, y = 80 },
  SDA = { x = 12, y = 130 },
  -- ...
}

-- ============================================================================
-- Validation rules (machine-readable, consumed by netlist validator)
-- ============================================================================
local VALIDATION = {
  bus = nil,                        -- "i2c", "spi", "uart", or nil
  i2cAddress = nil,                 -- 7-bit address if I2C device
  maxVoltage = 5,                   -- max input voltage
  requirements = {},                -- e.g. {"resistor_for_led"}
  warnings = {},                    -- e.g. {"no_5v_to_3v3_device"}
  pwmCapable = {},                  -- pin IDs that support PWM
}

-- ============================================================================
-- Static geometry cache (built once in init, NEVER in render)
-- ============================================================================
local _cache = {}

-- ============================================================================
-- Lifecycle
-- ============================================================================

local function init(node)
  -- Build all static geometry, label positions, color lookups.
  -- This runs ONCE when the node is created.
  node.state = node.state or {}
  node.state.time = 0
  node.state.runtime = {}    -- display state read by render()
  node.state.sim = {}        -- simulation-only state
  node.state.io = {}         -- hardware backend state
  node.state.ui = {}         -- interaction state (hover, drag, selection)
  node.state._cache = {}     -- static geometry, labels, colors — NEVER modified after init
  -- Pre-compute everything that doesn't change per-frame:
  -- pin positions, label strings, color tables, glow radii, etc.
  -- Store in node.state._cache
end

local function tick(node, dt)
  -- Update ONLY time-varying state.
  -- Write to node.state.runtime (display), .sim, or .io
  -- Read from node.state.ui for interaction→state translation
  -- NO table creation. NO string building (except dynamic labels via pre-allocated FMT_*).
  node.state.time = (node.state.time or 0) + dt

  local props = node.props
  if props.simulate ~= false then
    -- Simulation mode: generate fake data, write to .sim and .runtime
  else
    -- Real mode: read from backend, write to .io and .runtime
    -- If backend unavailable, .runtime keeps stale values (do NOT crash)
  end
end

local function render(node, c, opacity)
  local x, y = node.layout.x, node.layout.y
  local w, h = node.layout.width, node.layout.height

  -- Scale internal coordinate system to fit container
  local scaleX = w / INTERNAL_W
  local scaleY = h / INTERNAL_H
  local scale = math.min(scaleX, scaleY)

  love.graphics.push()
  love.graphics.translate(
    x + (w - INTERNAL_W * scale) / 2,
    y + (h - INTERNAL_H * scale) / 2
  )
  love.graphics.scale(scale)

  -- Draw ONLY from node.state.runtime, .ui, and ._cache
  -- Use Colors.* for all colors. Use Draw.* for shared shapes.
  -- No computation here. No string building. No table creation.

  love.graphics.pop()

  -- MANDATORY: draw mode badge and degraded-state overlays
  -- (after pop, in screen space)
  local mode = "sim"
  if node.props.simulate == false then
    mode = node.state.io.connected and "live" or "offline"
  end
  Draw.drawModeBadge(x + w - 2, y + 2, mode, opacity)

  if mode == "offline" and (node.state.time - (node.state.io.lastReadTime or 0)) > 2 then
    Draw.drawStaleOverlay(x, y, w, h, opacity)
  end
end

local function destroy(node)
  -- Clean up any resources (rare for visual-only parts)
end

-- ============================================================================
-- Interaction handlers (optional — only for interactive parts)
-- All coordinates are in internal space. Framework does screen→internal conversion.
-- Handlers write to node.state.ui ONLY.
-- ============================================================================

local function pointerDown(node, ix, iy, button)
  -- ix, iy are in internal coordinate space
  -- Use Anchors.hitTestAnchor(ANCHORS, ix, iy, radius) to find what was clicked
end

local function pointerUp(node, ix, iy, button)
  -- Fire events here (onPress, onPinTap, etc.)
end

local function pointerMove(node, ix, iy)
  -- Hover detection: node.state.ui.hoveredPin = Anchors.hitTestAnchor(...)
end

-- local function wheel(node, ix, iy, dx, dy)  -- uncomment if needed
--   -- Rotary encoder, potentiometer
-- end

-- ============================================================================
-- Registration
-- ============================================================================

Capabilities.register("HW_PartName", {
  visual = true,
  interactive = true,       -- set false for display-only parts
  category = "development_boards",
  version = 1,

  propsSchema = {
    -- Every prop that React can set, with types
    digitalPins = "table",
    simulate    = "boolean",
  },

  defaultProps = {
    -- Defaults for every prop. simulate is ALWAYS defaulted true.
    simulate = true,
  },

  -- Logical pin and anchor definitions (consumed by netlist/wiring systems)
  pins = PINS,
  anchors = ANCHORS,
  validation = VALIDATION,

  -- Internal dimensions (consumed by wiring system for anchor scaling)
  internalSize = { w = INTERNAL_W, h = INTERNAL_H },

  -- Lifecycle
  init = init,
  tick = tick,
  render = render,
  destroy = destroy,

  -- Interaction handlers (optional — set nil for non-interactive parts)
  pointerDown = pointerDown,
  pointerUp = pointerUp,
  pointerMove = pointerMove,
  wheel = nil,                -- uncomment handler above if needed
})
```

**This is the shape. Every part. No exceptions.**

---

## Derived State Cache Rules (LAW, not suggestion)

These are performance rules. Violating them causes frame drops at scale.

| Function | MAY do | MUST NOT do |
|----------|--------|-------------|
| `init()` | Create tables, build geometry, compute labels, cache colors | — |
| `tick()` | Update numbers/booleans in `node.state.*` | Create tables, build strings, compute colors |
| `render()` | Read `node.state.*`, call `love.graphics.*`, use `Draw.*` | Create tables, build strings, compute colors, call any non-drawing function |

**Specific prohibitions in `render()`:**
- No `string.format()` — pre-build strings in `tick()` or `init()`
- No `{ r, g, b, a }` table literals — use pre-allocated color tables from `Colors.*`
- No `math.sin/cos` for color — pre-compute in `tick()`, store result
- No `table.insert` — no table creation at all
- `math.sin/cos` for position/rotation is OK (cheap, no allocation)

---

## Logical Pins vs Visual Anchors (CRITICAL SEPARATION)

Every part defines TWO related but distinct structures:

### Logical pins (`PINS` table)
What the part IS electrically. Used by validation, netlist, and schematic view.

```lua
{ id = "D13", kind = "gpio", direction = "bidirectional" }
{ id = "GND", kind = "ground", direction = "sink" }
{ id = "SDA", kind = "i2c", direction = "bidirectional" }
{ id = "TX",  kind = "uart", direction = "output" }
```

**Pin kinds:** `gpio`, `analog`, `power`, `ground`, `i2c`, `spi`, `uart`, `pwm`, `data`, `nc`
**Directions:** `input`, `output`, `bidirectional`, `source`, `sink`

### Visual anchors (`ANCHORS` table)
Where pins appear in render-space. Used by wiring system for wire attachment.

```lua
D13 = { x = 340, y = 42 }
GND = { x = 340, y = 190 }
```

Coordinates are in the part's internal coordinate system (pre-scale).

### Why they're separate
- Wires use anchors (render coordinates)
- Validation uses pins (electrical rules)
- Board view needs both
- Schematic view ignores anchors entirely
- A pin may exist without a visible anchor (internal connections)
- An anchor may move if the part has multiple visual modes

---

## Prop Parity Rule (PROTECT THIS)

> React code is identical in both modes. That's the whole point.

This is the thesis. Hard rules:

- **No prop may exist only for simulation** unless prefixed `sim_` (e.g. `sim_noiseLevel`)
- **No prop may exist only for real mode** unless it is transport/backend config (e.g. `i2cBus`, `serialPort`)
- **Domain props describe the part, not the implementation path.** `temperature` is a domain prop. `fakeTemperature` is wrong — it's just `temperature` and the backend decides where it comes from.
- A user switching from `simulate=true` to `simulate=false` should change ZERO other props to get the same behavior with real hardware.

---

## Simulation Model

Each part has two modes, selected by a `simulate` prop (default `true`):

- **simulate = true**: Part generates its own data in `tick()`. A DHT22 produces
  sine-wave temperature curves. A servo animates to target angle. An OLED renders
  its demo screen. The simulation helpers in `_simulate.lua` provide noise, curves,
  random triggers, and fake data streams.
- **simulate = false**: Part reads/writes through the hardware backend (`System C`).
  Same visual rendering, real data. If the backend is unavailable, the part renders
  normally with stale/zero data — it does NOT crash or error.

### Backend Ownership of Truth (resolve this ONCE, not per part)

When `simulate=true`, domain props from React are the **desired/display state**.
The part's `tick()` generates its own values (e.g. fake temperature curves) and
those override the React-provided prop values for display purposes.

When `simulate=false`, backend-read values override domain props for display.
React props become **initial/fallback values** only — the real sensor data wins.

```
simulate=true:   tick() generates data → render() displays it, props are fallback
simulate=false:  backend provides data → render() displays it, props are fallback
```

There is no `preferPropValues` flag. There is no per-part decision about this.
The backend always wins when present. Props are always fallback. This is universal.

---

## Event Contract (GLOBAL LAW)

Every event emitted via `pushEvent()` MUST follow this exact shape:

```lua
pushEvent(node, "onRead", {
  partType   = "HW_DHT22",           -- capability type (REQUIRED)
  partId     = node.id,              -- instance ID (REQUIRED)
  timestamp  = node.state.time,      -- part-local time in seconds (REQUIRED)
  -- domain-specific fields below:
  temperature = 22.5,
  humidity    = 61.2,
})
```

**Mandatory fields in EVERY event payload:**
- `partType` — the `HW_` capability type string
- `partId` — `node.id` (unique instance identifier)
- `timestamp` — `node.state.time` (seconds since init)

**Rules:**
- Payload is always a table. Never a bare string or number.
- Domain fields use the same names as the corresponding props (e.g. `temperature`, not `temp` or `sensorTemp`).
- Boolean events (button press, motion detect) still include the mandatory fields.
- No nested tables in event payloads unless the data is inherently structured (e.g. `accel = {x=0, y=0, z=1}`).
- Event names match the propsSchema callback names: `onRead`, `onPress`, `onRelease`, `onRotate`, `onMeasure`, etc.

**Example events for reference:**
```lua
-- Sensor read
pushEvent(node, "onRead", { partType="HW_DHT22", partId=node.id, timestamp=t, temperature=22.5, humidity=61 })

-- Button press
pushEvent(node, "onPress", { partType="HW_Button", partId=node.id, timestamp=t })

-- Pin tap (interactive board)
pushEvent(node, "onPinTap", { partType="HW_ArduinoUno", partId=node.id, timestamp=t, pin="D13", kind="gpio" })

-- Rotary encoder
pushEvent(node, "onRotate", { partType="HW_RotaryEncoder", partId=node.id, timestamp=t, direction="cw", value=42 })

-- RFID card detect
pushEvent(node, "onCardDetect", { partType="HW_RFID", partId=node.id, timestamp=t, uid="A1B2C3D4", cardType="MIFARE" })
```

---

## State Namespace Rules (MANDATORY)

All part state lives in `node.state`. To prevent collision and make debugging
possible across 50+ parts, state MUST be organized into these namespaces:

```lua
node.state = {
  -- Time accumulator (every part has this)
  time = 0,

  -- Runtime display state: what render() reads to draw
  -- LED brightness, servo angle, display text, pin highlights, etc.
  runtime = {
    ledOn = true,
    currentAngle = 90,
    displayText = "HELLO",
  },

  -- Simulation state: only written when simulate=true
  -- Generated sensor values, animation phases, fake data cursors
  sim = {
    tempPhase = 0,
    lastTrigger = 0,
    noiseOffset = 0,
  },

  -- I/O state: only written when simulate=false
  -- Raw hardware readings, connection status, error counts
  io = {
    lastRead = nil,
    connected = false,
    errorCount = 0,
  },

  -- UI state: hover, selection, drag, focus
  -- Only written by interaction handlers
  ui = {
    hoveredPin = nil,
    selected = false,
    dragValue = 0,
  },

  -- Cache: static geometry built in init(), NEVER modified after
  _cache = {
    pinPositions = {},
    labelStrings = {},
    colorLookup = {},
  },
}
```

**Rules:**
- `init()` creates all namespaces and populates `_cache`
- `tick()` writes to `runtime`, `sim`, or `io` — NEVER to `_cache`
- `render()` reads from `runtime`, `ui`, and `_cache` — NEVER writes anything
- Interaction handlers write to `ui` only
- No top-level fields except `time` and the 5 namespaces above
- If you need a new namespace, you're doing something wrong

---

## Interaction Handlers (EXPLICIT CONTRACT)

Parts with `interactive = true` MAY implement these optional handlers.
They are called by the event system (System A), not by React.

```lua
-- All handlers receive the node and coordinates in internal space (pre-scale).
-- The framework handles screen→internal coordinate conversion.

local function pointerDown(node, x, y, button)
  -- button: 1=left, 2=right, 3=middle
  -- Use Anchors.hitTestAnchor() to find what was clicked
  -- Write to node.state.ui only
end

local function pointerUp(node, x, y, button)
  -- Pair with pointerDown. Fire events here (onPress, onPinTap, etc.)
end

local function pointerMove(node, x, y)
  -- Hover detection, drag updates
  -- Write to node.state.ui.hoveredPin, node.state.ui.dragValue, etc.
end

local function wheel(node, x, y, dx, dy)
  -- Scroll wheel input (for rotary encoder, potentiometer)
  -- dy > 0 = scroll up, dy < 0 = scroll down
end

-- Register in capability:
Capabilities.register("HW_PartName", {
  -- ...
  pointerDown = pointerDown,   -- optional, nil if not interactive
  pointerUp = pointerUp,       -- optional
  pointerMove = pointerMove,   -- optional
  wheel = wheel,               -- optional
})
```

**Rules:**
- Handlers write to `node.state.ui` ONLY. Never to `runtime` or `sim`.
- `tick()` reads from `node.state.ui` and translates to `node.state.runtime` changes.
- This keeps the interaction→state→render pipeline clean and unidirectional.
- `render()` uses `node.state.ui.hoveredPin` etc. for hover highlights.
- All coordinates passed to handlers are in **internal coordinate space**.
  The framework converts screen coords using the part's `internalSize`.

---

## Validation Error Vocabulary (CANONICAL CODES)

The netlist validator (System B) uses these codes. Parts declare which ones
apply via their `VALIDATION` table. The UI, docs, and error messages all use
the same vocabulary.

```lua
-- Voltage errors
"voltage_mismatch"           -- 5V output connected to 3.3V-max input
"overvoltage"                -- input exceeds part's maxVoltage
"no_power"                   -- part has no power pin connected
"reverse_polarity"           -- power connected backwards (electrolytic cap, LED)

-- Ground errors
"missing_ground"             -- part has no ground connection
"ground_loop"                -- multiple ground paths (warning, not error)

-- Protection errors
"missing_series_resistor"    -- LED without current-limiting resistor
"missing_pullup"             -- I2C bus without pull-up resistors
"missing_decoupling_cap"     -- IC without bypass capacitor (warning)

-- Bus errors
"i2c_address_conflict"       -- two devices on same I2C bus with same address
"spi_cs_conflict"            -- two SPI devices sharing a chip select
"uart_tx_to_tx"              -- UART TX connected to TX instead of RX
"uart_rx_to_rx"              -- UART RX connected to RX instead of TX
"bus_not_terminated"         -- SPI/I2C bus missing termination

-- Signal errors
"output_to_output_conflict"  -- two outputs driving the same net
"floating_input"             -- input pin connected to nothing
"power_to_ground_short"      -- direct short between power and ground

-- Capacity errors
"max_current_exceeded"       -- too many loads on a single output
"fan_out_exceeded"           -- too many inputs on a single driver
```

**Per-part validation declaration:**
```lua
local VALIDATION = {
  bus = "i2c",
  i2cAddress = 0x3C,
  maxVoltage = 3.3,
  requirements = {
    "missing_series_resistor",   -- this part needs a resistor
  },
  warnings = {
    "missing_decoupling_cap",    -- nice to have
  },
  pwmCapable = { "D3", "D5", "D6", "D9", "D10", "D11" },
}
```

---

## Degraded State Visual Convention (UNIVERSAL)

When a part is in a non-nominal state, it must show this visually.
Every part uses the SAME indicators — no per-part invention.

### Mode badge (top-right corner, tiny, always visible)
- **SIM** — green text, shown when `simulate=true`
- **LIVE** — blue text, shown when `simulate=false` and backend connected
- **OFFLINE** — amber text, shown when `simulate=false` but backend unavailable

Implementation: `Draw.drawModeBadge(x, y, mode, opacity)` in `_draw.lua`.
Every part calls this at the end of `render()`. Non-negotiable.

### Stale data indicator
When `simulate=false` and no data has been received for >2 seconds:
- A subtle amber striped overlay (diagonal lines, 10% opacity) covers the part
- The mode badge changes from LIVE to OFFLINE

Implementation: `Draw.drawStaleOverlay(x, y, w, h, opacity)` in `_draw.lua`.
Called in `render()` when `node.state.io.lastReadTime` is stale.

### Error state
When a validation error applies to this part (flagged by netlist validator):
- A thin red border around the part
- Error code shown as tooltip on hover

Implementation: `Draw.drawErrorBorder(x, y, w, h, opacity)` in `_draw.lua`.

### Hover state (interactive parts only)
When pointer is over an anchor/clickable surface:
- Anchor: gold highlight ring around the pin
- Surface (button, knob): subtle brightness increase

Implementation: Use `Colors.highlight` for the gold ring. Read from `node.state.ui.hoveredPin`.

---

## Text and Label Rules (LAW)

Labels cause the most subtle rendering bugs. Lock these down.

### Static labels (pin names, component designators, silk text)
- Built as strings in `init()`, stored in `node.state._cache.labels`
- NEVER rebuilt in `tick()` or `render()`
- Use `Draw.drawLabel()` which handles font, size, and alignment

### Dynamic labels (sensor readouts, values, counters)
- Built as strings in `tick()`, stored in `node.state.runtime.displayText` (or similar)
- `string.format()` is allowed in `tick()` ONLY
- Maximum 12 characters for any single dynamic label
- If a value exceeds 12 chars, truncate with `...` or use scientific notation
- Pre-allocate the format string as a module-level constant:
  ```lua
  local FMT_TEMP = "%.1f°C"    -- module level, not inside tick()
  -- in tick():
  node.state.runtime.tempLabel = string.format(FMT_TEMP, temp)
  ```

### Label rendering rules
- Font size: use `Draw.drawLabel()` which picks size from a fixed set (8, 10, 12, 14, 16)
- Color: always from `Colors.*` — silkscreen white for board labels, domain color for readouts
- No label may overlap another label. If space is tight, hide lower-priority labels.
- At thumbnail scale (<80px), hide ALL labels except the part name/type

---

## Platform Objects (NOT regular parts)

These are elevated above the parts catalog. They have subsystem-level complexity
and interact with System B (netlist/wiring) in ways that regular parts do not.

### HW_Breadboard
The breadboard is not a leaf part. It is a **placement canvas** with its own rules:

- **Hole grid:** 830 points (full) or 400 (half), organized as 5-hole rows + power rails
- **Row/rail mapping:** holes in the same row are electrically connected (5-hole groups, split by center channel). Power rails run the full length.
- **Snapping:** parts placed on the breadboard snap to hole positions
- **Occupancy tracking:** knows which holes are filled by which part's pins
- **Anchor targeting:** when a wire endpoint is near a breadboard hole, it snaps to that hole and inherits the hole's net
- **Wire routing:** wires between breadboard holes follow the channel/rail geometry
- **Zoom-friendly:** hole labels (row numbers, column letters) appear/hide based on scale

**This part gets its own implementation file AND may need a companion module
in `lua/hw/breadboard_grid.lua` for the occupancy/snapping/routing logic
that System B consumes.**

### HW_Wire
Wire is owned by **System B (netlist)**, not System A (part renderer).
It is NOT a regular capability. It is rendered by the netlist wire renderer.

- Wire data lives in the netlist: `{ from = {partId, pinId}, to = {partId, pinId}, color }`
- Wire visual is a bezier curve between two anchor screen positions
- Wire color follows the standard wire color palette from `_colors.lua`
- Wire does NOT register as a capability. It is drawn by `lua/hw/wire_renderer.lua`

**Do NOT implement HW_Wire as a `Capabilities.register()` part.**

---

## Acceptance Snapshot Requirement (per-part deliverable)

Every part builder must deliver, in addition to the capability file:

A **fixture story** in `storybook/src/stories/hw/` that renders the part
at three scales with canonical props:

```tsx
// storybook/src/stories/hw/HW_LED_Fixture.tsx
export function HW_LED_Fixture() {
  return (
    <Box style={{ flexDirection: 'row', gap: 20 }}>
      {/* Thumbnail */}
      <Native type="HW_LED" color="red" on brightness={1} style={{ width: 60, height: 60 }} />
      {/* Normal */}
      <Native type="HW_LED" color="red" on brightness={1} style={{ width: 150, height: 150 }} />
      {/* Large */}
      <Native type="HW_LED" color="red" on brightness={1} style={{ width: 300, height: 300 }} />
    </Box>
  )
}
```

This serves as:
- Visual regression baseline
- Scale test (thumbnail, normal, large)
- Canonical prop example
- Quick visual review during parallel merge

The fixture is NOT the final playground story. It is a per-part acceptance artifact.

---

## Shared Foundation Modules (build BEFORE any parts)

### `lua/capabilities/hw/_colors.lua`
Shared color palette for all parts. Consistency across 50+ parts requires ONE palette.

Must include:
- PCB colors: substrate green, edge, soldermask, silkscreen white
- Metal: copper, gold, solder, silver, tin
- Component bodies: IC black, resistor tan, capacitor blue/orange, LED dome colors
- LED glow: red, green, blue, yellow, white, cyan, purple (each with on/off/glow variants)
- Wire colors: red, black, orange, yellow, green, blue, white, purple, grey, brown
- State indicators: active green, warning amber, error red, inactive grey
- Mode badge colors: sim green, live blue, offline amber
- Degraded state: stale overlay amber (10% opacity), error border red, hover ring gold
- Highlight: anchor hover gold, surface hover (brightness +15%)
- PCB variants: Arduino blue, Raspberry Pi green, ESP32 black, Adafruit purple, SparkFun red

### `lua/capabilities/hw/_draw.lua`
Shared drawing primitives. Every part uses these instead of raw `love.graphics`.

Must include:
- `drawRoundRect(x, y, w, h, r, color, opacity)` — rounded rectangle
- `drawPad(cx, cy, size, color, opacity)` — solder pad / hole
- `drawIC(x, y, w, h, label, pinCount, opacity)` — DIP/QFP/QFN package
- `drawPinHeader(x, y, cols, rows, pitch, opacity)` — pin header grid
- `drawLED(cx, cy, r, color, on, brightness, opacity)` — LED with glow halo
- `drawResistorBands(x, y, w, h, ohms, opacity)` — color-coded resistor
- `drawCapacitor(x, y, type, value, opacity)` — ceramic disc or electrolytic
- `drawUSBPort(x, y, type, opacity)` — USB-A/B/C/micro/mini
- `drawBarrelJack(x, y, opacity)` — DC power jack
- `drawScrewTerminal(x, y, count, opacity)` — screw terminals
- `drawCrystal(x, y, opacity)` — oscillator crystal
- `drawLabel(x, y, text, fontSize, color, opacity)` — silkscreen label
- `drawMountingHole(cx, cy, r, opacity)` — PCB mounting hole
- `drawTrace(points, width, color, opacity)` — copper trace between points
- `drawWire(x1, y1, x2, y2, color, opacity)` — bezier jumper wire
- `drawGlow(cx, cy, r, color, intensity, opacity)` — radial glow effect
- `drawModeBadge(x, y, mode, opacity)` — SIM/LIVE/OFFLINE corner badge (MANDATORY in every part's render)
- `drawStaleOverlay(x, y, w, h, opacity)` — amber diagonal stripes for stale data state
- `drawErrorBorder(x, y, w, h, opacity)` — thin red border for validation errors
- `drawHoverRing(cx, cy, r, opacity)` — gold highlight ring for hovered anchors

### `lua/capabilities/hw/_simulate.lua`
Shared simulation helpers for `tick()` functions.

Must include:
- `sineWave(time, frequency, min, max)` — smooth oscillation
- `noise(time, amplitude)` — Perlin-ish noise for sensor jitter
- `randomTrigger(dt, probability)` — stochastic event firing
- `lerp(current, target, speed, dt)` — smooth value interpolation
- `stepToward(current, target, stepSize, dt)` — discrete stepping
- `blinkPhase(time, onDuration, offDuration)` — returns true/false
- `pulseIntensity(time, frequency)` — 0-1 pulse for LED glow
- `fakeTempCurve(time)` — realistic temperature variation
- `fakeHumidityCurve(time)` — realistic humidity variation
- `fakePressureCurve(time)` — realistic barometric variation
- `fakeGPSPath(time)` — lat/lon walking a path
- `fakeSerialStream(time)` — generates plausible serial data

### `lua/capabilities/hw/_anchors.lua`
Helpers for pin/anchor management and hit testing.

Must include:
- `createAnchorMap(pins, anchors)` — validate pins have matching anchors
- `hitTestAnchor(anchors, internalX, internalY, radius)` — find anchor under point
- `anchorToScreen(anchor, nodeLayout, internalSize)` — convert internal coords to screen
- `screenToAnchor(screenX, screenY, nodeLayout, internalSize)` — reverse mapping
- `nearestAnchor(anchors, x, y)` — snap-to-nearest for wire attachment
- `anchorBounds(anchors)` — bounding box of all anchors
- `labelPosition(anchor, side)` — compute label placement relative to anchor

### `lua/capabilities/hw/_layout.lua`
Common board layout patterns — eliminates repeated placement math across parts.

Must include:
- `pinHeaderRow(startX, startY, count, pitch, direction)` — generate anchor positions for a row of pins
- `pinHeaderGrid(startX, startY, cols, rows, pitch)` — 2D pin header
- `dipPackage(x, y, w, h, pinCount)` — DIP IC pin positions
- `qfpPackage(x, y, size, pinCount)` — QFP IC pin positions
- `breakoutCenter(boardW, boardH, componentW, componentH)` — center a component on a breakout PCB
- `pcbMargins(internalW, internalH, margin)` — usable area inside PCB edges
- `screwTerminalRow(startX, startY, count, pitch)` — terminal block positions
- `matrixGrid(startX, startY, cols, rows, cellSize, gap)` — LED/pixel matrix positions

---

## Quality Acceptance Checklist

Every part must pass ALL of these before merge. No exceptions.

### Visual
- [ ] **Recognizable silhouette** — someone who has used the real part recognizes it instantly
- [ ] **Reads clearly at thumbnail scale** — identifiable even in a 60x60 sidebar tile
- [ ] **Scales cleanly** — internal coord system + uniform scale, no pixel artifacts at any size
- [ ] **At least one animated/live state** — LED glow, blink, pulse, rotation, data readout
- [ ] **Mode badge rendered** — SIM/LIVE/OFFLINE badge via `Draw.drawModeBadge()` at end of render()
- [ ] **Stale overlay works** — amber stripes appear after 2s of no backend data in real mode
- [ ] **Labels hide at thumbnail** — dynamic labels hidden when rendered below 80px

### Structure
- [ ] **Follows the skeleton exactly** — init/tick/render/destroy, PINS, ANCHORS, VALIDATION, propsSchema, defaultProps
- [ ] **State namespaces used** — `runtime`, `sim`, `io`, `ui`, `_cache` — no top-level fields except `time`
- [ ] **All props documented** in propsSchema with types
- [ ] **All logical pins defined** in PINS with kind + direction
- [ ] **All visual anchors defined** in ANCHORS with internal coordinates
- [ ] **Validation rules declared** — bus, address, maxVoltage, requirements, warnings
- [ ] **`simulate` prop defaults to `true`** in defaultProps

### Performance
- [ ] **No render-time allocations** — zero table creation, zero string building in render()
- [ ] **Dynamic labels built in tick()** — using pre-allocated FMT_* format strings
- [ ] **Static labels built in init()** — stored in `_cache.labels`
- [ ] **No label exceeds 12 characters** — truncated with `...` or scientific notation

### Behavior
- [ ] **simulate=true works standalone** — part is interesting without any wiring or backend
- [ ] **simulate=false does not crash** — gracefully shows stale/zero data if backend unavailable
- [ ] **Backend values override props** — in real mode, backend data wins over React props
- [ ] **Emits at least one event** if interactive (buttons, encoders, sensors)
- [ ] **Events follow global contract** — partType + partId + timestamp in every payload
- [ ] **Selected/hover visual state** if the part has clickable surfaces
- [ ] **Interaction handlers write to ui only** — pointerDown/Up/Move never touch runtime/sim

### Integration
- [ ] **Uses shared palette** — all colors from `_colors.lua`, not local hex values
- [ ] **Uses shared drawing helpers** — `_draw.lua` for standard shapes, not bespoke duplicates
- [ ] **Fixture story delivered** — 3-scale snapshot (60px, 150px, 300px) in `storybook/src/stories/hw/`

---

## Parts Catalog

Status key: `[ ]` not started, `[~]` in progress, `[x]` done

---

### CATEGORY: Development Boards (`development_boards/`)
The brain of every project. Pin headers, power rails, status LEDs.

#### `[x] HW_PCBBoard` (exists — lua/capabilities/pcb_board.lua, needs migration to hw/ skeleton)
- Generic stylized PCB. Already renders IC chips, headers, traces, LED.
- Reference implementation for all board visuals.
- **Migration needed:** move to `hw/development_boards/`, add PINS/ANCHORS/VALIDATION, rename type to `HW_PCBBoard`

#### `[ ] HW_ArduinoUno`
- **What it is:** ATmega328P dev board, the most common starter board on earth
- **Visual:** Blue PCB, USB-B port, DC barrel jack, crystal, ATmega328P DIP-28, reset button, 2x digital pin headers (D0-D13), 1x analog header (A0-A5), 1x power header, L/TX/RX/ON LEDs, ICSP header
- **Internal coords:** 400x260 (real board is ~68.6x53.4mm)
- **Interactive surfaces:** Pin headers highlight on hover, LEDs animate, reset button is pressable
- **Props:** `digitalPins: table` (D0-D13 HIGH/LOW state), `analogPins: table` (A0-A5 0-1023), `powerLed: bool`, `txLed: bool`, `rxLed: bool`, `userLed: bool` (pin 13)
- **Events:** `onPinTap(pin, type)` — user clicked a pin, `onReset()` — reset button pressed
- **Simulation:** TX/RX LEDs flicker when serial data flows, user LED mirrors D13 state
- **Pins:** D0-D13 (gpio), A0-A5 (analog), 5V/3.3V/VIN (power), GND x3 (ground), SDA/SCL (i2c), MOSI/MISO/SCK/SS (spi), TX/RX (uart), RESET (control), AREF (reference)
- **Anchors:** Along top edge (digital), bottom edge (analog + power), ICSP cluster center-right

#### `[ ] HW_ArduinoNano`
- **What it is:** Compact ATmega328P board, breadboard-friendly
- **Visual:** Blue/black PCB, mini-USB, pin headers along both long edges, smaller form factor
- **Internal coords:** 340x140 (real: 45x18mm)
- **Props:** Same pin set as Uno but compact two-row layout
- **Events:** `onPinTap(pin, type)`
- **Pins:** Same as Uno
- **Anchors:** Two rows along long edges, 15 per side

#### `[ ] HW_ESP32DevKit`
- **What it is:** ESP-WROOM-32 module on breakout board, WiFi + BLE
- **Visual:** Black PCB, USB-C/micro-USB, silver RF shield with ESP32 label, 2x15 pin headers, EN + BOOT buttons, red power LED
- **Internal coords:** 360x180
- **Props:** `pins: table`, `wifiConnected: bool`, `bleConnected: bool`, `powerLed: bool`
- **Events:** `onPinTap(pin)`, `onBootPress()`, `onResetPress()`
- **Simulation:** WiFi icon indicator, BLE icon indicator
- **Pins:** GPIO0-GPIO39 (gpio, many also analog/touch/pwm), 3.3V/5V (power), GND x3 (ground), SDA/SCL (i2c), MOSI/MISO/SCK/SS (spi), TX/RX (uart), EN (control)
- **Anchors:** Two rows of 15, along long edges

#### `[ ] HW_RaspberryPiGPIO`
- **What it is:** 40-pin GPIO header as found on Pi 3/4/5
- **Visual:** Green PCB snippet showing the 2x20 pin header, color-coded by function (power=red, ground=black, GPIO=green, I2C=blue, SPI=purple, UART=orange), pin numbers and BCM labels
- **Internal coords:** 300x200
- **Props:** `pinStates: table` (BCM number -> HIGH/LOW), `i2cActive: bool`, `spiActive: bool`, `uartActive: bool`
- **Events:** `onPinTap(bcm, physicalPin)`
- **Note:** This is just the header, not the full Pi board — meant for wiring diagrams
- **Pins:** BCM0-BCM27 (gpio), 3.3V x2 (power), 5V x2 (power), GND x8 (ground), SDA/SCL (i2c), MOSI/MISO/SCLK/CE0/CE1 (spi), TXD/RXD (uart), ID_SD/ID_SC (i2c eeprom)
- **Anchors:** 2x20 grid, 2.54mm pitch scaled to internal coords

#### `[ ] HW_STM32BluePill`
- **What it is:** STM32F103C8T6 board, popular cheap ARM board
- **Visual:** Blue PCB, micro-USB, STM32 chip (QFP-48), 2x20 pin headers, reset button, boot jumpers, power LED
- **Internal coords:** 360x160
- **Props:** `pins: table`, `bootMode: number` (0 or 1)
- **Pins:** PA0-PA15, PB0-PB15, PC13-PC15 (gpio), 3.3V/5V (power), GND (ground), SDA/SCL (i2c), MOSI/MISO/SCK (spi), TX/RX (uart), BOOT0/BOOT1 (control)

---

### CATEGORY: Displays (`displays/`)
Visual output — the things people want to see working first.

#### `[x] HW_LEDMatrix` (exists — lua/capabilities/led_matrix.lua, needs migration)
- NxM dot matrix with glow effects, patterns, scroll text. Already done.
- **Migration needed:** move to `hw/displays/`, add PINS/ANCHORS/VALIDATION, rename type

#### `[ ] HW_OLED_SSD1306`
- **What it is:** 0.96" 128x64 monochrome OLED, I2C (addr 0x3C). The most common small display.
- **Visual:** Black PCB, 4-pin header (GND/VCC/SCL/SDA), display area with pixel grid, blue or white pixels on black. Slight bezel.
- **Internal coords:** 200x160 (PCB), display area 128x64 logical pixels
- **Render:** Pixel buffer as Lua table, drawn as tiny filled rects. Glow optional for OLED look.
- **Props:** `pixels: string` (base64 encoded 128x64 bitmap or nil for built-in demo), `contrast: number`, `inverted: bool`, `enabled: bool`
- **Simulation:** If no pixel data provided, cycles demo screens (logo, text, bars, scrolling)
- **Events:** none (display only, `interactive = false`)
- **Pins:** GND (ground), VCC (power), SCL (i2c), SDA (i2c)
- **Anchors:** 4-pin header at bottom edge
- **Validation:** `bus = "i2c"`, `i2cAddress = 0x3C`

#### `[ ] HW_LCD_HD44780`
- **What it is:** 16x2 or 20x4 character LCD, parallel or I2C backpack
- **Visual:** Green/blue background with dark characters, 16-pin header or 4-pin I2C, potentiometer for contrast, backlight glow
- **Internal coords:** 320x120 (16x2), 380x160 (20x4)
- **Render:** Character cells on a grid, each cell is a 5x8 dot matrix. Background glow.
- **Props:** `cols: number` (16/20), `rows: number` (2/4), `text: table` (array of row strings), `backlight: bool`, `cursorPos: table` ({row, col}), `cursorBlink: bool`, `contrast: number`
- **Simulation:** Cursor blink animation, backlight on/off transition
- **Events:** none (`interactive = false`)
- **Pins (I2C mode):** GND (ground), VCC (power), SDA (i2c), SCL (i2c)
- **Validation:** `bus = "i2c"`, `i2cAddress = 0x27`

#### `[ ] HW_SevenSegment`
- **What it is:** 7-segment LED display (1-8 digits), common anode/cathode
- **Visual:** Dark PCB, each digit is 7 segments + decimal point, LED glow effect per segment
- **Internal coords:** 60 per digit width, 100 height
- **Props:** `digits: number` (1-8), `value: string` (e.g. "12.34"), `color: string`, `leadingZeros: bool`, `colonPosition: number` (for clock displays)
- **Simulation:** Segment-by-segment rendering with glow, colon blink for clock mode
- **Events:** none (`interactive = false`)
- **Pins:** VCC (power), GND (ground), DIN (data), CLK (gpio), LATCH (gpio)

#### `[ ] HW_NeopixelStrip`
- **What it is:** WS2812B addressable RGB LED strip/ring
- **Visual:** Black flex PCB strip with round RGB LEDs, or circular ring layout
- **Props:** `count: number`, `layout: string` ("strip"|"ring"|"matrix"), `colors: table` (packed RGB per LED), `brightness: number`, `pattern: string`
- **Render:** Each LED is a circle with RGB color and glow. Ring mode arranges in circle. Matrix mode arranges in grid.
- **Simulation:** Rainbow cycle, chase, breathe, solid — selectable via `pattern` prop
- **Events:** none (`interactive = false`)
- **Pins:** DIN (data), 5V (power), GND (ground)

#### `[ ] HW_TFT_ST7789`
- **What it is:** 1.3"/1.54" 240x240 or 240x320 color TFT display, SPI
- **Visual:** Black PCB, 7-8 pin header, full color display area
- **Internal coords:** 280x300 (with PCB border)
- **Props:** `width: number`, `height: number`, `framebuffer: string` (RGB565 base64), `rotation: number`
- **Simulation:** Color bars, bouncing logo, gradient demo
- **Pins:** GND (ground), VCC (power), SCL (spi), SDA (spi), RES (gpio), DC (gpio), CS (spi), BLK (gpio)
- **Validation:** `bus = "spi"`
- **Note:** Stretch goal — framebuffer decode is expensive

#### `[ ] HW_EInk`
- **What it is:** 2.13" e-ink/e-paper display (common Waveshare modules), SPI
- **Visual:** White PCB, display area with papery texture, slow refresh animation
- **Props:** `pixels: string`, `partialRefresh: bool`
- **Simulation:** Full refresh animation (black flash then image), partial refresh for clock demo
- **Render:** Black/white/red pixels on off-white background, slight paper texture
- **Pins:** VCC (power), GND (ground), DIN (spi), CLK (spi), CS (spi), DC (gpio), RST (gpio), BUSY (gpio)
- **Validation:** `bus = "spi"`

---

### CATEGORY: Sensors (`sensors/`)
The input side — temperature, distance, motion, light, pressure.

#### `[ ] HW_DHT22`
- **What it is:** Digital temperature + humidity sensor (also DHT11 variant)
- **Visual:** White plastic housing with grid ventilation pattern, 4 pins (VCC, DATA, NC, GND), small PCB breakout option
- **Internal coords:** 120x160
- **Props:** `temperature: number` (-40 to 80 C), `humidity: number` (0-100%), `variant: string` ("DHT11"|"DHT22")
- **Visual state:** Small readout text on the part showing current values, data pin pulses on read
- **Simulation:** Generates slow sine-wave temperature (20-28C) and humidity (40-65%) curves with noise
- **Events:** `onRead(temp, humidity)` — fires at configurable interval
- **Pins:** VCC (power), DATA (data), NC (nc), GND (ground)

#### `[ ] HW_HC_SR04`
- **What it is:** Ultrasonic distance sensor, the one with two silver cylinders
- **Visual:** Blue PCB, two silver ultrasonic transducers (circles), 4-pin header (VCC/TRIG/ECHO/GND), crystal oscillator
- **Internal coords:** 180x120
- **Props:** `distance: number` (2-400 cm), `measuring: bool`
- **Visual state:** Animated sound wave arcs emanating from transducers when measuring, distance readout
- **Simulation:** Returns configurable distance, animated wave pulse visualization
- **Events:** `onMeasure(distanceCm)`
- **Pins:** VCC (power), TRIG (gpio, output), ECHO (gpio, input), GND (ground)

#### `[ ] HW_PIR`
- **What it is:** HC-SR501 passive infrared motion sensor, the dome one
- **Visual:** Green PCB, white Fresnel lens dome, 3 pins (VCC/OUT/GND), two potentiometers (sensitivity + delay)
- **Internal coords:** 140x140
- **Props:** `motionDetected: bool`, `sensitivity: number`, `delay: number`
- **Visual state:** Dome lights up / pulses when motion detected, LED indicator
- **Simulation:** Random motion triggers based on sensitivity setting
- **Events:** `onMotion(detected)`
- **Pins:** VCC (power), OUT (gpio, output), GND (ground)

#### `[ ] HW_BMP280`
- **What it is:** Barometric pressure + temperature sensor, I2C, tiny breakout board
- **Visual:** Purple/blue PCB, small silver sensor package, 4-6 pin header
- **Internal coords:** 100x80
- **Props:** `temperature: number`, `pressure: number` (hPa), `altitude: number` (m)
- **Simulation:** Slow pressure/temp curves simulating weather changes
- **Events:** `onRead(temp, pressure, altitude)`
- **Pins:** VCC (power), GND (ground), SCL (i2c), SDA (i2c)
- **Validation:** `bus = "i2c"`, `i2cAddress = 0x76`

#### `[ ] HW_MPU6050`
- **What it is:** 6-axis accelerometer + gyroscope, I2C
- **Visual:** Purple breakout board, small QFN IC, 8 pin header
- **Internal coords:** 120x80
- **Props:** `accel: table` ({x,y,z} in g), `gyro: table` ({x,y,z} in deg/s), `temperature: number`
- **Visual state:** Tilt visualization — a small 3D box that rotates based on accel/gyro
- **Simulation:** Gentle wobble/drift or user-interactive tilt
- **Events:** `onRead(accel, gyro, temp)`
- **Pins:** VCC (power), GND (ground), SCL (i2c), SDA (i2c), INT (gpio, output), AD0 (gpio)
- **Validation:** `bus = "i2c"`, `i2cAddress = 0x68`

#### `[ ] HW_Photoresistor`
- **What it is:** LDR (light-dependent resistor), analog sensor
- **Visual:** Small disc with squiggly trace pattern, 2 leads, on mini breakout or bare
- **Internal coords:** 60x80
- **Props:** `lightLevel: number` (0-1023 analog), `resistance: number` (ohms)
- **Simulation:** Slow ambient light variation
- **Events:** `onRead(value)`
- **Pins:** A (analog, input), GND (ground)

#### `[ ] HW_SoilMoisture`
- **What it is:** Capacitive soil moisture sensor, analog
- **Visual:** Long green PCB probe with traces, 3-pin header
- **Internal coords:** 60x200
- **Props:** `moisture: number` (0-100%), `raw: number` (0-1023)
- **Simulation:** Slowly drying out then watered
- **Events:** `onRead(moisture, raw)`
- **Pins:** VCC (power), GND (ground), AOUT (analog, output)

#### `[ ] HW_IR_Receiver`
- **What it is:** VS1838B IR receiver, 38kHz, used with remote controls
- **Visual:** Dark dome on 3 pins, often on small PCB with LED indicator
- **Internal coords:** 80x60
- **Props:** `lastCode: string`, `protocol: string`
- **Simulation:** Generates NEC protocol codes as if receiving remote presses
- **Events:** `onReceive(code, protocol)`
- **Pins:** VOUT (data, output), GND (ground), VCC (power)

---

### CATEGORY: Actuators (`actuators/`)
Things that move, make noise, or switch power.

#### `[ ] HW_Servo`
- **What it is:** SG90 micro servo motor, 0-180 degrees, the tiny blue one
- **Visual:** Blue plastic body, output shaft with horn (white cross/arm), 3-wire cable (brown/red/orange)
- **Internal coords:** 140x120
- **Props:** `angle: number` (0-180), `speed: number` (deg/s for animation), `hornType: string` ("cross"|"arm"|"wheel")
- **Visual state:** Horn rotates to target angle with smooth animation in tick()
- **Simulation:** Smooth rotation to target angle with configurable speed
- **Events:** `onReach(angle)` — fires when servo reaches target
- **Pins:** SIGNAL (pwm, input), VCC (power), GND (ground)

#### `[ ] HW_DCMotor`
- **What it is:** L298N dual H-bridge motor driver + DC motor
- **Visual:** Red PCB driver board with heatsink, screw terminals, 2x DC motors with spinning shaft visualization
- **Internal coords:** 240x180
- **Props:** `motorA: table` ({speed, direction}), `motorB: table` ({speed, direction}), `enableA: bool`, `enableB: bool`
- **Visual state:** Motor shafts rotate at visual speed, direction arrows
- **Simulation:** Motor spin animation proportional to speed value
- **Events:** none (`interactive = false`)
- **Pins:** IN1/IN2/IN3/IN4 (gpio, input), ENA/ENB (pwm, input), 12V/5V (power), GND (ground), OUT1/OUT2/OUT3/OUT4 (power, output)

#### `[ ] HW_Stepper`
- **What it is:** 28BYJ-48 5V stepper motor with ULN2003 driver board
- **Visual:** Silver motor cylinder, blue driver PCB with 4 LEDs (A/B/C/D phases), 5-pin connector
- **Internal coords:** 200x140
- **Props:** `targetSteps: number`, `speed: number` (RPM), `direction: string` ("cw"|"ccw"), `stepMode: string` ("full"|"half")
- **Visual state:** Phase LEDs sequence, motor shaft rotates with step counting
- **Simulation:** Step sequence animation with LED phases
- **Events:** `onStep(currentStep, totalSteps)`, `onComplete()`
- **Pins:** IN1/IN2/IN3/IN4 (gpio, input), 5V (power), GND (ground)

#### `[ ] HW_Relay`
- **What it is:** 5V relay module (1/2/4 channel), optoisolated
- **Visual:** Blue PCB, relay cube(s) with markings, LED indicator, screw terminals (NO/NC/COM), signal pins
- **Internal coords:** 160x100 (1ch), 280x100 (2ch)
- **Props:** `channels: number` (1-4), `states: table` (per channel on/off)
- **Visual state:** LED lights up, relay "clicks" (brief position shift animation), contact indicator switches NO/NC
- **Simulation:** Click animation + LED toggle
- **Events:** `onToggle(channel, state)`
- **Pins (per channel):** IN (gpio, input), VCC (power), GND (ground), COM/NO/NC (power, output)

#### `[ ] HW_Buzzer`
- **What it is:** Piezo buzzer, active or passive
- **Visual:** Black cylinder on small PCB, 2 pins, + marking
- **Internal coords:** 80x80
- **Props:** `active: bool`, `frequency: number` (passive mode), `playing: bool`
- **Visual state:** Vibration animation (subtle oscillation) when playing, sound wave rings
- **Simulation:** Visual-only (sound wave animation). Real mode uses PWM.
- **Events:** none (`interactive = false`)
- **Pins:** SIGNAL (pwm, input), GND (ground)

---

### CATEGORY: Input Devices (`input/`)
Buttons, knobs, keypads — human-to-circuit interfaces.

#### `[ ] HW_RotaryEncoder`
- **What it is:** KY-040 rotary encoder with push button
- **Visual:** Blue PCB, silver knob with knurled shaft, 5 pins (CLK/DT/SW/+/GND)
- **Internal coords:** 100x120
- **Props:** `value: number` (cumulative position), `pressed: bool`, `detents: number` (clicks per revolution)
- **Visual state:** Knob rotates with value, press animation
- **Interactive:** Mouse wheel or drag to rotate in simulation
- **Events:** `onRotate(direction, value)`, `onPress()`, `onRelease()`
- **Pins:** CLK (gpio, output), DT (gpio, output), SW (gpio, output), VCC (power), GND (ground)

#### `[ ] HW_Joystick`
- **What it is:** Dual-axis analog joystick with button (PS2 style)
- **Visual:** Black PCB, joystick cap (red/black), 5 pins (VRx/VRy/SW/5V/GND)
- **Internal coords:** 120x120
- **Props:** `x: number` (-1 to 1), `y: number` (-1 to 1), `pressed: bool`
- **Visual state:** Stick visual tilts to match x/y, press animation
- **Interactive:** Mouse drag to move stick in simulation
- **Events:** `onMove(x, y)`, `onPress()`, `onRelease()`
- **Pins:** VRx (analog, output), VRy (analog, output), SW (gpio, output), 5V (power), GND (ground)

#### `[ ] HW_Keypad`
- **What it is:** 4x4 membrane matrix keypad (0-9, A-D, *, #)
- **Visual:** White/grey membrane pad, 16 keys with labels, 8 pin ribbon cable
- **Internal coords:** 200x260
- **Props:** `pressedKey: string`
- **Visual state:** Key press/release animation (darken on press)
- **Interactive:** Click keys in simulation
- **Events:** `onKeyDown(key)`, `onKeyUp(key)`
- **Pins:** R1/R2/R3/R4 (gpio, output), C1/C2/C3/C4 (gpio, input)

#### `[ ] HW_Potentiometer`
- **What it is:** 10K rotary potentiometer (the knob with 3 pins)
- **Visual:** Blue/black body, metal shaft, 3 pins
- **Internal coords:** 80x100
- **Props:** `value: number` (0-1), `taper: string` ("linear"|"log")
- **Visual state:** Shaft rotation indicator
- **Interactive:** Mouse drag to rotate
- **Events:** `onChange(value)`
- **Pins:** VCC (power), WIPER (analog, output), GND (ground)

#### `[ ] HW_Button`
- **What it is:** 6mm tactile switch, the tiny clicky ones
- **Visual:** Small square, 4 pins, colored cap options (red/blue/green/yellow/black)
- **Internal coords:** 40x40
- **Props:** `pressed: bool`, `color: string`
- **Visual state:** Depress animation on press
- **Interactive:** Click to press in simulation
- **Events:** `onPress()`, `onRelease()`
- **Pins:** A1/A2 (gpio, bidirectional), B1/B2 (gpio, bidirectional)

---

### CATEGORY: Communication Modules (`communication/`)
WiFi, Bluetooth, Radio, GPS, RFID.

#### `[ ] HW_ESP8266`
- **What it is:** ESP-01 WiFi module, the tiny blue one with 8 pins
- **Visual:** Blue PCB, black antenna trace, 2x4 pin header, red power LED
- **Internal coords:** 120x100
- **Props:** `connected: bool`, `ssid: string`, `rssi: number`, `ip: string`
- **Visual state:** LED on when powered, WiFi signal strength bars
- **Simulation:** Fake connection lifecycle, signal strength variation
- **Events:** `onConnect(ip)`, `onDisconnect()`, `onData(payload)`
- **Pins:** VCC (power), GND (ground), TX (uart, output), RX (uart, input), CH_PD (gpio), RST (gpio), GPIO0 (gpio), GPIO2 (gpio)
- **Validation:** `bus = "uart"`

#### `[ ] HW_Bluetooth`
- **What it is:** HC-05 Bluetooth SPP module
- **Visual:** PCB with black Bluetooth module, red LED (blink=searching, solid=paired), 6 pins
- **Internal coords:** 140x80
- **Props:** `paired: bool`, `deviceName: string`, `led: string` ("blink"|"solid"|"off")
- **Simulation:** Blink then pair then solid LED lifecycle
- **Events:** `onPair(device)`, `onData(bytes)`
- **Pins:** VCC (power), GND (ground), TX (uart, output), RX (uart, input), STATE (gpio, output), EN (gpio, input)
- **Validation:** `bus = "uart"`

#### `[ ] HW_NRF24`
- **What it is:** 2.4GHz wireless transceiver nRF24L01
- **Visual:** Green PCB, silver antenna (or PCB antenna), 2x4 pin header
- **Internal coords:** 120x100
- **Props:** `channel: number`, `txPower: string`, `dataRate: string`, `sending: bool`
- **Visual state:** TX animation (pulse from antenna) when sending
- **Events:** `onReceive(pipe, data)`
- **Pins:** VCC (power), GND (ground), CE (gpio), CSN (spi), SCK (spi), MOSI (spi), MISO (spi), IRQ (gpio)
- **Validation:** `bus = "spi"`

#### `[ ] HW_GPS`
- **What it is:** u-blox NEO-6M GPS module with ceramic antenna
- **Visual:** PCB with large beige ceramic antenna, LED, 4-pin header
- **Internal coords:** 140x140
- **Props:** `latitude: number`, `longitude: number`, `altitude: number`, `satellites: number`, `fix: bool`
- **Visual state:** LED blinks on fix, satellite count display
- **Simulation:** Walks a fake GPS path, slow satellite acquisition
- **Events:** `onFix(lat, lon, alt, satellites)`
- **Pins:** VCC (power), GND (ground), TX (uart, output), RX (uart, input)
- **Validation:** `bus = "uart"`

#### `[ ] HW_RFID`
- **What it is:** MFRC522 RFID reader, 13.56MHz
- **Visual:** Blue PCB, copper coil antenna visible, 8 pins, LED
- **Internal coords:** 160x160
- **Props:** `cardPresent: bool`, `uid: string`, `cardType: string`
- **Visual state:** LED lights on card detect, RF field animation
- **Simulation:** Periodic card detect/remove cycle
- **Events:** `onCardDetect(uid, type)`, `onCardRemove()`
- **Pins:** VCC (power), GND (ground), RST (gpio), IRQ (gpio), MISO (spi), MOSI (spi), SCK (spi), SDA/CS (spi)
- **Validation:** `bus = "spi"`

---

### CATEGORY: Passive Components (`passive/`)
The boring-but-essential bits that complete every circuit.

#### `[ ] HW_Breadboard` — **SEE "Platform Objects" SECTION ABOVE**
- This is NOT a regular part. It is a platform object with subsystem-level complexity.
- Full spec is in the dedicated Platform Objects section.

#### `[ ] HW_BreadboardPSU`
- **What it is:** MB102 breadboard power supply module, USB or DC jack input, 3.3V/5V selectable
- **Visual:** PCB that plugs onto breadboard power rails, USB port, DC jack, on/off switch, 3.3V/5V jumpers, power LED
- **Internal coords:** 200x60
- **Props:** `voltage: string` ("3.3"|"5"), `on: bool`, `inputType: string` ("usb"|"dc")
- **Visual state:** LED on/off, jumper position
- **Events:** none (`interactive = false`)
- **Pins:** 5V (power), 3.3V (power), GND (ground), VIN (power)

#### `[ ] HW_Resistor`
- **What it is:** Through-hole resistor with color bands
- **Visual:** Tan body with 4-5 color bands, two leads
- **Internal coords:** 80x20
- **Props:** `ohms: number` — auto-calculates color bands
- **Render:** Color bands computed from resistance value (standard 4-band color code)
- **Pins:** A (gpio, bidirectional), B (gpio, bidirectional)

#### `[ ] HW_Capacitor`
- **What it is:** Ceramic disc or electrolytic capacitor
- **Visual:** Ceramic = small orange/blue disc, 2 leads. Electrolytic = cylinder with stripe, + marking, 2 leads
- **Internal coords:** 40x30 (ceramic), 40x60 (electrolytic)
- **Props:** `type: string` ("ceramic"|"electrolytic"), `value: number` (uF), `voltage: number`
- **Pins:** PLUS (power, input), MINUS (ground) [electrolytic]; A/B (bidirectional) [ceramic]

#### `[ ] HW_LED`
- **What it is:** Standard 5mm through-hole LED
- **Visual:** Colored dome, 2 leads (long=anode), glow effect when on
- **Internal coords:** 30x50
- **Props:** `color: string`, `on: bool`, `brightness: number` (0-1)
- **Render:** Dome with glow halo when lit, same glow technique as LED matrix
- **Pins:** ANODE (gpio, input), CATHODE (ground)
- **Validation:** `requirements = {"series_resistor"}`

#### `[ ] HW_Diode`
- **What it is:** 1N4007 rectifier diode
- **Visual:** Black cylinder with silver band (cathode), 2 leads
- **Internal coords:** 60x20
- **Props:** `forward: bool` (orientation indicator)
- **Pins:** ANODE (gpio, bidirectional), CATHODE (gpio, bidirectional)

#### `[ ] HW_Transistor`
- **What it is:** 2N2222 NPN transistor (TO-92 package)
- **Visual:** Black half-cylinder, flat face, 3 leads (E/B/C), label
- **Internal coords:** 40x50
- **Props:** `type: string` ("NPN"|"PNP"), `model: string`, `active: bool`
- **Visual state:** Small indicator when conducting
- **Pins:** E (gpio, bidirectional), B (gpio, input), C (gpio, bidirectional)

#### `[ ] HW_Wire` — **SEE "Platform Objects" SECTION ABOVE**
- This is NOT a regular capability. It is owned by System B (netlist/wiring).
- Full spec is in the dedicated Platform Objects section.

---

### CATEGORY: Motor & Motion (`motor/`)
Beyond basic servo/DC — the parts for robotics projects.

#### `[ ] HW_StepperNEMA17`
- **What it is:** NEMA 17 stepper motor, the standard 3D printer motor
- **Visual:** Square faceplate with mounting holes, round center shaft, 4-wire cable
- **Internal coords:** 140x140
- **Props:** `angle: number`, `speed: number` (RPM), `enabled: bool`, `microstep: number`
- **Visual state:** Shaft rotation with step granularity visible at low speeds
- **Pins:** A1/A2/B1/B2 (gpio, input)

#### `[ ] HW_MotorDriver_A4988`
- **What it is:** A4988 stepper driver (Pololu-style), the 3D printer driver
- **Visual:** Small red/green PCB, chip with heatsink, 16 pins, potentiometer
- **Internal coords:** 60x100
- **Props:** `enabled: bool`, `step: bool`, `direction: bool`, `microstep: number`, `currentLimit: number`
- **Visual state:** Pulse animation on step, direction arrow
- **Pins:** VDD/VMOT (power), GND x2 (ground), STEP (gpio, input), DIR (gpio, input), EN (gpio, input), MS1/MS2/MS3 (gpio, input), RESET/SLEEP (gpio, input), 1A/1B/2A/2B (power, output)

---

### CATEGORY: Breakout Boards & Modules (`breakout/`)
Pre-assembled modules that integrate multiple ICs for a specific purpose.

#### `[ ] HW_RTC`
- **What it is:** DS3231 real-time clock module with battery backup
- **Visual:** Blue/purple PCB, DS3231 IC, coin cell holder, 6 pins, crystal
- **Internal coords:** 120x100
- **Props:** `time: string` (HH:MM:SS), `date: string` (YYYY-MM-DD), `alarm: bool`
- **Simulation:** Runs real-time, configurable start time
- **Events:** `onAlarm()`, `onTick(time, date)`
- **Pins:** VCC (power), GND (ground), SCL (i2c), SDA (i2c), SQW (gpio, output), 32K (gpio, output)
- **Validation:** `bus = "i2c"`, `i2cAddress = 0x68`

#### `[ ] HW_MicroSD`
- **What it is:** MicroSD card breakout, SPI
- **Visual:** Blue PCB, SD card slot, 6 pins
- **Internal coords:** 100x80
- **Props:** `inserted: bool`, `activity: bool`
- **Visual state:** LED flicker on read/write activity
- **Events:** `onMount(sizeGB)`, `onError(msg)`
- **Pins:** VCC (power), GND (ground), CS (spi), MOSI (spi), MISO (spi), SCK (spi)
- **Validation:** `bus = "spi"`

#### `[ ] HW_AudioAmp`
- **What it is:** MAX98357 I2S audio amplifier breakout
- **Visual:** Small purple/red PCB, speaker terminal, 7 pins
- **Internal coords:** 100x60
- **Props:** `playing: bool`, `volume: number`
- **Visual state:** Sound wave animation when playing
- **Pins:** VIN (power), GND (ground), SD (gpio), GAIN (gpio), DIN (data), BCLK (data), LRC (data)

---

## Priority Tiers (for parallel assignment)

### Tier 0 — Shared Foundations (build FIRST, before ANY parts)
1. `_colors.lua` — shared color palette
2. `_draw.lua` — shared drawing helpers
3. `_simulate.lua` — shared simulation helpers
4. `_anchors.lua` — shared anchor/pin helpers
5. `_layout.lua` — shared board layout helpers

**No part may be started until Tier 0 is complete and committed.**

### Tier 1 — Minimum Viable Playground (9 parts)
These are the parts that make the playground feel real:
1. `HW_Breadboard` — the canvas everything sits on (PLATFORM OBJECT — extra weight)
2. `HW_LED` — simplest output, instant gratification
3. `HW_Button` — simplest input
4. `HW_ArduinoUno` — the brain
5. `HW_Wire` — connect things (may be part of netlist system instead)
6. `HW_Resistor` — every circuit needs them
7. `HW_SevenSegment` — impressive visual output
8. `HW_Servo` — first moving part
9. `HW_Potentiometer` — interactive analog input, drag interaction primitive

### Tier 2 — Core sensor/display kit (8 parts)
10. `HW_DHT22` — most popular sensor
11. `HW_HC_SR04` — ultrasonic distance (cool wave animation)
12. `HW_OLED_SSD1306` — pixel display
13. `HW_LCD_HD44780` — character display
14. `HW_NeopixelStrip` — RGB LEDs
15. `HW_RotaryEncoder` — interactive input
16. `HW_Buzzer` — audio feedback
17. `HW_Joystick` — dual-axis interactive

### Tier 3 — Communication & advanced (7 parts)
18. `HW_ESP32DevKit` — WiFi/BLE board
19. `HW_Bluetooth` — wireless
20. `HW_Relay` — power switching
21. `HW_DCMotor` — motor control
22. `HW_Stepper` — precision motion
23. `HW_GPS` — location
24. `HW_RFID` — contactless ID

### Tier 4 — Completeness
Everything else — round out the catalog.

---

## Parallel Work Assignment

### Phase 0 — Foundations (1 Claude, blocks everything else)
Build all 5 shared modules in `lua/capabilities/hw/`. Commit. Then parts can begin.

### Phase 1 — Parts (N Claudes in parallel)
Each Claude picks a slice and builds:
1. The Lua capability file in `lua/capabilities/hw/<category>/`
2. Following the mandatory skeleton EXACTLY
3. Using shared helpers from `_colors`, `_draw`, `_simulate`, `_anchors`, `_layout`
4. Register it in capabilities system
5. Test it standalone: `<Native type="HW_PartName" style={{width: 200, height: 200}} />`
6. Pass the quality acceptance checklist

**Assignment slices (suggested, can redistribute):**
- Claude A: `HW_ArduinoUno`, `HW_ArduinoNano`, `HW_ESP32DevKit`, `HW_RaspberryPiGPIO`
- Claude B: `HW_LED`, `HW_Resistor`, `HW_Capacitor`, `HW_Diode`, `HW_Transistor`, `HW_Button`
- Claude C: `HW_SevenSegment`, `HW_OLED_SSD1306`, `HW_LCD_HD44780`, `HW_NeopixelStrip`
- Claude D: `HW_Servo`, `HW_DCMotor`, `HW_Stepper`, `HW_Relay`, `HW_Buzzer`
- Claude E: `HW_DHT22`, `HW_HC_SR04`, `HW_PIR`, `HW_BMP280`, `HW_MPU6050`, `HW_Photoresistor`
- Claude F: `HW_RotaryEncoder`, `HW_Joystick`, `HW_Keypad`, `HW_Potentiometer`
- Claude G: `HW_Breadboard` (solo — it's a platform object with subsystem complexity)
- Claude H: `HW_ESP8266`, `HW_Bluetooth`, `HW_NRF24`, `HW_GPS`, `HW_RFID`

### Phase 2 — Integration (after parts exist)
- Playground story in storybook: parts picker sidebar, canvas area, code panel
- Wiring system (System B): click-to-connect between anchors
- Circuit simulation: signal propagation between connected parts
- Hardware backend (System C): route to real GPIO/I2C/Serial/SPI

---

## Visual Quality Bar

Look at `pcb_board.lua` and `led_matrix.lua`. That's the bar. Every part must:
- Be immediately recognizable to someone who has used the real thing
- **Read clearly at thumbnail scale** — identifiable even in a 60x60 sidebar tile
- Scale cleanly to any container size (internal coord system + uniform scale)
- Have at least one animated/live state (LED glow, blink, pulse, rotation) — not static
- Use the shared color palette (`_colors.lua`) for consistency — no local hex values
- Use the shared drawing helpers (`_draw.lua`) — no duplicate glow/pad/IC helpers
- Render at 60fps with no per-frame allocations (pre-compute in tick, draw in render)

---

## Implementation Execution Phases

### Phase 0 — Foundations
Build: `_colors.lua`, `_draw.lua`, `_simulate.lua`, `_anchors.lua`, `_layout.lua`
Gate: committed and importable before any part begins.

### Phase 1 — Minimal Believable Loop
Build: `HW_LED`, `HW_Button`, `HW_Resistor`, `HW_Wire`, `HW_ArduinoUno`, simple non-breadboard canvas.
Goal: click button, LED changes, pin highlight works.

### Phase 2 — First "Wow" Board
Build: `HW_Breadboard`, `HW_Potentiometer`, `HW_Servo`, `HW_SevenSegment`
Goal: basic breadboard placement + wiring + live simulation.

### Phase 3 — Display/Sensor Expansion
Build: `HW_DHT22`, `HW_HC_SR04`, `HW_OLED_SSD1306`, `HW_LCD_HD44780`, `HW_NeopixelStrip`
Goal: rich sensor data flowing to rich display output.

### Phase 4 — Real Backend Bridge
Map selected parts to: GPIO, PWM, Serial, I2C, SPI.
Goal: same code, real hardware, zero prop changes.
