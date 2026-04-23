import { Box, Col, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';

export function Card(props: { title?: string; subtitle?: string; children?: any; right?: any; style?: any }) {
  return (
    <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, ...(props.style || {}) }}>
      {(props.title || props.subtitle || props.right) ? (
        <Row style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
            {props.title ? <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text> : null}
            {props.subtitle ? <Text fontSize={10} color={COLORS.textDim}>{props.subtitle}</Text> : null}
          </Col>
          {props.right || null}
        </Row>
      ) : null}
      {props.children}
    </Box>
  );
}

export function Banner(props: { available: boolean; pending: boolean; banner: string; error: string; hostFns: string[] }) {
  if (props.available && !props.pending && !props.banner && !props.error) return null;
  const message = props.error || props.banner || 'host crypto bindings pending';
  return (
    <Box style={{ gap: 6, padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
      <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>{message}</Text>
      {props.hostFns.length ? (
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          {props.hostFns.join(', ')}
        </Text>
      ) : (
        <Text fontSize={9} color={COLORS.textDim}>No `__crypto_*` host functions are registered in this runtime.</Text>
      )}
    </Box>
  );
}

export function Chip(props: { label: string; active?: boolean; tone?: string; onPress?: () => void }) {
  const active = !!props.active;
  const tone = props.tone || (active ? COLORS.blue : COLORS.textDim);
  return (
    <HoverPressable
      onPress={props.onPress}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: TOKENS.radiusPill,
        borderWidth: 1,
        borderColor: active ? tone : COLORS.border,
        backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Text fontSize={9} color={tone} style={{ fontWeight: 'bold' }}>{props.label}</Text>
    </HoverPressable>
  );
}

export function Field(props: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; rows?: number; style?: any }) {
  return (
    <Col style={{ gap: 4, ...(props.style || {}) }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        multiline={!!props.multiline}
        style={{
          minHeight: props.multiline ? Math.max(70, (props.rows || 3) * 22) : 34,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: props.multiline ? 8 : 0,
          paddingBottom: props.multiline ? 8 : 0,
          borderRadius: TOKENS.radiusMd,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.panelBg,
          color: COLORS.textBright,
          ...(props.multiline ? { fontFamily: 'monospace', textAlignVertical: 'top' as any } : {}),
        }}
      />
    </Col>
  );
}
