
import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

export interface PianoKeyboardProps {
  rootMidi?: number;
  octaves?: number;
  activeNotes: number[];
  onNoteDown: (midi: number) => void;
  onNoteUp: (midi: number) => void;
  keyWidth?: number;
  keyHeight?: number;
  label?: string;
}

// Black-key offsets within an octave of 7 white keys (C major mapping).
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_MAP: Record<number, number> = {
  // maps white-index → black midi-offset (or undefined when no black key follows)
  0: 1, 1: 3, 3: 6, 4: 8, 5: 10,
};

function noteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[midi % 12] + Math.floor(midi / 12 - 1);
}

export function PianoKeyboard(props: PianoKeyboardProps) {
  const root = props.rootMidi ?? 48;
  const octaves = props.octaves ?? 2;
  const kw = props.keyWidth ?? 22;
  const kh = props.keyHeight ?? 90;
  const bkW = Math.round(kw * 0.65);
  const bkH = Math.round(kh * 0.58);
  const accent = COLORS.blue || '#79c0ff';

  const whiteKeys: { midi: number; i: number }[] = [];
  for (let o = 0; o < octaves; o++) {
    WHITE_STEPS.forEach((off, idx) => {
      whiteKeys.push({ midi: root + o * 12 + off, i: o * 7 + idx });
    });
  }

  return (
    <Box style={{ flexDirection: 'column', gap: 4 }}>
      {props.label ? (
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Box style={{ width: 3, height: 10, backgroundColor: accent, borderRadius: 1 }} />
          <Text style={{ color: accent, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>{props.label}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{props.activeNotes.length} held</Text>
        </Row>
      ) : null}
      <Box style={{ position: 'relative', width: whiteKeys.length * kw, height: kh, backgroundColor: COLORS.panelAlt || '#05090f', borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
        {whiteKeys.map((w) => {
          const held = props.activeNotes.includes(w.midi);
          return (
            <Pressable key={'w' + w.midi}
              onPressIn={() => props.onNoteDown(w.midi)}
              onPressOut={() => props.onNoteUp(w.midi)}
              style={{
                position: 'absolute', left: w.i * kw, top: 0,
                width: kw - 1, height: kh - 1,
                backgroundColor: held ? accent : (COLORS.textBright || '#e6edf3'),
                borderRightWidth: 1, borderColor: COLORS.border || '#1f2630',
                justifyContent: 'flex-end', alignItems: 'center',
                paddingBottom: 4,
              }}>
              <Text style={{ color: held ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 8, fontWeight: 700 }}>
                {w.midi % 12 === 0 ? noteName(w.midi) : ''}
              </Text>
            </Pressable>
          );
        })}
        {whiteKeys.map((w) => {
          const within = w.i % 7;
          const blackOff = BLACK_MAP[within];
          if (blackOff == null) return null;
          const midi = root + Math.floor(w.i / 7) * 12 + blackOff;
          const held = props.activeNotes.includes(midi);
          return (
            <Pressable key={'b' + midi}
              onPressIn={() => props.onNoteDown(midi)}
              onPressOut={() => props.onNoteUp(midi)}
              style={{
                position: 'absolute', left: (w.i + 1) * kw - bkW / 2, top: 0,
                width: bkW, height: bkH,
                backgroundColor: held ? accent : (COLORS.appBg || '#05090f'),
                borderWidth: 1, borderColor: COLORS.textDim,
                zIndex: 2, borderRadius: 2,
              }} />
          );
        })}
      </Box>
    </Box>
  );
}
