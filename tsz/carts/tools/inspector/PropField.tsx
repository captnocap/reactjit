// =============================================================================
// PropField — one key/value row with a type-appropriate editor
// =============================================================================
// Switches widget on the prop's value type:
//   • boolean → toggle pill
//   • number  → textbox + inline stepper
//   • color string (matches /^#([0-9a-f]{3,8})$/i) → swatch picker + text
//   • string  → text input
//   • function / object / array → read-only summary line
// =============================================================================

const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';

interface PropFieldProps {
  name: string;
  value: any;
  onChange: (name: string, next: any) => void;
  editable: boolean;
}

const COLOR_RE = /^#([0-9a-f]{3,8})$/i;
const PALETTE = [
  COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange, COLORS.red, COLORS.yellow,
  COLORS.textBright, COLORS.textDim, COLORS.border, COLORS.panelAlt,
];

function valueKind(v: any): string {
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return COLOR_RE.test(v) ? 'color' : 'string';
  if (typeof v === 'function') return 'function';
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  if (typeof v === 'object') return 'object';
  return 'unknown';
}

function summarise(v: any, kind: string): string {
  if (kind === 'function') return 'ƒ ' + (v.name || 'anonymous');
  if (kind === 'array')    return '[' + v.length + ' items]';
  if (kind === 'object')   return '{' + Object.keys(v).length + ' keys}';
  if (kind === 'null')     return 'null';
  return String(v);
}

export function PropField(props: PropFieldProps) {
  const kind = valueKind(props.value);
  const [draft, setDraft] = useState(() => (kind === 'string' || kind === 'color' ? String(props.value) : ''));

  useEffect(() => {
    if (kind === 'string' || kind === 'color') setDraft(String(props.value));
  }, [props.value, kind]);

  const commitString = (v: string) => { setDraft(v); if (props.editable) props.onChange(props.name, v); };
  const commitNumberDelta = (delta: number) => {
    const n = typeof props.value === 'number' ? props.value + delta : delta;
    if (props.editable) props.onChange(props.name, n);
  };
  const commitNumberText = (v: string) => {
    const n = Number(v);
    if (!isNaN(n) && props.editable) props.onChange(props.name, n);
  };

  return (
    <Row style={{
      padding: 6, gap: 8, alignItems: 'center', flexWrap: 'wrap',
      borderRadius: TOKENS.radiusSm,
      backgroundColor: COLORS.panelBg,
    }}>
      <Col style={{ flexBasis: 120, flexShrink: 1, gap: 1, minWidth: 80 }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
          {props.name}
        </Text>
        <Text fontSize={8} color={COLORS.textDim}>{kind}</Text>
      </Col>

      {kind === 'bool' ? (
        <Pressable onPress={() => props.editable && props.onChange(props.name, !props.value)} style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
          borderRadius: TOKENS.radiusPill, borderWidth: 1,
          borderColor: props.value ? COLORS.green : COLORS.border,
          backgroundColor: props.value ? COLORS.greenDeep : COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={props.value ? COLORS.green : COLORS.textDim} style={{ fontWeight: 'bold' }}>
            {props.value ? 'TRUE' : 'FALSE'}
          </Text>
        </Pressable>
      ) : null}

      {kind === 'number' ? (
        <Row style={{ gap: 4, alignItems: 'center' }}>
          <Pressable onPress={() => commitNumberDelta(-1)} style={{ width: 22, height: 22, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>−</Text>
          </Pressable>
          <TextInput value={String(props.value)} onChangeText={commitNumberText}
            style={{ width: 64, height: 22, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 6, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
          <Pressable onPress={() => commitNumberDelta(1)} style={{ width: 22, height: 22, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+</Text>
          </Pressable>
        </Row>
      ) : null}

      {kind === 'color' ? (
        <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box style={{ width: 22, height: 22, borderRadius: TOKENS.radiusSm, backgroundColor: draft, borderWidth: 1, borderColor: COLORS.border }} />
          <TextInput value={draft} onChangeText={commitString}
            style={{ width: 90, height: 22, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 6, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
          {PALETTE.map((c) => (
            <Pressable key={c} onPress={() => commitString(c)} style={{
              width: 18, height: 18, borderRadius: TOKENS.radiusSm,
              backgroundColor: c,
              borderWidth: draft.toLowerCase() === c.toLowerCase() ? 2 : 1,
              borderColor: draft.toLowerCase() === c.toLowerCase() ? COLORS.textBright : COLORS.border,
            }} />
          ))}
        </Row>
      ) : null}

      {kind === 'string' ? (
        <TextInput value={draft} onChangeText={commitString}
          style={{ flexBasis: 160, flexShrink: 1, flexGrow: 1, minWidth: 120, height: 22, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 6, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
      ) : null}

      {kind === 'function' || kind === 'array' || kind === 'object' || kind === 'null' || kind === 'unknown' ? (
        <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace', flexShrink: 1, flexBasis: 160 }}>
          {summarise(props.value, kind)}
        </Text>
      ) : null}

      {!props.editable ? (
        <Text fontSize={9} color={COLORS.textDim}>read-only</Text>
      ) : null}
    </Row>
  );
}
