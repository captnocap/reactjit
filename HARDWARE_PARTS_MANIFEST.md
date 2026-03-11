# Hardware Parts Manifest — Virtual Component Playground

## Foundation Rules (NON-NEGOTIABLE)

Every part in this catalog becomes a **Lua visual capability**. Not a React component.
Not a .tslx. Not a useEffect animation. Pure Lua.

- `render(node, canvas, opacity)` — all drawing via `love.graphics`
- `tick(node, dt)` — all animation, simulation state, timing
- `pushEvent(node, name, data)` — all events back to React
- React's only job: `<Native type="DHT22" temp={22.5} />` — declare and pass props
- Zero JS in the visual/interactive loop. LuaJIT runs at 60fps. QuickJS does not.

### Reference implementations
- `lua/capabilities/pcb_board.lua` — visual: IC chips, traces, pin headers, LED glow
- `lua/capabilities/led_matrix.lua` — visual + animation: NxM grid, patterns, scroll text
- `lua/capabilities/gpio_pin.lua` — non-visual: real hardware I/O lifecycle

### File convention
Each part: `lua/capabilities/hw/<category>/<part_name>.lua`
Each part registers via `Capabilities.register("HW_PartName", { visual = true, ... })`
React usage: `<Native type="HW_PartName" prop1={val} />`

### Rendering pattern (copy this)
```lua
local function render(node, c, opacity)
  local x, y = node.layout.x, node.layout.y
  local w, h = node.layout.width, node.layout.height
  -- Scale internal coordinate system to fit container
  local scaleX = w / INTERNAL_W
  local scaleY = h / INTERNAL_H
  local scale = math.min(scaleX, scaleY)
  love.graphics.push()
  love.graphics.translate(x + (w - INTERNAL_W * scale) / 2, y + (h - INTERNAL_H * scale) / 2)
  love.graphics.scale(scale)
  -- ... draw at internal coordinates ...
  love.graphics.pop()
end
```

### Simulation model
Each part has two modes, selected by a `simulate` prop (default true in playground):
- **simulate = true**: Part runs its own physics/behavior in `tick()`. A DHT22 generates
  fake temperature curves. A servo animates to target angle. An OLED renders pixel buffer.
- **simulate = false**: Part talks to real hardware via the gpio/i2c/serial modules.
  Same visual, real data.

React code is identical in both modes. That's the whole point.

---

## Parts Catalog

Status key: `[ ]` not started, `[~]` in progress, `[x]` done

---

### CATEGORY: Development Boards
The brain of every project. Pin headers, power rails, status LEDs.

#### `[x] PCBBoard` (exists — lua/capabilities/pcb_board.lua)
- Generic stylized PCB. Already renders IC chips, headers, traces, LED.
- Reference implementation for all board visuals.

#### `[ ] ArduinoUno`
- **What it is:** ATmega328P dev board, the most common starter board on earth
- **Visual:** Blue PCB, USB-B port, DC barrel jack, crystal, ATmega328P DIP-28, reset button, 2x digital pin headers (D0-D13), 1x analog header (A0-A5), 1x power header, L/TX/RX/ON LEDs, ICSP header
- **Internal coords:** 400x260 (real board is ~68.6x53.4mm)
- **Interactive surfaces:** Pin headers highlight on hover, LEDs animate, reset button is pressable
- **Props:** `digitalPins: number[]` (D0-D13 HIGH/LOW state), `analogPins: number[]` (A0-A5 0-1023), `powerLed: bool`, `txLed: bool`, `rxLed: bool`, `userLed: bool` (pin 13)
- **Events:** `onPinTap(pin, type)` — user clicked a pin
- **Simulation:** TX/RX LEDs flicker when serial data flows, user LED mirrors D13 state

#### `[ ] ArduinoNano`
- **What it is:** Compact ATmega328P board, breadboard-friendly
- **Visual:** Blue/black PCB, mini-USB, pin headers along both long edges, smaller form factor
- **Internal coords:** 340x140 (real: 45x18mm)
- **Props:** Same as Uno but compact layout
- **Events:** `onPinTap(pin, type)`

