
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { splitChord, chordFromEvent } from './useKeybindStore';

function Chips(props: { chord: string }) {
  const parts = splitChord(props.chord);
  if (!parts.length) {
    return <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>Press keys...</Text>;
  }
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {parts.map((part) => (
        <Box key={part} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{part}</Text>
        </Box>
      ))}
    </Row>
  );
}

export function BindingCapture(props: {
  commandLabel?: string;
  value: string;
  active: boolean;
  onStart: () => void;
  onCommit: (chord: string) => void;
  onCancel: () => void;
}) {
  const [live, setLive] = useState(props.value);

  useEffect(() => {
    setLive(props.value);
  }, [props.value]);

  useEffect(() => {
    if (!props.active) return;
    const target: any = typeof window !== 'undefined' ? window : globalThis;
    if (!target || typeof target.addEventListener !== 'function') return;
    const onKey = (event: any) => {
      try { event.preventDefault?.(); } catch {}
      try { event.stopPropagation?.(); } catch {}
      if (event.repeat) return;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key === 'escape' && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        props.onCancel();
        return;
      }
      if ((key === 'backspace' || key === 'delete') && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        props.onCommit('');
        props.onCancel();
        return;
      }
      const chord = chordFromEvent(event);
      if (!chord) return;
      setLive(chord);
      props.onCommit(chord);
      props.onCancel();
    };
    target.addEventListener('keydown', onKey, true);
    return () => {
      try { target.removeEventListener('keydown', onKey, true); } catch {}
    };
  }, [props]);

  return (
    <Col style={{ gap: 8 }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.7, fontWeight: 'bold' }}>CURRENT BINDING</Text>
          <Text fontSize={16} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.commandLabel || 'Choose a command'}</Text>
        </Col>
        <Pressable
          onPress={props.active ? props.onCancel : props.onStart}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 7,
            paddingBottom: 7,
            borderRadius: TOKENS.radiusSm,
            borderWidth: 1,
            borderColor: props.active ? COLORS.orange : COLORS.border,
            backgroundColor: props.active ? COLORS.orangeDeep : COLORS.panelAlt,
          }}
        >
          <Text fontSize={10} color={props.active ? COLORS.orange : COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.active ? 'Cancel' : 'Press keys...'}</Text>
        </Pressable>
      </Row>

      <Pressable
        onPress={props.active ? props.onCancel : props.onStart}
        style={{
          minHeight: 70,
          padding: 12,
          borderRadius: TOKENS.radiusMd,
          borderWidth: 1,
          borderColor: props.active ? COLORS.orange : COLORS.border,
          backgroundColor: props.active ? COLORS.orangeDeep : COLORS.panelRaised,
          justifyContent: 'center',
        }}
      >
        <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chips chord={props.active ? live : props.value} />
          {props.active ? <Text fontSize={10} color={COLORS.textDim}>Escape cancels, Backspace clears.</Text> : null}
        </Row>
      </Pressable>
    </Col>
  );
}
