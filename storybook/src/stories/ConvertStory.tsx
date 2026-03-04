import React, { useState, useMemo } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import {
  convert, listCategories, listUnits, registrySize,
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb,
  textToBase64, base64ToText,
  decimalToBinary, decimalToHexNum,
} from '../../../packages/convert/src';
import type { RGB, HSL } from '../../../packages/convert/src';

const C = {
  units: '#4fc3f7',
  color: '#ab47bc',
  encoding: '#ff7043',
  numbers: '#66bb6a',
  registry: '#ffa726',
};

// ── Helpers ──────────────────────────────────────────────

function CodeLabel({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Text style={{ color: c.textDim, fontSize: 9 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 9, fontFamily: 'monospace' }}>{value}</Text>
    </Box>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color, fontSize: 8, fontFamily: 'monospace' }}>{text}</Text>
    </Box>
  );
}

// ── Unit Conversion Demo ────────────────────────────────

function UnitDemo() {
  const c = useThemeColors();
  const [miles, setMiles] = useState(5);

  const km = convert(miles, 'mi').to('km') as number;
  const ft = convert(miles, 'mi').to('ft') as number;
  const tempF = 72;
  const tempC = convert(tempF, 'f').to('c') as number;
  const tempK = convert(tempF, 'f').to('k') as number;
  const lbs = 150;
  const kg = convert(lbs, 'lb').to('kg') as number;
  const liters = convert(1, 'gal').to('l') as number;
  const psi = convert(1, 'atm').to('psi') as number;
  const radians = convert(180, 'deg').to('rad') as number;

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Tag text="length" color={C.units} />
        <Tag text="temperature" color={C.units} />
        <Tag text="weight" color={C.units} />
        <Tag text="volume" color={C.units} />
        <Tag text="pressure" color={C.units} />
        <Tag text="angle" color={C.units} />
      </Box>

      <CodeLabel label={`${miles} mi \u2192 km`} value={km.toFixed(4)} />
      <CodeLabel label={`${miles} mi \u2192 ft`} value={ft.toFixed(0)} />
      <CodeLabel label={`${tempF}\u00b0F \u2192 \u00b0C`} value={tempC.toFixed(2)} />
      <CodeLabel label={`${tempF}\u00b0F \u2192 K`} value={tempK.toFixed(2)} />
      <CodeLabel label={`${lbs} lb \u2192 kg`} value={kg.toFixed(2)} />
      <CodeLabel label={`1 gal \u2192 L`} value={liters.toFixed(4)} />
      <CodeLabel label={`1 atm \u2192 psi`} value={psi.toFixed(2)} />
      <CodeLabel label={`180\u00b0 \u2192 rad`} value={radians.toFixed(6)} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setMiles(m => Math.max(1, m - 1))}
          style={{ backgroundColor: C.units + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.units, fontSize: 10 }}>{`- mile`}</Text>
        </Pressable>
        <Pressable
          onPress={() => setMiles(m => m + 1)}
          style={{ backgroundColor: C.units + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.units, fontSize: 10 }}>{`+ mile`}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── Color Demo ──────────────────────────────────────────

function ColorDemo() {
  const c = useThemeColors();
  const [hex, setHex] = useState('#ff6b35');

  const rgb = convert(hex).to('rgb') as RGB;
  const hsl = convert(hex).to('hsl') as HSL;
  const backToHex = rgbToHex(rgb);

  const colors = ['#ff6b35', '#4fc3f7', '#66bb6a', '#ab47bc', '#ffa726'];

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Tag text="hex" color={C.color} />
        <Tag text="rgb" color={C.color} />
        <Tag text="hsl" color={C.color} />
        <Tag text="hsv" color={C.color} />
        <Tag text="named" color={C.color} />
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: hex }} />
        <Text style={{ color: c.text, fontSize: 10, fontFamily: 'monospace' }}>{hex}</Text>
      </Box>

      <CodeLabel label="hex \u2192 rgb" value={`{ r: ${rgb.r}, g: ${rgb.g}, b: ${rgb.b} }`} />
      <CodeLabel label="hex \u2192 hsl" value={`{ h: ${hsl.h.toFixed(0)}, s: ${hsl.s.toFixed(2)}, l: ${hsl.l.toFixed(2)} }`} />
      <CodeLabel label="rgb \u2192 hex" value={backToHex} />

      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {colors.map(col => (
          <Pressable
            key={col}
            onPress={() => setHex(col)}
            style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: col, borderWidth: hex === col ? 2 : 0, borderColor: '#fff' }}
          />
        ))}
      </Box>
    </Box>
  );
}

