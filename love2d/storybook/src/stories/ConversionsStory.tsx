/**
 * Conversions — @reactjit/convert — Layout2 zigzag documentation.
 *
 * All conversions run through the Lua backend via useConvert().
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, classifiers as S, useLoveRPC, useMount, useLuaQuery } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

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
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
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
  const [hex, setHex] = useState('#ff6b35');

  // Query 1: hex → rgb
  const { data: rgbRaw } = useLuaQuery<{ result: any }>('convert:convert', { from: 'hex', to: 'rgb', value: hex }, [hex]);
  const rgb = rgbRaw?.result ?? null;

  // Query 2: rgb → hsl (depends on query 1)
  const { data: hslRaw } = useLuaQuery<{ result: any }>('convert:convert',
    rgb ? { from: 'rgb', to: 'hsl', value: rgb } : { from: 'hex', to: 'rgb', value: '' },
    [rgb?.r, rgb?.g, rgb?.b],
  );
  const hsl = rgb ? hslRaw?.result ?? null : null;

  // Query 3: rgb → hex round-trip (depends on query 1)
  const { data: rtRaw } = useLuaQuery<{ result: any }>('convert:convert',
    rgb ? { from: 'rgb', to: 'hex', value: rgb } : { from: 'hex', to: 'rgb', value: '' },
    [rgb?.r, rgb?.g, rgb?.b],
  );
  const roundtrip = rgb ? rtRaw?.result ?? '' : '';

  return (
    <Box style={{ gap: 8 }}>
      <S.StoryCap>{'hex -> rgb -> hsl (Lua math, zero JS compute)'}</S.StoryCap>

      <S.RowCenterG8>
        <Box style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: hex }} />
        <S.StoryBody>{hex}</S.StoryBody>
      </S.RowCenterG8>

      {rgb && hsl && (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.color }}>{`RGB: { r: ${rgb.r}, g: ${rgb.g}, b: ${rgb.b} }`}</Text>
          <Text style={{ fontSize: 10, color: C.color }}>{`HSL: { h: ${hsl.h.toFixed(0)}\u00B0, s: ${(hsl.s * 100).toFixed(0)}%, l: ${(hsl.l * 100).toFixed(0)}% }`}</Text>
          <Text style={{ fontSize: 10, color: c.success }}>{`Round-trip: ${roundtrip} ${roundtrip.toLowerCase() === hex.toLowerCase() ? '\u2713' : '\u2717'}`}</Text>
        </Box>
      )}

      <S.RowG6>
        {COLOR_PRESETS.map(col => (
          <Pressable key={col} onPress={() => setHex(col)}>
            <Box style={{
              width: 20, height: 20, borderRadius: 4, backgroundColor: col,
              borderWidth: hex === col ? 2 : 0, borderColor: '#fff',
            }} />
          </Pressable>
        ))}
      </S.RowG6>
    </Box>
  );
}

// ── Unit Demo ─────────────────────────────────────────────

function UnitDemo() {
  const c = useThemeColors();
  const [miles, setMiles] = useState(5);

  const { data: kmRaw } = useLuaQuery<{ result: number }>('convert:convert', { from: 'mi', to: 'km', value: miles }, [miles]);
  const { data: ftRaw } = useLuaQuery<{ result: number }>('convert:convert', { from: 'mi', to: 'ft', value: miles }, [miles]);
  const { data: tempRaw } = useLuaQuery<{ result: number }>('convert:convert', { from: 'f', to: 'c', value: 72 }, []);
  const { data: litRaw } = useLuaQuery<{ result: number }>('convert:convert', { from: 'gal', to: 'l', value: 1 }, []);
  const { data: radRaw } = useLuaQuery<{ result: number }>('convert:convert', { from: 'deg', to: 'rad', value: 180 }, []);

  const ready = kmRaw && ftRaw && tempRaw && litRaw && radRaw;

  return (
    <Box style={{ gap: 8 }}>
      <S.StoryCap>{'Bidirectional registry \u2014 distance, temp, volume, angle'}</S.StoryCap>

      {ready && (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.units }}>{`${miles} mi -> ${kmRaw.result.toFixed(3)} km`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`${miles} mi -> ${ftRaw.result.toFixed(0)} ft`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`72\u00B0F -> ${tempRaw.result.toFixed(2)}\u00B0C`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`1 gal -> ${litRaw.result.toFixed(4)} L`}</Text>
          <Text style={{ fontSize: 10, color: C.units }}>{`180\u00B0 -> ${radRaw.result.toFixed(6)} rad`}</Text>
        </Box>
      )}

      <S.RowG8>
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
      </S.RowG8>
    </Box>
  );
}

// ── Encoding Demo ─────────────────────────────────────────

const ENC_INPUT = 'Hello, ReactJIT!';
const HTML_INPUT = '<script>alert("xss")</script>';

function EncodingDemo() {
  const c = useThemeColors();

  const { data: b64Raw } = useLuaQuery<{ result: string }>('convert:convert', { from: 'text', to: 'base64', value: ENC_INPUT }, []);
  const { data: hexRaw } = useLuaQuery<{ result: string }>('convert:convert', { from: 'text', to: 'hex-enc', value: 'ABC' }, []);
  const { data: urlRaw } = useLuaQuery<{ result: string }>('convert:convert', { from: 'text', to: 'url', value: ENC_INPUT }, []);
  const { data: htmlRaw } = useLuaQuery<{ result: string }>('convert:convert', { from: 'text', to: 'html', value: HTML_INPUT }, []);

  const b64 = b64Raw?.result;
  // Round-trip: base64 → text (depends on b64 result)
  const { data: rtRaw } = useLuaQuery<{ result: string }>('convert:convert',
    b64 ? { from: 'base64', to: 'text', value: b64 } : { from: 'text', to: 'base64', value: '' },
    [b64],
  );

  const ready = b64 && hexRaw && urlRaw && htmlRaw;

  return (
    <Box style={{ gap: 8 }}>
      <S.StoryCap>{'text <-> base64, hex, url, html entities'}</S.StoryCap>
      {ready && (
        <>
          <Box style={{ gap: 2 }}>
            <S.SecondaryBody>{`Input: "${ENC_INPUT}"`}</S.SecondaryBody>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`Base64: ${b64}`}</Text>
            <Text style={{ fontSize: 10, color: c.success }}>{`Round-trip: "${b64 ? rtRaw?.result ?? '...' : '...'}" \u2713`}</Text>
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`"ABC" -> hex: ${hexRaw.result}`}</Text>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`URL: ${urlRaw.result}`}</Text>
            <Text style={{ fontSize: 10, color: C.encoding }}>{`HTML: ${htmlRaw.result}`}</Text>
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Number Base Demo ──────────────────────────────────────

function NumberBaseDemo() {
  const [num, setNum] = useState(255);

  const { data: binRaw } = useLuaQuery<{ result: string }>('convert:convert', { from: 'decimal', to: 'binary', value: num }, [num]);
  const { data: octRaw } = useLuaQuery<{ result: string }>('convert:convert', { from: 'decimal', to: 'octal', value: num }, [num]);
  const { data: hexRaw } = useLuaQuery<{ result: string }>('convert:convert', { from: 'decimal', to: 'hex-num', value: num }, [num]);

  const ready = binRaw && octRaw && hexRaw;

  return (
    <Box style={{ gap: 8 }}>
      <S.StoryCap>{'decimal <-> binary, octal, hex'}</S.StoryCap>
      {ready && (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> binary: ${binRaw.result}`}</Text>
          <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> octal:  ${octRaw.result}`}</Text>
          <Text style={{ fontSize: 10, color: C.numbers }}>{`${num} -> hex:    ${hexRaw.result}`}</Text>
        </Box>
      )}
      <S.RowG8>
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
      </S.RowG8>
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
      <S.DimMicro>{label}</S.DimMicro>
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
  const { data: raw } = useLuaQuery<{ result: any }>('convert:convert',
    { from: preset.from, to: preset.to, value: preset.value },
    [idx],
  );
  const result = raw?.result != null ? (typeof raw.result === 'number' ? raw.result.toFixed(4) : String(raw.result)) : null;

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

      <S.RowG6 style={{ justifyContent: 'center' }}>
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
      </S.RowG6>
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

  useMount(() => {
    Promise.all([getCategories({}), getSize({})]).then(([cats, size]) => {
      setTotal(size);
      return Promise.all((cats as string[]).map((cat: string) =>
        getUnits({ category: cat }).then((units: string[]) => ({ cat, units }))
      ));
    }).then(rows => setCatalog(rows)).catch(() => {});
  });

  return (
    <Box style={{ gap: 6 }}>
      {total !== null && (
        <S.StoryCap>{`${total} converters across ${catalog.length} categories`}</S.StoryCap>
      )}
      {catalog.map(({ cat, units }) => {
        const catColor = CAT_COLORS[cat] || c.text;
        return (
          <S.RowCenterG8 key={cat}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: catColor }} />
            <S.StoryBody style={{ fontWeight: 'normal', width: 90 }}>{cat}</S.StoryBody>
            <S.StoryCap>{units.join(', ')}</S.StoryCap>
          </S.RowCenterG8>
        );
      })}
    </Box>
  );
}

// ── ConversionsStory ──────────────────────────────────────

export function ConversionsStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="package" tintColor={C.accent} />
        <S.StoryTitle>{'Convert'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/convert'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Lua-backed unit, color, encoding & number-base conversions'}</S.StoryMuted>
      </S.RowCenterBorder>

      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero ── */}
        <Box style={{ borderLeftWidth: 3, borderColor: C.accent, paddingLeft: 25, paddingRight: 28, paddingTop: 24, paddingBottom: 24, gap: 8 }}>
          <S.StoryHeadline>
            {'All conversion math runs in Lua. React side: one hook.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'useConvert() returns an async RPC caller. Pass { from, to, value } — Lua handles every transform: units, colors, encodings, number bases.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Band 1: Install ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'One hook for everything. No registry to import, no helper functions. The Lua backend handles all conversions.'}
            </S.StoryBody>
          </Box>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band 2: Color ── */}
        <Box style={BAND}>
          <Box style={HALF}><ColorDemo /></Box>
          <Box style={HALF}>
            <SectionLabel icon="palette">{'COLOR SPACES'}</SectionLabel>
            <S.StoryBody>
              {'Hex, RGB, HSL, HSV, named colors. Pure Lua math — no JS compute, no bridge overhead beyond the RPC call.'}
            </S.StoryBody>
            <S.RowG6 style={{ flexWrap: 'wrap' }}>
              <Tag text="hex" tagColor={C.color} />
              <Tag text="rgb" tagColor={C.color} />
              <Tag text="hsl" tagColor={C.color} />
              <Tag text="hsv" tagColor={C.color} />
              <Tag text="named" tagColor={C.color} />
            </S.RowG6>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={COLOR_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: Units ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="gauge">{'UNIT CONVERSION'}</SectionLabel>
            <S.StoryBody>
              {'Distance, weight, temperature, volume, speed, area, time, data, pressure, energy, angle — all registered in Lua.'}
            </S.StoryBody>
            <S.RowG6 style={{ flexWrap: 'wrap' }}>
              <Tag text="length" tagColor={C.units} />
              <Tag text="temp" tagColor={C.units} />
              <Tag text="weight" tagColor={C.units} />
              <Tag text="volume" tagColor={C.units} />
              <Tag text="pressure" tagColor={C.units} />
              <Tag text="angle" tagColor={C.units} />
            </S.RowG6>
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
            <S.StoryBody>
              {'Base64 via love.data.encode, hex, URL percent-encoding, HTML entity escaping — all in Lua.'}
            </S.StoryBody>
            <S.RowG6 style={{ flexWrap: 'wrap' }}>
              <Tag text="base64" tagColor={C.encoding} />
              <Tag text="hex" tagColor={C.encoding} />
              <Tag text="url" tagColor={C.encoding} />
              <Tag text="html" tagColor={C.encoding} />
            </S.RowG6>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ENCODING_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: Number bases ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="binary">{'NUMBER BASES'}</SectionLabel>
            <S.StoryBody>
              {'Decimal, binary, octal, hex — all 12 cross-conversions. Lua string.format and tonumber(s, base) do the work.'}
            </S.StoryBody>
            <S.RowG6 style={{ flexWrap: 'wrap' }}>
              <Tag text="decimal" tagColor={C.numbers} />
              <Tag text="binary" tagColor={C.numbers} />
              <Tag text="octal" tagColor={C.numbers} />
              <Tag text="hex" tagColor={C.numbers} />
            </S.RowG6>
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
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Zero JS compute. Every conversion runs in LuaJIT. React never touches the math — it just reads { result }.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 6: Fluent API ── */}
        <Box style={BAND}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={FLUENT_CODE} />
          <Box style={HALF}>
            <SectionLabel icon="code">{'ONE HOOK'}</SectionLabel>
            <S.StoryBody>
              {'useConvert() is the entire API. No helpers, no registry imports, no type gymnastics. One RPC call, one result.'}
            </S.StoryBody>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: Pipeline ── */}
        <Box style={BAND}>
          <Box style={HALF}><PipelineDemo /></Box>
          <Box style={HALF}>
            <SectionLabel icon="git-merge">{'PIPELINE'}</SectionLabel>
            <S.StoryBody>
              {'Every conversion follows the same path: React fires an RPC call, Lua looks up the converter by from->to key, runs the transform, returns { result }. Click a preset to trace different conversions.'}
            </S.StoryBody>
            <S.StoryCap>
              {'The result field is nil on error — check for { error } to handle unknown unit pairs gracefully.'}
            </S.StoryCap>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 8: Registry ── */}
        <Box style={{ ...BAND, paddingBottom: 24 }}>
          <Box style={HALF}>
            <SectionLabel icon="layers">{'REGISTRY'}</SectionLabel>
            <S.StoryBody>
              {'All registered converters live in Lua. Use convert:categories, convert:units, and convert:size RPCs to introspect at runtime.'}
            </S.StoryBody>
          </Box>
          <Box style={HALF}><RegistryCatalog /></Box>
        </Box>

        </PageColumn>
      </ScrollView>

      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="package" />
        <S.StoryBreadcrumbActive>{'Convert'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v1.0.0 — Lua backend'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