#### `[ ] ESP32DevKit`
- **What it is:** ESP-WROOM-32 module on breakout board, WiFi + BLE
- **Visual:** Black PCB, USB-C/micro-USB, silver RF shield with ESP32 label, 2x15 pin headers, EN + BOOT buttons, red power LED
- **Internal coords:** 360x180
- **Props:** `pins: table`, `wifiConnected: bool`, `bleConnected: bool`, `powerLed: bool`
- **Events:** `onPinTap(pin)`, `onBootPress()`, `onResetPress()`
- **Simulation:** WiFi icon indicator, BLE icon indicator

#### `[ ] RaspberryPiGPIO`
- **What it is:** 40-pin GPIO header as found on Pi 3/4/5
- **Visual:** Green PCB snippet showing the 2x20 pin header, color-coded by function (power=red, ground=black, GPIO=green, I2C=blue, SPI=purple, UART=orange), pin numbers and BCM labels
- **Internal coords:** 300x200
- **Props:** `pinStates: table` (BCM number -> HIGH/LOW), `i2cActive: bool`, `spiActive: bool`, `uartActive: bool`
- **Events:** `onPinTap(bcm, physicalPin)`
- **Note:** This is just the header, not the full Pi board — meant for wiring diagrams

#### `[ ] STM32BluePill`
- **What it is:** STM32F103C8T6 board, popular cheap ARM board
- **Visual:** Blue PCB, micro-USB, STM32 chip (QFP-48), 2x20 pin headers, reset button, boot jumpers, power LED
- **Internal coords:** 360x160
- **Props:** `pins: table`, `bootMode: number` (0 or 1)

---

### CATEGORY: Displays
Visual output — the things people want to see working first.

#### `[x] LEDMatrix` (exists — lua/capabilities/led_matrix.lua)
- NxM dot matrix with glow effects, patterns, scroll text. Already done.

#### `[ ] OLED_SSD1306`
- **What it is:** 0.96" 128x64 monochrome OLED, I2C (addr 0x3C). The most common small display.
- **Visual:** Black PCB, 4-pin header (GND/VCC/SCL/SDA), display area with pixel grid, blue or white pixels on black. Slight bezel.
- **Internal coords:** 200x160 (PCB), display area 128x64 logical pixels
- **Render:** Pixel buffer as Lua table, drawn as tiny filled rects. Glow optional for OLED look.
- **Props:** `pixels: string` (base64 encoded 128x64 bitmap or nil for built-in demo), `contrast: number`, `inverted: bool`, `enabled: bool`
- **Simulation:** If no pixel data provided, cycles demo screens (logo, text, bars, scrolling)
- **Events:** none (display only)
- **Text rendering:** Built-in 5x7 font (extend from LED matrix font), `drawText(x, y, str)` helper

#### `[ ] LCD_HD44780`
- **What it is:** 16x2 or 20x4 character LCD, parallel or I2C backpack
- **Visual:** Green/blue background with dark characters, 16-pin header or 4-pin I2C, potentiometer for contrast, backlight glow
- **Internal coords:** 320x120 (16x2), 380x160 (20x4)
- **Render:** Character cells on a grid, each cell is a 5x8 dot matrix. Background glow.
- **Props:** `cols: number` (16/20), `rows: number` (2/4), `text: string[]` (array of row strings), `backlight: bool`, `cursorPos: {row, col}`, `cursorBlink: bool`, `contrast: number`
- **Simulation:** Cursor blink animation, backlight on/off transition
- **Events:** none (display only)

#### `[ ] SevenSegment`
- **What it is:** 7-segment LED display (1-8 digits), common anode/cathode
- **Visual:** Dark PCB, each digit is 7 segments + decimal point, LED glow effect per segment
- **Internal coords:** 60 per digit width, 100 height
- **Props:** `digits: number` (1-8), `value: string` (e.g. "12.34"), `color: string`, `leadingZeros: bool`, `colonPosition: number` (for clock displays)
- **Simulation:** Segment-by-segment rendering with glow, colon blink for clock mode
- **Events:** none

#### `[ ] NeopixelStrip`
- **What it is:** WS2812B addressable RGB LED strip/ring
- **Visual:** Black flex PCB strip with round RGB LEDs, or circular ring layout
- **Props:** `count: number`, `layout: "strip"|"ring"|"matrix"`, `colors: number[]` (packed RGB per LED), `brightness: number`
- **Render:** Each LED is a circle with RGB color and glow. Ring mode arranges in circle. Matrix mode arranges in grid.
- **Simulation:** Rainbow cycle, chase, breathe, solid — selectable via `pattern` prop
- **Events:** none

