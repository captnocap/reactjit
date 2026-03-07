/**
 * Conversions — @reactjit/convert — Layout2 zigzag documentation.
 *
 * All conversions run through the Lua backend via useConvert().
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock } from '../../../packages/core/src';
import { useLoveRPC } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useConvert } from '../../../packages/convert/src';

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

// ── Static code strings ───────────────────────────────────

const INSTALL_CODE = `import { useConvert } from '@reactjit/convert'

const convert = useConvert()
const { result } = await convert({ from: 'mi', to: 'km', value: 5 })`;

const COLOR_CODE = `const convert = useConvert()

const { result: rgb } = await convert({ from: 'hex', to: 'rgb', value: '#ff6b35' })
// { r: 255, g: 107, b: 53 }

const { result: hsl } = await convert({ from: 'rgb', to: 'hsl', value: rgb })
// { h: 16, s: 1.0, l: 0.6 }`;

const UNIT_CODE = `const convert = useConvert()

await convert({ from: 'mi',  to: 'km',  value: 5   })  // 8.047
await convert({ from: 'f',   to: 'c',   value: 72  })  // 22.22
await convert({ from: 'gal', to: 'l',   value: 1   })  // 3.7854
await convert({ from: 'deg', to: 'rad', value: 180 })  // 3.14159`;

const ENCODING_CODE = `const convert = useConvert()

await convert({ from: 'text',   to: 'base64', value: 'Hello!'  })
// 'SGVsbG8h'

await convert({ from: 'text',   to: 'url',    value: 'a b&c'   })
// 'a%20b%26c'

await convert({ from: 'text',   to: 'html',   value: '<br>'    })
// '&lt;br&gt;'`;

const NUMBER_CODE = `const convert = useConvert()

await convert({ from: 'decimal', to: 'binary',  value: 255 })  // '11111111'
await convert({ from: 'decimal', to: 'octal',   value: 255 })  // '377'
await convert({ from: 'decimal', to: 'hex-num', value: 255 })  // 'ff'`;

const FLUENT_CODE = `// One hook, every conversion
const convert = useConvert()

const { result } = await convert({ from: 'mi',      to: 'km',      value: 5   })
const { result } = await convert({ from: 'hex',     to: 'rgb',     value: '#ff0000' })
const { result } = await convert({ from: 'text',    to: 'base64',  value: 'Hello' })
const { result } = await convert({ from: 'decimal', to: 'hex-num', value: 255 })`;

// ── Band layout helpers ────────────────────────────────────

const BAND = {
  flexDirection: 'row' as const,
  paddingLeft: 28, paddingRight: 28,
  paddingTop: 20,  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const HALF = {
  flexGrow: 1, flexBasis: 0, gap: 8,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

// ── Helpers ───────────────────────────────────────────────

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

// ── Color Demo ────────────────────────────────────────────

const COLOR_PRESETS = ['#ff6b35', '#4fc3f7', '#66bb6a', '#ab47bc', '#ffa726', '#ec4899'];

function ColorDemo() {
  const c = useThemeColors();
  const convert = useConvert();
  const [hex, setHex] = useState('#ff6b35');
  const [rgb, setRgb] = useState<any>(null);
  const [hsl, setHsl] = useState<any>(null);
  const [roundtrip, setRoundtrip] = useState('');

  useEffect(() => {
    convert({ from: 'hex', to: 'rgb', value: hex })
      .then(({ result: r }) => {
        setRgb(r);
        return Promise.all([
          convert({ from: 'rgb', to: 'hsl', value: r }),
          convert({ from: 'rgb', to: 'hex', value: r }),
        ]);
      })
      .then(([{ result: h }, { result: rt }]) => {
        setHsl(h);
        setRoundtrip(rt);
      })
      .catch(() => {});
  }, [hex]);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'hex -> rgb -> hsl (Lua math, zero JS compute)'}</Text>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: hex }} />
        <Text style={{ fontSize: 10, color: c.text }}>{hex}</Text>
      </Box>

      {rgb && hsl && (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.color }}>{`RGB: { r: ${rgb.r}, g: ${rgb.g}, b: ${rgb.b} }`}</Text>
          <Text style={{ fontSize: 10, color: C.color }}>{`HSL: { h: ${hsl.h.toFixed(0)}\u00B0, s: ${(hsl.s * 100).toFixed(0)}%, l: ${(hsl.l * 100).toFixed(0)}% }`}</Text>
          <Text style={{ fontSize: 10, color: c.success }}>{`Round-trip: ${roundtrip} ${roundtrip.toLowerCase() === hex.toLowerCase() ? '\u2713' : '\u2717'}`}</Text>
        </Box>
      )}

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

// ── Unit Demo ─────────────────────────────────────────────

function UnitDemo() {
  const c = useThemeColors();
  const convert = useConvert();
  const [miles, setMiles] = useState(5);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      convert({ from: 'mi',  to: 'km',  value: miles }),
      convert({ from: 'mi',  to: 'ft',  value: miles }),
      convert({ from: 'f',   to: 'c',   value: 72 }),
      convert({ from: 'gal', to: 'l',   value: 1 }),
      convert({ from: 'deg', to: 'rad', value: 180 }),
    ]).then(rs => setResults(rs.map((r: any) => r.result))).catch(() => {});
  }, [miles]);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'Bidirectional registry \u2014 distance, temp, volume, angle'}</Text>

      {results && (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.units }}>{`${miles} mi -> ${results[0].toFixed(3)} km`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`${miles} mi -> ${results[1].toFixed(0)} ft`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`72\u00B0F -> ${results[2].toFixed(2)}\u00B0C`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`1 gal -> ${results[3].toFixed(4)} L`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`180\u00B0 -> ${results[4].toFixed(6)} rad`}</Text>
        </Box>
      )}

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

// ── Encoding Demo ─────────────────────────────────────────

const ENC_INPUT = 'Hello, ReactJIT!';
const HTML_INPUT = '<script>alert("xss")</script>';

function EncodingDemo() {
  const c = useThemeColors();
  const convert = useConvert();
  const [enc, setEnc] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      convert({ from: 'text', to: 'base64',  value: ENC_INPUT }),
      convert({ from: 'text', to: 'hex-enc', value: 'ABC' }),
      convert({ from: 'text', to: 'url',     value: ENC_INPUT }),
      convert({ from: 'text', to: 'html',    value: HTML_INPUT }),
    ]).then(rs => {
      const b64 = rs[0].result;
      convert({ from: 'base64', to: 'text', value: b64 }).then(({ result: rt }) => {
        setEnc({ b64, hex: rs[1].result, url: rs[2].result, html: rs[3].result, roundtrip: rt });
      });
    }).catch(() => {});
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'text <-> base64, hex, url, html entities'}</Text>
      {enc && (
        <>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: c.textSecondary }}>{`Input: "${ENC_INPUT}"`}</Text>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`Base64: ${enc.b64}`}</Text>
            <Text style={{ fontSize: 10, color: c.success }}>{`Round-trip: "${enc.roundtrip}" \u2713`}</Text>
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`"ABC" -> hex: ${enc.hex}`}</Text>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`URL: ${enc.url}`}</Text>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`HTML: ${enc.html}`}</Text>
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Number Base Demo ──────────────────────────────────────

function NumberBaseDemo() {
  const c = useThemeColors();
  const convert = useConvert();
  const [num, setNum] = useState(255);
  const [bases, setBases] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      convert({ from: 'decimal', to: 'binary',  value: num }),
      convert({ from: 'decimal', to: 'octal',   value: num }),
      convert({ from: 'decimal', to: 'hex-num', value: num }),
    ]).then(rs => setBases(rs.map((r: any) => r.result))).catch(() => {});
  }, [num]);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'decimal <-> binary, octal, hex'}</Text>
      {bases && (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> binary: ${bases[0]}`}</Text>
          <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> octal:  ${bases[1]}`}</Text>
          <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> hex:    ${bases[2]}`}</Text>
        </Box>
      )}
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

// ── Pipeline Demo ─────────────────────────────────────────

const PIPELINE_PRESETS = [
  { value: 5,   from: 'mi',  to: 'km',  category: 'length' },
  { value: 72,  from: 'f',   to: 'c',   category: 'temperature' },
  { value: 1,   from: 'gal', to: 'l',   category: 'volume' },
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
  const convert = useConvert();
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  const preset = PIPELINE_PRESETS[idx];

  useEffect(() => {
    setResult(null);
    convert({ from: preset.from, to: preset.to, value: preset.value })
      .then(({ result: r }) => {
        setResult(typeof r === 'number' ? r.toFixed(4) : String(r));
      })
      .catch(() => {});
  }, [idx]);

  return (
    <Box style={{ gap: 10 }}>
      <Box style={{ alignItems: 'center', gap: 0 }}>
        <PipelineStage label="input" value={`${preset.value}`} color={c.text} bg={c.surface1 || c.bgElevated} />
        <PipelineArrow color={C.accent} />
        <PipelineStage label="rpc call" value={`{ from: '${preset.from}', to: '${preset.to}' }`} color={C.accent} bg={C.accentDim} />
        <PipelineArrow color={C.accent} />
        <PipelineStage label="lua registry" value={`${preset.category}: ${preset.from} -> ${preset.to}`} color={c.text} bg={c.surface1 || c.bgElevated} />
        <PipelineArrow color={C.accent} />
        <PipelineStage label="result" value={result !== null ? `${result} ${preset.to}` : '…'} color={C.accent} bg={C.accentDim} />
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {PIPELINE_PRESETS.map((p, i) => (
          <Pressable key={i} onPress={() => setIdx(i)}>
            <Box style={{
              backgroundColor: i === idx ? C.accent : (c.surface1 || c.bgElevated),
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

// ── Registry Catalog ──────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  length: '#4fc3f7', weight: '#66bb6a', temperature: '#ff7043',
  volume: '#ab47bc', speed: '#ffa726', area: '#ec4899',
  time: '#06b6d4', data: '#8b5cf6', pressure: '#ef4444',
  energy: '#f59e0b', angle: '#14b8a6', color: '#ab47bc',
  encoding: '#ff7043', 'number-base': '#66bb6a',
};

function RegistryCatalog() {
  const c = useThemeColors();
  const getCategories = useLoveRPC<string[]>('convert:categories');
  const getUnits      = useLoveRPC<string[]>('convert:units');
  const getSize       = useLoveRPC<number>('convert:size');
  const [catalog, setCatalog] = useState<{ cat: string; units: string[] }[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getCategories({}), getSize({})]).then(([cats, size]) => {
      setTotal(size);
      return Promise.all((cats as string[]).map((cat: string) =>
        getUnits({ category: cat }).then((units: string[]) => ({ cat, units }))
      ));
    }).then(rows => setCatalog(rows)).catch(() => {});
  }, []);

  return (
    <Box style={{ gap: 6 }}>
      {total !== null && (
        <Text style={{ fontSize: 9, color: c.textDim }}>{`${total} converters across ${catalog.length} categories`}</Text>
      )}
      {catalog.map(({ cat, units }) => {
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

// ── ConversionsStory ──────────────────────────────────────

export function ConversionsStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderBottomWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14,
      }}>
        <Image src="package" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>{'Convert'}</Text>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/convert'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>{'Lua-backed unit, color, encoding & number-base conversions'}</Text>
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero ── */}
        <Box style={{ borderLeftWidth: 3, borderColor: C.accent, paddingLeft: 25, paddingRight: 28, paddingTop: 24, paddingBottom: 24, gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'All conversion math runs in Lua. React side: one hook.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'useConvert() returns an async RPC caller. Pass { from, to, value } — Lua handles every transform: units, colors, encodings, number bases.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: Install ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'One hook for everything. No registry to import, no helper functions. The Lua backend handles all conversions.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band 2: Color ── */}
        <Box style={BAND}>
          <Box style={HALF}><ColorDemo /></Box>
          <Box style={HALF}>
            <SectionLabel icon="palette">{'COLOR SPACES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Hex, RGB, HSL, HSV, named colors. Pure Lua math — no JS compute, no bridge overhead beyond the RPC call.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="hex" tagColor={C.color} />
              <Tag text="rgb" tagColor={C.color} />
              <Tag text="hsl" tagColor={C.color} />
              <Tag text="hsv" tagColor={C.color} />
              <Tag text="named" tagColor={C.color} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={COLOR_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: Units ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="gauge">{'UNIT CONVERSION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Distance, weight, temperature, volume, speed, area, time, data, pressure, energy, angle — all registered in Lua.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="length" tagColor={C.units} />
              <Tag text="temp" tagColor={C.units} />
              <Tag text="weight" tagColor={C.units} />
              <Tag text="volume" tagColor={C.units} />
              <Tag text="pressure" tagColor={C.units} />
              <Tag text="angle" tagColor={C.units} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={UNIT_CODE} />
          </Box>
          <Box style={HALF}><UnitDemo /></Box>
        </Box>

        <Divider />

        {/* ── Band 4: Encoding ── */}
        <Box style={BAND}>
          <Box style={HALF}><EncodingDemo /></Box>
          <Box style={HALF}>
            <SectionLabel icon="type">{'TEXT ENCODING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Base64 via love.data.encode, hex, URL percent-encoding, HTML entity escaping — all in Lua.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="base64" tagColor={C.encoding} />
              <Tag text="hex" tagColor={C.encoding} />
              <Tag text="url" tagColor={C.encoding} />
              <Tag text="html" tagColor={C.encoding} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ENCODING_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: Number bases ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="binary">{'NUMBER BASES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Decimal, binary, octal, hex — all 12 cross-conversions. Lua string.format and tonumber(s, base) do the work.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text="decimal" tagColor={C.numbers} />
              <Tag text="binary" tagColor={C.numbers} />
              <Tag text="octal" tagColor={C.numbers} />
              <Tag text="hex" tagColor={C.numbers} />
            </Box>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={NUMBER_CODE} />
          </Box>
          <Box style={HALF}><NumberBaseDemo /></Box>
        </Box>

        <Divider />

        {/* ── Callout ── */}
        <Box style={{
          backgroundColor: C.callout, borderLeftWidth: 3, borderColor: C.calloutBorder,
          paddingLeft: 25, paddingRight: 28, paddingTop: 14, paddingBottom: 14,
          flexDirection: 'row', gap: 8, alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Zero JS compute. Every conversion runs in LuaJIT. React never touches the math — it just reads { result }.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 6: Fluent API ── */}
        <Box style={BAND}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={FLUENT_CODE} />
          <Box style={HALF}>
            <SectionLabel icon="code">{'ONE HOOK'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useConvert() is the entire API. No helpers, no registry imports, no type gymnastics. One RPC call, one result.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: Pipeline ── */}
        <Box style={BAND}>
          <Box style={HALF}><PipelineDemo /></Box>
          <Box style={HALF}>
            <SectionLabel icon="git-merge">{'PIPELINE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Every conversion follows the same path: React fires an RPC call, Lua looks up the converter by from->to key, runs the transform, returns { result }. Click a preset to trace different conversions.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'The result field is nil on error — check for { error } to handle unknown unit pairs gracefully.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 8: Registry ── */}
        <Box style={{ ...BAND, paddingBottom: 24 }}>
          <Box style={HALF}>
            <SectionLabel icon="layers">{'REGISTRY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'All registered converters live in Lua. Use convert:categories, convert:units, and convert:size RPCs to introspect at runtime.'}
            </Text>
          </Box>
          <Box style={HALF}><RegistryCatalog /></Box>
        </Box>

      </ScrollView>

      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderTopWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="package" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Convert'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v1.0.0 — Lua backend'}</Text>
      </Box>

    </Box>
  );
}
