import { Col, Row, Text, Pressable, Box } from '../../../runtime/primitives';
import { COLORS } from '../constants';

const SHORTCUTS = [
  { key: '1-7', desc: 'Switch main tabs' },
  { key: 'E', desc: 'Elements panel' },
  { key: 'C', desc: 'Console panel' },
  { key: 'N', desc: 'Network panel' },
  { key: 'P', desc: 'Performance panel' },
  { key: 'M', desc: 'Memory panel' },
  { key: 'H', desc: 'Host panel' },
  { key: '↑ / ↓', desc: 'Navigate tree selection' },
  { key: '← / →', desc: 'Collapse / expand node' },
  { key: '?', desc: 'Toggle this help' },
  { key: 'Esc', desc: 'Clear selection / close' },
];

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <Col
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        gap: 0,
      }}
    >
      <Pressable onPress={onClose} style={{ width: '100%', height: '100%', position: 'absolute' }} />
      <Col
        style={{
          backgroundColor: COLORS.bgPanel,
          borderRadius: 8,
          padding: 16,
          gap: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          minWidth: 300,
          zIndex: 101,
        }}
      >
        <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          Keyboard Shortcuts
        </Text>
        <Col style={{ gap: 6 }}>
          {SHORTCUTS.map((s) => (
            <Row key={s.key} style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <Box style={{ backgroundColor: COLORS.bgElevated, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderWidth: 1, borderColor: COLORS.border }}>
                <Text fontSize={10} color={COLORS.accentLight}>{s.key}</Text>
              </Box>
              <Text fontSize={10} color={COLORS.text} style={{ flexGrow: 1, textAlign: 'right' }}>
                {s.desc}
              </Text>
            </Row>
          ))}
        </Col>
        <Pressable
          onPress={onClose}
          style={{
            backgroundColor: COLORS.accent,
            borderRadius: 4,
            padding: 8,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
        </Pressable>
      </Col>
    </Col>
  );
}