#### `[ ] TFT_ST7789`
- **What it is:** 1.3"/1.54" 240x240 or 240x320 color TFT display, SPI
- **Visual:** Black PCB, 7-8 pin header, full color display area
- **Internal coords:** 280x300 (with PCB border)
- **Props:** `width: number`, `height: number`, `framebuffer: string` (RGB565 base64), `rotation: number`
- **Simulation:** Color bars, bouncing logo, gradient demo
- **Note:** Higher complexity — good stretch goal

#### `[ ] EInk_IL3829`
- **What it is:** 2.13" e-ink/e-paper display (common Waveshare modules), SPI
- **Visual:** White PCB, display area with papery texture, slow refresh animation
- **Props:** `pixels: string`, `partialRefresh: bool`
- **Simulation:** Full refresh animation (black flash → image), partial refresh for clock demo
- **Render:** Black/white/red pixels on off-white background, slight paper texture

---

### CATEGORY: Sensors
The input side — temperature, distance, motion, light, pressure.

#### `[ ] DHT22`
- **What it is:** Digital temperature + humidity sensor (also DHT11 variant)
- **Visual:** White plastic housing with grid ventilation pattern, 4 pins (VCC, DATA, NC, GND), small PCB breakout option
- **Internal coords:** 120x160
- **Props:** `temperature: number` (-40 to 80 C), `humidity: number` (0-100%), `variant: "DHT11"|"DHT22"`
- **Visual state:** Small readout text on the part showing current values, data pin pulses on read
- **Simulation:** Generates slow sine-wave temperature (20-28C) and humidity (40-65%) curves with noise
- **Events:** `onRead(temp, humidity)` — fires at configurable interval

#### `[ ] HC_SR04`
- **What it is:** Ultrasonic distance sensor, the one with two silver cylinders
- **Visual:** Blue PCB, two silver ultrasonic transducers (circles), 4-pin header (VCC/TRIG/ECHO/GND), crystal oscillator
- **Internal coords:** 180x120
- **Props:** `distance: number` (2-400 cm), `measuring: bool`
- **Visual state:** Animated sound wave arcs emanating from transducers when measuring, distance readout
- **Simulation:** Returns configurable distance, animated wave pulse visualization
- **Events:** `onMeasure(distanceCm)`

#### `[ ] PIR_HCSR501`
- **What it is:** Passive infrared motion sensor, the dome one
- **Visual:** Green PCB, white Fresnel lens dome, 3 pins (VCC/OUT/GND), two potentiometers (sensitivity + delay)
- **Internal coords:** 140x140
- **Props:** `motionDetected: bool`, `sensitivity: number`, `delay: number`
- **Visual state:** Dome lights up / pulses when motion detected, LED indicator
- **Simulation:** Random motion triggers based on sensitivity setting
- **Events:** `onMotion(detected: bool)`

#### `[ ] BMP280`
- **What it is:** Barometric pressure + temperature sensor, I2C, tiny breakout board
- **Visual:** Purple/blue PCB, small silver sensor package, 4-6 pin header
- **Internal coords:** 100x80
- **Props:** `temperature: number`, `pressure: number` (hPa), `altitude: number` (m)
- **Simulation:** Slow pressure/temp curves simulating weather changes
- **Events:** `onRead(temp, pressure, altitude)`

#### `[ ] MPU6050`
- **What it is:** 6-axis accelerometer + gyroscope, I2C
- **Visual:** Purple breakout board, small QFN IC, 8 pin header
- **Internal coords:** 120x80
- **Props:** `accel: {x,y,z}` (g), `gyro: {x,y,z}` (deg/s), `temperature: number`
- **Visual state:** Tilt visualization — a small 3D box that rotates based on accel/gyro
- **Simulation:** Gentle wobble/drift or user-interactive tilt
- **Events:** `onRead(accel, gyro, temp)`

#### `[ ] Photoresistor`
- **What it is:** LDR (light-dependent resistor), analog sensor
- **Visual:** Small disc with squiggly trace pattern, 2 leads, on mini breakout or bare
- **Internal coords:** 60x80
- **Props:** `lightLevel: number` (0-1023 analog), `resistance: number` (ohms)
- **Simulation:** Slow ambient light variation
- **Events:** `onRead(value)`