// ── Encoding Demo ───────────────────────────────────────

function EncodingDemo() {
  const c = useThemeColors();
  const text = 'Hello, ReactJIT!';

  const b64 = convert(text).to('base64') as string;
  const roundtrip = base64ToText(b64);
  const urlEnc = convert(text).to('url') as string;
  const htmlEnc = convert('<script>alert("xss")</script>').to('html') as string;
  const hexEnc = convert('ABC').to('hex-enc') as string;

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Tag text="base64" color={C.encoding} />
        <Tag text="url" color={C.encoding} />
        <Tag text="html" color={C.encoding} />
        <Tag text="hex" color={C.encoding} />
      </Box>

      <CodeLabel label="text" value={`"${text}"`} />
      <CodeLabel label="text \u2192 base64" value={b64} />
      <CodeLabel label="base64 \u2192 text" value={roundtrip} />
      <CodeLabel label="text \u2192 url" value={urlEnc} />
      <CodeLabel label="html escape" value={htmlEnc} />
      <CodeLabel label={`"ABC" \u2192 hex`} value={hexEnc} />
    </Box>
  );
}

// ── Number Base Demo ────────────────────────────────────

function NumberBaseDemo() {
  const c = useThemeColors();
  const [num, setNum] = useState(255);

  const bin = convert(num, 'decimal').to('binary') as string;
  const oct = convert(num, 'decimal').to('octal') as string;
  const hex = convert(num, 'decimal').to('hex-num') as string;

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Tag text="decimal" color={C.numbers} />
        <Tag text="binary" color={C.numbers} />
        <Tag text="octal" color={C.numbers} />
        <Tag text="hex" color={C.numbers} />
      </Box>

      <CodeLabel label={`${num} \u2192 binary`} value={bin} />
      <CodeLabel label={`${num} \u2192 octal`} value={oct} />
      <CodeLabel label={`${num} \u2192 hex`} value={hex} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setNum(n => Math.max(0, n - 16))}
          style={{ backgroundColor: C.numbers + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.numbers, fontSize: 10 }}>{`- 16`}</Text>
        </Pressable>
        <Pressable
          onPress={() => setNum(n => n + 16)}
          style={{ backgroundColor: C.numbers + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.numbers, fontSize: 10 }}>{`+ 16`}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── Registry Info ───────────────────────────────────────

function RegistryInfo() {
  const c = useThemeColors();
  const categories = listCategories();
  const total = registrySize();

  return (
    <Box style={{ gap: 8 }}>
      <CodeLabel label="total converters" value={String(total)} />
      <CodeLabel label="categories" value={categories.join(', ')} />
      {categories.map(cat => (
        <CodeLabel key={cat} label={cat} value={listUnits(cat).join(', ')} />
      ))}
    </Box>
  );
}

// ── Main Story ──────────────────────────────────────────

export function ConvertStory() {
  return (
    <StoryPage title="Convert" subtitle="Universal conversion toolkit">
      <StorySection title="Unit Conversions" description="Length, weight, temperature, volume, pressure, angle — all via convert(value, unit).to(target)">
        <UnitDemo />
      </StorySection>
      <StorySection title="Color Spaces" description="hex, rgb, hsl, hsv, named colors — pure math, no bridge needed">
        <ColorDemo />
      </StorySection>
      <StorySection title="Text Encoding" description="base64, URL encoding, HTML entities, hex encoding — string in, string out">
        <EncodingDemo />
      </StorySection>
      <StorySection title="Number Bases" description="decimal, binary, octal, hex — convert between number systems">
        <NumberBaseDemo />
      </StorySection>
      <StorySection title="Registry" description="All registered converters and their categories — extensible via register()">
        <RegistryInfo />
      </StorySection>
    </StoryPage>
  );
}
