/**
 * GPIO — Hardware I/O documentation page (Layout2 zigzag narrative).
 *
 * Covers all five hardware protocols: digital GPIO, PWM, serial/UART, I2C, SPI.
 * Both declarative components (<Pin>, <PWM>, <SerialPort>, <I2CDevice>, <SPIDevice>)
 * and imperative hooks (usePin, usePWM, useSerial, useI2C).
 * Static hoist ALL code strings and style objects outside the component.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, Native } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#22c55e',
  accentDim: 'rgba(34, 197, 94, 0.12)',
  callout: 'rgba(34, 197, 94, 0.06)',
  calloutBorder: 'rgba(34, 197, 94, 0.30)',
  pin: '#22c55e',
  pwm: '#f59e0b',
  serial: '#3b82f6',
  i2c: '#a855f7',
  spi: '#ef4444',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import {
  usePin, usePWM, useSerial, useI2C,
  Pin, PWM, SerialPort, I2CDevice, SPIDevice,
} from '@reactjit/core'`;

const PIN_DECLARATIVE_CODE = `// Declarative: LED on pin 17
<Pin pin={17} mode="output" value={ledOn} />

// Button on pin 4 with pull-up
<Pin
  pin={4}
  mode="input"
  pull="up"
  edge="both"
  onChange={(e) => setPressed(e.value)}
/>`;

const PIN_HOOK_CODE = `// Imperative: usePin hook
const { value, setValue, lastEdge, element } = usePin(17, 'output')

// Toggle the pin
setValue(!value)

// Render the invisible capability
return <>{element}<Text>{value ? 'HIGH' : 'LOW'}</Text></>`;

const PWM_DECLARATIVE_CODE = `// LED brightness via PWM
<PWM pin={18} duty={brightness} />

// Motor control with frequency
<PWM
  pin={18}
  frequency={500}
  duty={0.5}
  enabled={motorOn}
/>`;

const PWM_HOOK_CODE = `// Imperative: usePWM hook
const { duty, setDuty, frequency, setFrequency, element } = usePWM(18)

// Fade an LED
setDuty(0.75) // 75% brightness

// Change frequency
setFrequency(2000) // 2kHz

return <>{element}<Slider value={duty} onChange={setDuty} /></>`;

const SERIAL_DECLARATIVE_CODE = `// Read serial data line-by-line
<SerialPort
  port="/dev/ttyUSB0"
  baud={115200}
  onLine={(e) => console.log(e.line)}
  onData={(e) => handleRaw(e.data)}
/>

// Custom serial config
<SerialPort
  port="/dev/ttyACM0"
  baud={9600}
  dataBits={8}
  stopBits={1}
  parity="none"
  flowControl="none"
  onLine={(e) => appendLog(e.line)}
/>`;

const SERIAL_HOOK_CODE = `// Imperative: useSerial hook
const { lastLine, lines, send, element } = useSerial(
  '/dev/ttyUSB0',
  115200,
)

// Send data
send('AT+RST\\r\\n')

// Read accumulated lines
lines.forEach(line => console.log(line))

return <>{element}<Text>Last: {lastLine}</Text></>`;

const I2C_CODE = `// Temperature sensor on I2C bus
<I2CDevice
  bus={1}
  address={0x48}
  register={0x00}
  readLength={2}
  pollInterval={100}
  onData={(e) => setTemp(e.value)}
/>`;

const I2C_HOOK_CODE = `// Imperative: useI2C hook
const { value, bytes, element } = useI2C(1, 0x48, {
  register: 0x00,
  readLength: 2,
  pollInterval: 100,
})

// value = decoded register value
// bytes = raw byte array [0x1A, 0x3F]

return <>{element}<Text>Temp: {value}°C</Text></>`;

const SPI_CODE = `// SPI display controller
<SPIDevice
  bus={0}
  device={0}
  speed={1000000}
  mode={0}
  bitsPerWord={8}
/>`;

const HOOK_VS_COMPONENT_CODE = `// Component: embed in JSX tree
<Pin pin={17} mode="output" value={on} />
<PWM pin={18} duty={0.5} />
<SerialPort port="/dev/ttyUSB0" baud={115200} onLine={handleLine} />

// Hook: invisible capability + state + controls
const led = usePin(17, 'output')
const motor = usePWM(18)
const uart = useSerial('/dev/ttyUSB0', 115200)

// Hooks return { element, ...state, ...controls }
// You MUST render element in your tree:
return <>{led.element}{motor.element}{uart.element}</>`;

// ── Protocol catalog data ────────────────────────────────

const PROTOCOLS = [
  { label: 'Digital GPIO', desc: 'Read/write logic levels on pins — buttons, LEDs, relays', color: C.pin, icon: 'zap' },
  { label: 'PWM', desc: 'Pulse-width modulation — LED dimming, motor speed, servo position', color: C.pwm, icon: 'activity' },
  { label: 'Serial / UART', desc: 'Async serial communication — Arduino, GPS, ESP32, modems', color: C.serial, icon: 'terminal' },
  { label: 'I2C', desc: 'Two-wire bus — sensors, displays, EEPROMs, ADCs (400kHz+)', color: C.i2c, icon: 'git-branch' },
  { label: 'SPI', desc: 'High-speed full-duplex bus — displays, SD cards, ADCs (MHz+)', color: C.spi, icon: 'hard-drive' },
] as const;

// ── Tag helper ───────────────────────────────────────────

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{
      backgroundColor: color + '22',
      paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
      borderRadius: 4,
    }}>
      <Text style={{ fontSize: 9, color }}>{text}</Text>
    </Box>
  );
}

// ── Protocol Catalog ─────────────────────────────────────

function ProtocolCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 6, width: '100%' }}>
      {PROTOCOLS.map(p => (
        <Box key={p.label} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 90, flexShrink: 0 }}>{p.label}</Text>
          <Text style={{ fontSize: 10, color: c.muted }}>{p.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── API Catalog ──────────────────────────────────────────

function APICatalog() {
  const c = useThemeColors();

  const hooks = [
    { name: 'usePin(pin, mode?, opts?)', ret: '{ value, setValue, lastEdge, element }', color: C.pin },
    { name: 'usePWM(pin, opts?)', ret: '{ duty, setDuty, frequency, setFrequency, element }', color: C.pwm },
    { name: 'useSerial(port, baud?, opts?)', ret: '{ lastLine, lines, lastData, send, element }', color: C.serial },
    { name: 'useI2C(bus, address, opts?)', ret: '{ value, bytes, element }', color: C.i2c },
  ];

  const components = [
    { name: '<Pin>', props: 'pin, mode, value, pull, edge, activeLow, onChange', color: C.pin },
    { name: '<PWM>', props: 'pin, duty, frequency, enabled', color: C.pwm },
    { name: '<SerialPort>', props: 'port, baud, dataBits, stopBits, parity, flowControl, onLine, onData', color: C.serial },
    { name: '<I2CDevice>', props: 'bus, address, register, readLength, pollInterval, enabled, onData', color: C.i2c },
    { name: '<SPIDevice>', props: 'bus, device, speed, mode, bitsPerWord', color: C.spi },
  ];

  return (
    <Box style={{ gap: 12, width: '100%' }}>
      <Text style={{ fontSize: 11, color: c.text, fontWeight: 'bold' }}>{'Hooks'}</Text>
      <Box style={{ gap: 4 }}>
        {hooks.map(h => (
          <Box key={h.name} style={{ gap: 2 }}>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: h.color, flexShrink: 0 }} />
              <Text style={{ fontSize: 10, color: h.color, fontWeight: 'normal' }}>{h.name}</Text>
            </Box>
            <Text style={{ fontSize: 9, color: c.muted, paddingLeft: 13 }}>{h.ret}</Text>
          </Box>
        ))}
      </Box>

      <Text style={{ fontSize: 11, color: c.text, fontWeight: 'bold' }}>{'Components'}</Text>
      <Box style={{ gap: 4 }}>
        {components.map(comp => (
          <Box key={comp.name} style={{ gap: 2 }}>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: comp.color, flexShrink: 0 }} />
              <Text style={{ fontSize: 10, color: comp.color, fontWeight: 'normal' }}>{comp.name}</Text>
            </Box>
            <Text style={{ fontSize: 9, color: c.muted, paddingLeft: 13 }}>{comp.props}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── GPIOStory ─────────────────────────────────────────

export function GPIOStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="cpu" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Hardware I/O'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'GPIO, PWM, Serial, I2C, SPI — declarative hardware from React'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Control physical hardware with React components and hooks.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Five hardware protocols — digital GPIO, PWM, serial/UART, I2C, SPI — exposed as both declarative JSX components and imperative hooks. Wire an LED, read a sensor, talk to an Arduino. Each protocol has a component for embedding in JSX and a hook for imperative control.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Everything ships in @reactjit/core. Import the components you need (Pin, PWM, SerialPort, I2CDevice, SPIDevice) or the hook equivalents (usePin, usePWM, useSerial, useI2C).'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Live PCB Board visual ── */}
        <Band>
          <Half>
            <SectionLabel icon="cpu" accentColor={C.accent}>{'LIVE HARDWARE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'A stylized PCB with an ATmega microcontroller, voltage regulator, passive components, GPIO pin headers, and a blinking power LED. Everything rendered in Lua at 60fps — copper traces, silkscreen labels, solder joints, mounting holes.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="PCBBoard" color={C.pin} />
              <Tag text="love.graphics" color={C.accent} />
              <Tag text="60fps" color={C.pwm} />
            </Box>
          </Half>
          <Half>
            <Native type="PCBBoard" showLabels ledColor="green" ledBlink style={{ width: '100%', height: 180 }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Live LED Matrix visual ── */}
        <Band>
          <Half>
            <Box style={{ gap: 10, width: '100%', alignItems: 'center' }}>
              <Box style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', width: '100%' }}>
                <Native type="LEDMatrix" color="red" pattern="cycle" style={{ width: 100, height: 100 }} />
                <Native type="LEDMatrix" color="green" pattern="wave" speed={1.5} style={{ width: 100, height: 100 }} />
                <Native type="LEDMatrix" color="blue" pattern="spiral" style={{ width: 100, height: 100 }} />
              </Box>
              <Native type="LEDMatrix" cols={32} rows={8} color="yellow" pattern="scroll" scrollText="REACTJIT GPIO " style={{ width: 280, height: 70 }} />
              <Native type="LEDMatrix" cols={32} rows={32} color="cyan" pattern="spiral" speed={0.8} style={{ width: 140, height: 140 }} />
            </Box>
          </Half>
          <Half>
            <SectionLabel icon="grid" accentColor={C.serial}>{'LED MATRIX'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Any size — 8x8, 8x32, 32x32, 64x64, 128x128. Set rows and cols props to match your physical matrix. Built-in patterns scale via nearest-neighbor sampling. Procedural patterns (wave, rain, spiral) are resolution-independent. Glow effects auto-disable above 1024 LEDs for performance.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="LEDMatrix" color={C.serial} />
              <Tag text="rows x cols" color={C.i2c} />
              <Tag text="8 patterns" color={C.pwm} />
              <Tag text="scroll text" color={C.spi} />
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── Protocol Catalog ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'PROTOCOLS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Five hardware communication protocols, each with a declarative component and (where applicable) an imperative hook. All run via Lua capabilities — React declares intent, Lua handles the hardware.'}
            </Text>
          </Half>
          <Half>
            <ProtocolCatalog />
          </Half>
        </Band>

        <Divider />

        {/* ── Digital GPIO: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PIN_DECLARATIVE_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="zap" accentColor={C.pin}>{'DIGITAL GPIO'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Read and write logic levels on GPIO pins. Use mode="output" to drive LEDs, relays, and transistors. Use mode="input" with edge detection to read buttons, switches, and digital sensors. The pull option enables internal pull-up or pull-down resistors.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="Pin" color={C.pin} />
              <Tag text="usePin" color={C.pin} />
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── Pin hook: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.pin}>{'usePin HOOK'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The imperative alternative to <Pin>. Returns current value, a setter, edge detection state, and an invisible element you must render in your tree. The hook manages the capability lifecycle — mount it and go.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Options: chip (gpiochip path), pull (none/up/down), edge (none/rising/falling/both), activeLow (invert logic).'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PIN_HOOK_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── PWM: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PWM_DECLARATIVE_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="activity" accentColor={C.pwm}>{'PWM'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Pulse-width modulation for analog-like control. Set duty cycle (0-1) for LED brightness, motor speed, or servo position. Frequency defaults to 1kHz — adjust for your application. The enabled prop gates output without losing duty/frequency state.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="PWM" color={C.pwm} />
              <Tag text="usePWM" color={C.pwm} />
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── PWM hook: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.pwm}>{'usePWM HOOK'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Returns duty, setDuty, frequency, setFrequency, and the invisible element. Wire setDuty to a Slider for interactive brightness/speed control. Both duty and frequency can be changed at any time — the capability updates on the next frame.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PWM_HOOK_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Serial: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SERIAL_DECLARATIVE_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.serial}>{'SERIAL / UART'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Asynchronous serial communication with any UART device — Arduino, ESP32, GPS modules, modems, Raspberry Pi Pico. Two event callbacks: onLine fires per newline-terminated message, onData fires per raw chunk. Configure baud rate, data bits, stop bits, parity, and flow control.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="SerialPort" color={C.serial} />
              <Tag text="useSerial" color={C.serial} />
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── Serial hook: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.serial}>{'useSerial HOOK'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Returns lastLine, accumulated lines array, raw lastData, a send function, and the invisible element. The lines array grows unbounded — slice it for display. send() queues data for the capability to transmit on the next tick.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Options: dataBits (default 8), stopBits (default 1), parity (none/even/odd), flowControl (none/hardware).'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SERIAL_HOOK_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── I2C: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={I2C_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="git-branch" accentColor={C.i2c}>{'I2C'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Two-wire bus protocol for sensors, displays, EEPROMs, and ADCs. Specify bus number, device address, register to read, and poll interval. The capability reads the register at the given interval and fires onData with the decoded value and raw bytes.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="I2CDevice" color={C.i2c} />
              <Tag text="useI2C" color={C.i2c} />
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── I2C hook: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.i2c}>{'useI2C HOOK'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Returns the decoded value, raw bytes array, and the invisible element. Set pollInterval to control read frequency. The enabled option can pause/resume polling without destroying the capability instance.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={I2C_HOOK_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── SPI: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SPI_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="hard-drive" accentColor={C.spi}>{'SPI'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'High-speed full-duplex bus for displays, SD cards, and high-bandwidth peripherals. Configure bus, device (chip select), speed (Hz), SPI mode (0-3), and bits per word. Component-only — no hook wrapper yet.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6 }}>
              <Tag text="SPIDevice" color={C.spi} />
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: hooks vs components ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Two styles, same capability. Components embed directly in JSX — natural for reactive UIs. Hooks return an invisible element + state + controls — better for imperative logic. Either way, the Lua capability does the actual hardware I/O. You MUST render the hook element in your tree.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Hook vs Component pattern: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'HOOKS vs COMPONENTS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Use components when the hardware is part of your render tree — an LED that follows a toggle, a sensor reading displayed inline. Use hooks when you need programmatic control — a calibration sequence, conditional reads, or state that drives other logic.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={HOOK_VS_COMPONENT_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── API Catalog ── */}
        <Band>
          <Half>
            <SectionLabel icon="list" accentColor={C.accent}>{'API CATALOG'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Complete reference for all hooks and components. Every hook returns an element that must be rendered in your component tree — it is the bridge to the Lua capability.'}
            </Text>
          </Half>
          <Half>
            <APICatalog />
          </Half>
        </Band>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="cpu" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Hardware I/O'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