#### `[ ] SoilMoisture`
- **What it is:** Capacitive soil moisture sensor, analog
- **Visual:** Long green PCB probe with traces, 3-pin header
- **Internal coords:** 60x200
- **Props:** `moisture: number` (0-100%), `raw: number` (0-1023)
- **Simulation:** Slowly drying out then watered
- **Events:** `onRead(moisture, raw)`

#### `[ ] IR_Receiver`
- **What it is:** VS1838B IR receiver, 38kHz, used with remote controls
- **Visual:** Dark dome on 3 pins, often on small PCB with LED indicator
- **Internal coords:** 80x60
- **Props:** `lastCode: string`, `protocol: string`
- **Simulation:** Generates NEC protocol codes as if receiving remote presses
- **Events:** `onReceive(code, protocol)`

---

### CATEGORY: Actuators
Things that move, make noise, or switch power.

#### `[ ] Servo_SG90`
- **What it is:** Micro servo motor, 0-180 degrees, the tiny blue one
- **Visual:** Blue plastic body, output shaft with horn (white cross/arm), 3-wire cable (brown/red/orange)
- **Internal coords:** 140x120
- **Props:** `angle: number` (0-180), `speed: number` (deg/s for animation), `hornType: "cross"|"arm"|"wheel"`
- **Visual state:** Horn rotates to target angle with smooth animation in tick()
- **Simulation:** Smooth rotation to target angle with configurable speed
- **Events:** `onReach(angle)` — fires when servo reaches target

#### `[ ] DCMotor_L298N`
- **What it is:** L298N dual H-bridge motor driver + DC motor
- **Visual:** Red PCB driver board with heatsink, screw terminals, 2x DC motors with spinning shaft visualization
- **Internal coords:** 240x180
- **Props:** `motorA: {speed: number, direction: "cw"|"ccw"|"stop"}`, `motorB: same`, `enableA: bool`, `enableB: bool`
- **Visual state:** Motor shafts rotate at visual speed, direction arrows
- **Simulation:** Motor spin animation proportional to speed value
- **Events:** none (output only)

#### `[ ] Stepper_28BYJ48`
- **What it is:** 5V stepper motor with ULN2003 driver board
- **Visual:** Silver motor cylinder, blue driver PCB with 4 LEDs (A/B/C/D phases), 5-pin connector
- **Internal coords:** 200x140
- **Props:** `targetSteps: number`, `speed: number` (RPM), `direction: "cw"|"ccw"`, `stepMode: "full"|"half"`
- **Visual state:** Phase LEDs sequence, motor shaft rotates with step counting
- **Simulation:** Step sequence animation with LED phases
- **Events:** `onStep(currentStep, totalSteps)`, `onComplete()`

#### `[ ] RelayModule`
- **What it is:** 5V relay module (1/2/4 channel), optoisolated
- **Visual:** Blue PCB, relay cube(s) with markings, LED indicator, screw terminals (NO/NC/COM), signal pins
- **Internal coords:** 160x100 (1ch), 280x100 (2ch)
- **Props:** `channels: number` (1-4), `states: bool[]` (per channel on/off)
- **Visual state:** LED lights up, relay "clicks" (brief position shift animation), contact indicator switches NO/NC
- **Simulation:** Click animation + LED toggle
- **Events:** `onToggle(channel, state)`

#### `[ ] Buzzer`
- **What it is:** Piezo buzzer, active or passive
- **Visual:** Black cylinder on small PCB, 2 pins, + marking
- **Internal coords:** 80x80
- **Props:** `active: bool`, `frequency: number` (passive mode), `playing: bool`
- **Visual state:** Vibration animation (subtle oscillation) when playing, sound wave rings
- **Simulation:** Visual-only (sound wave animation). Real mode uses PWM.
- **Events:** none

---

### CATEGORY: Input Devices
Buttons, knobs, keypads — human-to-circuit interfaces.

#### `[ ] RotaryEncoder`
- **What it is:** KY-040 rotary encoder with push button
- **Visual:** Blue PCB, silver knob with knurled shaft, 5 pins (CLK/DT/SW/+/GND)
- **Internal coords:** 100x120
- **Props:** `value: number` (cumulative position), `pressed: bool`, `detents: number` (clicks per revolution)
- **Visual state:** Knob rotates with value, press animation
- **Interactive:** Mouse wheel or drag to rotate in simulation
- **Events:** `onRotate(direction: "cw"|"ccw", value)`, `onPress()`, `onRelease()`

