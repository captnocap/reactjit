/**
 * Conversions — Layout2 zigzag documentation for @reactjit/convert.
 *
 * Live demos calling real package functions. All code strings and style
 * objects are static-hoisted outside the component to prevent 60fps
 * identity churn in CodeBlock / Lua tokenizer.
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  convert, listCategories, listUnits, registrySize,
  hexToRgb, rgbToHex, rgbToHsl,
  textToBase64, base64ToText,
  textToHex, textToUrlEncoded, textToHtmlEntities,
  decimalToBinary, decimalToOctal, decimalToHexNum,
} from '../../../packages/convert/src';
import type { RGB, HSL } from '../../../packages/convert/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#06b6d4',
  accentDim: 'rgba(6, 182, 212, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  units: '#4fc3f7',
  color: '#ab47bc',
  encoding: '#ff7043',
  numbers: '#66bb6a',
};

// ── Static code strings (hoisted) ────────────────────────

const INSTALL_CODE = `import {
  convert, hexToRgb, rgbToHex,
  textToBase64, decimalToBinary,
  useConvert, useUnitConvert,
} from '@reactjit/convert'`;

const COLOR_CODE = `const rgb = hexToRgb('#ff6b35')
// { r: 255, g: 107, b: 53 }

const hex = rgbToHex({ r: 255, g: 107, b: 53 })
// '#ff6b35'

const hsl = rgbToHsl({ r: 255, g: 107, b: 53 })
// { h: 16, s: 1.0, l: 0.6 }`;

const UNIT_CODE = `convert(5, 'mi').to('km')     // 8.047
convert(72, 'f').to('c')      // 22.22
convert(1, 'gal').to('l')     // 3.7854
convert(180, 'deg').to('rad') // 3.14159`;

const ENCODING_CODE = `textToBase64('Hello, ReactJIT!')
// 'SGVsbG8sIFJlYWN0SklUIQ=='

base64ToText('SGVsbG8=')  // 'Hello'
textToHex('ABC')           // '414243'
textToUrlEncoded('a b&c')  // 'a%20b%26c'
textToHtmlEntities('<br>') // '&lt;br&gt;'`;

const NUMBER_CODE = `decimalToBinary(255)  // '11111111'
decimalToOctal(255)   // '377'
decimalToHexNum(255)  // 'ff'

// Via fluent API:
convert(255, 'decimal').to('binary')
convert(255, 'decimal').to('hex-num')`;

const FLUENT_CODE = `// Fluent API — convert(value, from?).to(target)
convert(5, 'mi').to('km')        // 8.047
convert('#ff0000').to('rgb')     // { r:255, g:0, b:0 }
convert('Hello').to('base64')    // 'SGVsbG8='
convert(255, 'decimal').to('hex-num') // 'ff'`;

const REGISTRY_CODE = `// Extend with custom converters
import { register, registerBidi } from '@reactjit/convert'

register('celsius', 'rømer', (c) => c * 21/40 + 7.5, 'temperature')
registerBidi('foo', 'bar', fooToBar, barToFoo, 'custom')`;

// ── Band layout helpers ─────────────────────────────────

const BAND = {
  flexDirection: 'row' as const,
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const HALF = { flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 };

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
  );
}

function Tag({ text, tagColor }: { text: string; tagColor: string }) {
  return (
    <Box style={{ backgroundColor: tagColor + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color: tagColor, fontSize: 8 }}>{text}</Text>
    </Box>
  );
}

// ── Color Demo ───────────────────────────────────────────

const COLOR_PRESETS = ['#ff6b35', '#4fc3f7', '#66bb6a', '#ab47bc', '#ffa726', '#ec4899'];

function ColorDemo() {
  const c = useThemeColors();
  const [hex, setHex] = useState('#ff6b35');

  const rgb = useMemo(() => hexToRgb(hex), [hex]);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);
  const roundtrip = useMemo(() => rgbToHex(rgb), [rgb]);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'hex -> rgb -> hsl (pure math, zero runtime)'}</Text>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: hex }} />
        <Text style={{ fontSize: 10, color: c.text }}>{hex}</Text>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.color }}>{`RGB: { r: ${rgb.r}, g: ${rgb.g}, b: ${rgb.b} }`}</Text>
        <Text style={{ fontSize: 10, color: C.color }}>{`HSL: { h: ${hsl.h.toFixed(0)}\u00B0, s: ${(hsl.s * 100).toFixed(0)}%, l: ${(hsl.l * 100).toFixed(0)}% }`}</Text>
        <Text style={{ fontSize: 10, color: c.success }}>{`Round-trip: ${roundtrip} ${roundtrip.toLowerCase() === hex.toLowerCase() ? '\u2713' : '\u2717'}`}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {COLOR_PRESETS.map(col => (
          <Pressable key={col} onPress={() => setHex(col)}>
            <Box style={{
              width: 20, height: 20, borderRadius: 4, backgroundColor: col,
              borderWidth: hex === col ? 2 : 0, borderColor: '#fff',
            }} />
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}

// ── Unit Demo ────────────────────────────────────────────

function UnitDemo() {
  const c = useThemeColors();
  const [miles, setMiles] = useState(5);

  const km = useMemo(() => convert(miles, 'mi').to('km') as number, [miles]);
  const ft = useMemo(() => convert(miles, 'mi').to('ft') as number, [miles]);
  const tempC = useMemo(() => convert(72, 'f').to('c') as number, []);
  const liters = useMemo(() => convert(1, 'gal').to('l') as number, []);
  const radians = useMemo(() => convert(180, 'deg').to('rad') as number, []);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'Bidirectional registry \u2014 distance, temp, volume, angle'}</Text>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.units }}>{`${miles} mi -> ${km.toFixed(3)} km`}</Text>
        <Text style={{ fontSize: 10, color: C.units }}>{`${miles} mi -> ${ft.toFixed(0)} ft`}</Text>
        <Text style={{ fontSize: 10, color: C.units }}>{`72\u00B0F -> ${tempC.toFixed(2)}\u00B0C`}</Text>
        <Text style={{ fontSize: 10, color: C.units }}>{`1 gal -> ${liters.toFixed(4)} L`}</Text>
        <Text style={{ fontSize: 10, color: C.units }}>{`180\u00B0 -> ${radians.toFixed(6)} rad`}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setMiles(m => Math.max(1, m - 1))}>
          <Box style={{ backgroundColor: C.units + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4 }}>
            <Text style={{ color: C.units, fontSize: 10 }}>{'- mile'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => setMiles(m => m + 1)}>
          <Box style={{ backgroundColor: C.units + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4 }}>
            <Text style={{ color: C.units, fontSize: 10 }}>{'+ mile'}</Text>
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── Encoding Demo ────────────────────────────────────────

const ENC_INPUT = 'Hello, ReactJIT!';
const HTML_INPUT = '<script>alert("xss")</script>';

function EncodingDemo() {
  const c = useThemeColors();

  const b64 = useMemo(() => textToBase64(ENC_INPUT), []);
  const roundtrip = useMemo(() => base64ToText(b64), [b64]);
  const hexEnc = useMemo(() => textToHex('ABC'), []);
  const urlEnc = useMemo(() => textToUrlEncoded(ENC_INPUT), []);
  const htmlEnc = useMemo(() => textToHtmlEntities(HTML_INPUT), []);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'text <-> base64, hex, url, html entities'}</Text>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>{`Input: "${ENC_INPUT}"`}</Text>
        <Text style={{ fontSize: 10, color: C.encoding }}>{`Base64: ${b64}`}</Text>
        <Text style={{ fontSize: 10, color: c.success }}>{`Round-trip: "${roundtrip}" \u2713`}</Text>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.encoding }}>{`"ABC" -> hex: ${hexEnc}`}</Text>
        <Text style={{ fontSize: 10, color: C.encoding }}>{`URL: ${urlEnc}`}</Text>
        <Text style={{ fontSize: 10, color: C.encoding }}>{`HTML: ${htmlEnc}`}</Text>
      </Box>
    </Box>
  );
}

// ── Number Base Demo ─────────────────────────────────────

function NumberBaseDemo() {
  const c = useThemeColors();
  const [num, setNum] = useState(255);

  const bin = useMemo(() => decimalToBinary(num), [num]);
  const oct = useMemo(() => decimalToOctal(num), [num]);
  const hex = useMemo(() => decimalToHexNum(num), [num]);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'decimal <-> binary, octal, hex'}</Text>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> binary: ${bin}`}</Text>
        <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> octal:  ${oct}`}</Text>
        <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> hex:    ${hex}`}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setNum(n => Math.max(0, n - 16))}>
          <Box style={{ backgroundColor: C.numbers + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4 }}>
            <Text style={{ color: C.numbers, fontSize: 10 }}>{'- 16'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => setNum(n => n + 16)}>
          <Box style={{ backgroundColor: C.numbers + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4 }}>
            <Text style={{ color: C.numbers, fontSize: 10 }}>{'+ 16'}</Text>
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── Pipeline Diagram ─────────────────────────────────────

const PIPELINE_PRESETS = [
  { value: 5, from: 'mi', to: 'km', category: 'length' },
  { value: 72, from: 'f', to: 'c', category: 'temperature' },
  { value: 1, from: 'gal', to: 'l', category: 'volume' },
  { value: 180, from: 'deg', to: 'rad', category: 'angle' },
] as const;

function PipelineArrow({ color }: { color: string }) {
  return (
    <Box style={{ alignItems: 'center', gap: 0 }}>
      <Box style={{ width: 1, height: 10, backgroundColor: color }} />
      <Text style={{ color, fontSize: 8 }}>{'\u25BC'}</Text>
    </Box>
  );
}

function PipelineStage({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 7, color: c.muted }}>{label}</Text>
      <Box style={{ backgroundColor: bg, borderRadius: 4, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4 }}>
        <Text style={{ fontSize: 10, color, fontFamily: 'monospace' }}>{value}</Text>
      </Box>
    </Box>
  );
}

function PipelineDemo() {
  const c = useThemeColors();
  const [idx, setIdx] = useState(0);
  const preset = PIPELINE_PRESETS[idx];

  const result = useMemo(() => convert(preset.value, preset.from).to(preset.to), [idx]);
  const formatted = typeof result === 'number' ? result.toFixed(4) : String(result);

  return (
    <Box style={{ gap: 10 }}>
      <Box style={{ alignItems: 'center', gap: 0 }}>
        <PipelineStage label="input" value={`${preset.value}`} color={c.text} bg={c.surface1 || c.bgElevated} />
        <PipelineArrow color={C.accent} />
        <PipelineStage label="fluent call" value={`convert(${preset.value}, '${preset.from}')`} color={C.accent} bg={C.accentDim} />
        <PipelineArrow color={C.accent} />
        <PipelineStage label="registry lookup" value={`${preset.category}: ${preset.from} -> ${preset.to}`} color={c.text} bg={c.surface1 || c.bgElevated} />
        <PipelineArrow color={C.accent} />
        <PipelineStage label="result" value={`${formatted} ${preset.to}`} color={C.accent} bg={C.accentDim} />
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {PIPELINE_PRESETS.map((p, i) => (
          <Pressable key={i} onPress={() => setIdx(i)}>
            <Box style={{
              backgroundColor: i === idx ? C.accent : c.surface1 || c.bgElevated,
              borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
            }}>
              <Text style={{ fontSize: 8, color: i === idx ? '#1e1e2e' : c.muted }}>
                {`${p.from} -> ${p.to}`}
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}

// ── Registry Catalog ─────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  length: '#4fc3f7', weight: '#66bb6a', temperature: '#ff7043',
  volume: '#ab47bc', speed: '#ffa726', area: '#ec4899',
  time: '#06b6d4', data: '#8b5cf6', pressure: '#ef4444',
  energy: '#f59e0b', angle: '#14b8a6', color: '#ab47bc',
  encoding: '#ff7043', 'number-base': '#66bb6a', currency: '#ffa726',
};

function RegistryCatalog() {
  const c = useThemeColors();
  const categories = useMemo(() => listCategories(), []);
  const total = useMemo(() => registrySize(), []);

  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{`${total} converters across ${categories.length} categories`}</Text>
      {categories.map(cat => {
        const units = listUnits(cat);
        const catColor = CAT_COLORS[cat] || c.text;
        return (
          <Box key={cat} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: catColor }} />
            <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 90 }}>{cat}</Text>
            <Text style={{ fontSize: 9, color: c.textDim }}>{units.join(', ')}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// ── ConversionsStory ─────────────────────────────────────

export function ConversionsStory() {
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
        <Image src="package" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Convert'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/convert'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Unit, color, encoding & number-base conversions'}
        </Text>
      </Box>

      {/* ── Scrollable body ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Convert between units, color formats, encodings, and number bases.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Pure-JS direct converters for zero-overhead transforms, plus a bidirectional registry for extensible unit conversion via the fluent convert(value, from).to(target) API.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: Install — text | code ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Import what you need. Direct converters (hexToRgb, textToBase64) are pure JS. Hooks (useConvert, useUnitConvert) wrap the registry for reactive use.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band 2: Color — demo | text + code (zigzag) ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <ColorDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="palette">{'COLOR SPACES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Hex, RGB, HSL, HSV, and CSS named colors. All conversions are pure math \u2014 no bridge, no async. Click a swatch to see live conversion.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="hex" tagColor={C.color} />
              <Tag text="rgb" tagColor={C.color} />
              <Tag text="hsl" tagColor={C.color} />
              <Tag text="hsv" tagColor={C.color} />
              <Tag text="named" tagColor={C.color} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} code={COLOR_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: Units — text + code | demo ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="gauge">{'UNIT CONVERSION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Distance, weight, temperature, volume, speed, area, time, data, pressure, energy, and angle. All via the fluent API or useUnitConvert hook.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="length" tagColor={C.units} />
              <Tag text="temp" tagColor={C.units} />
              <Tag text="weight" tagColor={C.units} />
              <Tag text="volume" tagColor={C.units} />
              <Tag text="pressure" tagColor={C.units} />
              <Tag text="angle" tagColor={C.units} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} code={UNIT_CODE} />
          </Box>
          <Box style={HALF}>
            <UnitDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 4: Encoding — demo | text + code (zigzag) ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <EncodingDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="type">{'TEXT ENCODING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Base64, hex, URL percent-encoding, and HTML entity escaping. Manual implementations for QuickJS (no btoa/encodeURIComponent). All round-trip safe.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="base64" tagColor={C.encoding} />
              <Tag text="hex" tagColor={C.encoding} />
              <Tag text="url" tagColor={C.encoding} />
              <Tag text="html" tagColor={C.encoding} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} code={ENCODING_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: Number bases — text + code | demo ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="binary">{'NUMBER BASES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Decimal, binary, octal, hex \u2014 all 12 cross-conversions registered. Step through values with the buttons to see live base transforms.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="decimal" tagColor={C.numbers} />
              <Tag text="binary" tagColor={C.numbers} />
              <Tag text="octal" tagColor={C.numbers} />
              <Tag text="hex" tagColor={C.numbers} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} code={NUMBER_CODE} />
          </Box>
          <Box style={HALF}>
            <NumberBaseDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Callout ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All direct converters are pure JS with zero runtime overhead. The registry is extensible \u2014 register() and registerBidi() let you add custom converters at any time.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 6: Fluent API — code | text (zigzag) ── */}
        <Box style={BAND}>
          <CodeBlock language="tsx" fontSize={9} code={FLUENT_CODE} />
          <Box style={HALF}>
            <SectionLabel icon="code">{'FLUENT API'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'convert(value, from?).to(target) \u2014 one function for everything. Auto-detects hex strings and text. Chain .canConvertTo() to check availability before converting.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: Pipeline — diagram | text ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <PipelineDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="git-merge">{'PIPELINE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Every convert() call follows the same path: input value enters the fluent API, the registry finds the matching converter by source -> target pair, and the converter function produces the result. Click a preset to trace different conversions.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Direct converters (hexToRgb, textToBase64) skip the registry and call the transform function directly \u2014 same result, zero lookup overhead.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 8: Registry catalog — text | catalog ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="layers">{'REGISTRY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'All registered converters and their categories. Use listCategories(), listUnits(cat), and registrySize() to introspect the registry at runtime.'}
            </Text>
          </Box>
          <Box style={HALF}>
            <RegistryCatalog />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 8: Extensibility — code | text (zigzag) ── */}
        <Box style={{ ...BAND, paddingBottom: 24 }}>
          <CodeBlock language="tsx" fontSize={9} code={REGISTRY_CODE} />
          <Box style={HALF}>
            <SectionLabel icon="settings">{'EXTENSIBILITY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Add your own converters with register() for one-way or registerBidi() for bidirectional. They integrate into the fluent API and hooks automatically.'}
            </Text>
          </Box>
        </Box>

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
        <Image src="package" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Convert'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