#### `[ ] JoystickModule`
- **What it is:** Dual-axis analog joystick with button (PS2 style)
- **Visual:** Black PCB, joystick cap (red/black), 5 pins (VRx/VRy/SW/5V/GND)
- **Internal coords:** 120x120
- **Props:** `x: number` (-1 to 1), `y: number` (-1 to 1), `pressed: bool`
- **Visual state:** Stick visual tilts to match x/y, press animation
- **Interactive:** Mouse drag to move stick in simulation
- **Events:** `onMove(x, y)`, `onPress()`, `onRelease()`

#### `[ ] Keypad4x4`
- **What it is:** 4x4 membrane matrix keypad (0-9, A-D, *, #)
- **Visual:** White/grey membrane pad, 16 keys with labels, 8 pin ribbon cable
- **Internal coords:** 200x260
- **Props:** `pressedKey: string|nil`
- **Visual state:** Key press/release animation (darken on press)
- **Interactive:** Click keys in simulation
- **Events:** `onKeyDown(key: string)`, `onKeyUp(key: string)`

#### `[ ] Potentiometer`
- **What it is:** 10K rotary potentiometer (the knob with 3 pins)
- **Visual:** Blue/black body, metal shaft, 3 pins
- **Internal coords:** 80x100
- **Props:** `value: number` (0-1), `taper: "linear"|"log"`
- **Visual state:** Shaft rotation indicator
- **Interactive:** Mouse drag to rotate
- **Events:** `onChange(value: number)`

#### `[ ] Tactile Button`
- **What it is:** 6mm tactile switch, the tiny clicky ones
- **Visual:** Small square, 4 pins, colored cap options (red/blue/green/yellow/black)
- **Internal coords:** 40x40
- **Props:** `pressed: bool`, `color: string`
- **Visual state:** Depress animation on press
- **Interactive:** Click to press in simulation
- **Events:** `onPress()`, `onRelease()`

---

### CATEGORY: Communication Modules
WiFi, Bluetooth, Radio, GPS, RFID.

#### `[ ] ESP8266_Module`
- **What it is:** ESP-01 WiFi module, the tiny blue one with 8 pins
- **Visual:** Blue PCB, black antenna trace, 2x4 pin header, red power LED
- **Internal coords:** 120x100
- **Props:** `connected: bool`, `ssid: string`, `rssi: number`, `ip: string`
- **Visual state:** LED on when powered, WiFi signal strength bars
- **Simulation:** Fake connection lifecycle, signal strength variation
- **Events:** `onConnect(ip)`, `onDisconnect()`, `onData(payload)`

#### `[ ] HC05_Bluetooth`
- **What it is:** HC-05 Bluetooth SPP module
- **Visual:** PCB with black Bluetooth module, red LED (blink=searching, solid=paired), 6 pins
- **Internal coords:** 140x80
- **Props:** `paired: bool`, `deviceName: string`, `led: "blink"|"solid"|"off"`
- **Simulation:** Blink → pair → solid LED lifecycle
- **Events:** `onPair(device)`, `onData(bytes)`

#### `[ ] NRF24L01`
- **What it is:** 2.4GHz wireless transceiver
- **Visual:** Green PCB, silver antenna (or PCB antenna), 2x4 pin header
- **Internal coords:** 120x100
- **Props:** `channel: number`, `txPower: string`, `dataRate: string`, `sending: bool`
- **Visual state:** TX animation (pulse from antenna) when sending
- **Events:** `onReceive(pipe, data)`

#### `[ ] GPS_NEO6M`
- **What it is:** u-blox NEO-6M GPS module with ceramic antenna
- **Visual:** PCB with large beige ceramic antenna, LED, 4-pin header
- **Internal coords:** 140x140
- **Props:** `latitude: number`, `longitude: number`, `altitude: number`, `satellites: number`, `fix: bool`
- **Visual state:** LED blinks on fix, satellite count display
- **Simulation:** Walks a fake GPS path, slow satellite acquisition
- **Events:** `onFix(lat, lon, alt, satellites)`

#### `[ ] RFID_RC522`
- **What it is:** MFRC522 RFID reader, 13.56MHz
- **Visual:** Blue PCB, copper coil antenna visible, 8 pins, LED
- **Internal coords:** 160x160
- **Props:** `cardPresent: bool`, `uid: string`, `cardType: string`
- **Visual state:** LED lights on card detect, RF field animation
- **Simulation:** Periodic card detect/remove cycle
- **Events:** `onCardDetect(uid, type)`, `onCardRemove()`

---

### CATEGORY: Power & Passive Components
The boring-but-essential bits that complete every circuit.

#### `[ ] Breadboard`
- **What it is:** 830-point solderless breadboard (or half-size 400)
- **Visual:** White/cream body, 5-hole rows, power rails (red/blue), center channel, labeled columns (a-j) and rows (1-63)
- **Internal coords:** 600x200 (full), 300x200 (half)
- **Props:** `size: "full"|"half"`, `connections: table` (list of {row, col, color} for placed wires)
- **Render:** Grid of holes, highlighted when connected, wire paths
- **Interactive:** This is the canvas base — wires drawn between holes
- **Note:** This is the most complex single part. It's the foundation of the playground.

#### `[ ] BreadboardPSU`
- **What it is:** MB102 breadboard power supply module, USB or DC jack input, 3.3V/5V selectable
- **Visual:** PCB that plugs onto breadboard power rails, USB port, DC jack, on/off switch, 3.3V/5V jumpers, power LED
- **Internal coords:** 200x60
- **Props:** `voltage: "3.3"|"5"`, `on: bool`, `inputType: "usb"|"dc"`
- **Visual state:** LED on/off, jumper position
- **Events:** none

#### `[ ] Resistor`
- **What it is:** Through-hole resistor with color bands
- **Visual:** Tan body with 4-5 color bands, two leads
- **Internal coords:** 80x20
- **Props:** `ohms: number` — auto-calculates color bands
- **Render:** Color bands computed from resistance value (standard color code)

#### `[ ] Capacitor`
- **What it is:** Ceramic disc or electrolytic capacitor
- **Visual:** Ceramic = small orange/blue disc, 2 leads. Electrolytic = cylinder with stripe, + marking, 2 leads
- **Internal coords:** 40x30 (ceramic), 40x60 (electrolytic)
- **Props:** `type: "ceramic"|"electrolytic"`, `value: number` (uF), `voltage: number`

#### `[ ] LED`
- **What it is:** Standard 5mm through-hole LED
- **Visual:** Colored dome, 2 leads (long=anode), glow effect when on
- **Internal coords:** 30x50
- **Props:** `color: string`, `on: bool`, `brightness: number` (0-1)
- **Render:** Dome with glow halo when lit, same glow technique as LED matrix

#### `[ ] Diode`
- **What it is:** 1N4007 rectifier diode
- **Visual:** Black cylinder with silver band (cathode), 2 leads
- **Internal coords:** 60x20
- **Props:** `forward: bool` (orientation indicator)

#### `[ ] Transistor`
- **What it is:** 2N2222 NPN transistor (TO-92 package)
- **Visual:** Black half-cylinder, flat face, 3 leads (E/B/C), label
- **Internal coords:** 40x50
- **Props:** `type: "NPN"|"PNP"`, `model: string`, `active: bool`
- **Visual state:** Small indicator when conducting

#### `[ ] Wire`
- **What it is:** Jumper wire / dupont cable
- **Visual:** Colored insulated wire with pin ends
- **Props:** `from: {x,y}`, `to: {x,y}`, `color: string`, `type: "mm"|"mf"|"ff"` (male-male, male-female, female-female)
- **Render:** Bezier curve between points, colored insulation
- **Note:** Used by the wiring system, not placed standalone

---

### CATEGORY: Motor & Motion
Beyond basic servo/DC — the parts for robotics projects.

#### `[ ] StepperNEMA17`
- **What it is:** NEMA 17 stepper motor, the standard 3D printer motor
- **Visual:** Square faceplate with mounting holes, round center shaft, 4-wire cable
- **Internal coords:** 140x140
- **Props:** `angle: number`, `speed: number` (RPM), `enabled: bool`, `microstep: number`
- **Visual state:** Shaft rotation with step granularity visible at low speeds

#### `[ ] MotorDriver_A4988`
- **What it is:** A4988 stepper driver (Pololu-style), the 3D printer driver
- **Visual:** Small red/green PCB, chip with heatsink, 16 pins, potentiometer
- **Internal coords:** 60x100
- **Props:** `enabled: bool`, `step: bool`, `direction: bool`, `microstep: number`, `currentLimit: number`
- **Visual state:** Pulse animation on step, direction arrow

---

### CATEGORY: Breakout Boards & Modules
Pre-assembled modules that integrate multiple ICs for a specific purpose.

#### `[ ] RTC_DS3231`
- **What it is:** Real-time clock module with battery backup
- **Visual:** Blue/purple PCB, DS3231 IC, coin cell holder, 6 pins, crystal
- **Internal coords:** 120x100
- **Props:** `time: string` (HH:MM:SS), `date: string` (YYYY-MM-DD), `alarm: bool`
- **Simulation:** Runs real-time, configurable start time
- **Events:** `onAlarm()`, `onTick(time, date)`

#### `[ ] MicroSD_Module`
- **What it is:** MicroSD card breakout, SPI
- **Visual:** Blue PCB, SD card slot, 6 pins
- **Internal coords:** 100x80
- **Props:** `inserted: bool`, `activity: bool`
- **Visual state:** LED flicker on read/write activity
- **Events:** `onMount(sizeGB)`, `onError(msg)`

#### `[ ] AudioAmp_MAX98357`
- **What it is:** I2S audio amplifier breakout
- **Visual:** Small purple/red PCB, speaker terminal, 7 pins
- **Internal coords:** 100x60
- **Props:** `playing: bool`, `volume: number`
- **Visual state:** Sound wave animation when playing

---

## Priority Tiers (for parallel assignment)

### Tier 1 — Ship first (makes the playground usable)
These are the parts that make the playground feel real with minimal effort:
1. `Breadboard` — the canvas everything sits on
2. `LED` — simplest output, instant gratification
3. `TactileButton` — simplest input
4. `ArduinoUno` — the brain
5. `Wire` — connect things
6. `Resistor` — every circuit needs them
7. `SevenSegment` — impressive visual output
8. `Servo_SG90` — first moving part

### Tier 2 — Core sensor/display kit
9. `DHT22` — most popular sensor
10. `HC_SR04` — ultrasonic distance (cool wave animation)
11. `OLED_SSD1306` — pixel display
12. `LCD_HD44780` — character display
13. `NeopixelStrip` — RGB LEDs
14. `RotaryEncoder` — interactive input
15. `Buzzer` — audio feedback
16. `Potentiometer` — analog input

### Tier 3 — Communication & advanced
17. `ESP32DevKit` — WiFi/BLE board
18. `HC05_Bluetooth` — wireless
19. `RelayModule` — power switching
20. `DCMotor_L298N` — motor control
21. `Stepper_28BYJ48` — precision motion
22. `GPS_NEO6M` — location
23. `RFID_RC522` — contactless ID

### Tier 4 — Completeness
Everything else — round out the catalog.

---

## Parallel Work Assignment

Each Claude instance picks a tier (or a slice of a tier) and builds:
1. The Lua capability file in `lua/capabilities/hw/<category>/`
2. Register it in capabilities system
3. Test it standalone: `<Native type="HW_PartName" style={{width: 200, height: 200}} />`

### Shared foundations (build BEFORE parts)
- `lua/capabilities/hw/colors.lua` — shared color palette (PCB greens, copper, solder, LED glow colors, wire colors)
- `lua/capabilities/hw/draw.lua` — shared drawing helpers (rounded rect, pad, pin, lead, glow, IC package, resistor color bands)
- `lua/capabilities/hw/simulate.lua` — shared simulation helpers (noise generators, sine curves, random triggers, fake data streams)

### Integration (build AFTER parts)
- Playground story in storybook: parts picker sidebar, canvas area, code panel
- Wiring system: click-to-connect between pins
- Circuit simulation: signal propagation between connected parts

---

## Visual Quality Bar

Look at `pcb_board.lua` and `led_matrix.lua`. That's the bar. Every part should:
- Be immediately recognizable to someone who has used the real thing
- Scale cleanly to any container size (internal coord system + uniform scale)
- Have subtle animation (LED glow, blink, pulse, rotation) — not static
- Use the shared color palette for consistency
- Render at 60fps with no per-frame allocations (pre-compute in tick, draw in render)
