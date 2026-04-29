
import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import type { EmulatorState, SaveState } from '../../lib/emulator/hooks/useEmulator';

export function EmulatorControls(props: {
  state: EmulatorState;
  romName: string | null;
  fps: number;
  onLoadROM: (path: string) => boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
  onSaveState: () => SaveState | null;
  onLoadSaveState: (ss: SaveState) => void;
}) {
  const [path, setPath] = useState('');
  const [speed, setSpeedLocal] = useState(1);
  const [saveSlot, setSaveSlot] = useState<SaveState | null>(null);

  const speeds = [0.25, 0.5, 1, 2, 4, 8];

  return (
    <Col style={{ gap: 8, padding: 10, backgroundColor: COLORS.panelRaised, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      {/* ROM loader */}
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.textMuted}>ROM path</Text>
        <TextInput
          value={path}
          onChange={setPath}
          fontSize={11}
          color={COLORS.text}
          style={{ flexGrow: 1, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, padding: 6, borderRadius: TOKENS.radiusSm }}
        />
        <HoverPressable
          onPress={() => {
            if (path) props.onLoadROM(path);
          }}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: COLORS.blueDeep,
            borderWidth: 1,
            borderColor: COLORS.blue,
          }}
        >
          <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Load</Text>
        </HoverPressable>
        {props.romName ? (
          <Text fontSize={10} color={COLORS.textDim}>{props.romName}</Text>
        ) : null}
      </Row>

      {/* Playback controls */}
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {props.state === 'running' ? (
          <HoverPressable onPress={props.onPause} style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
            <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>Pause</Text>
          </HoverPressable>
        ) : (
          <HoverPressable onPress={props.onPlay} style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.greenDeep, borderWidth: 1, borderColor: COLORS.green }}>
            <Text fontSize={10} color={COLORS.green} style={{ fontWeight: 'bold' }}>Play</Text>
          </HoverPressable>
        )}

        <HoverPressable onPress={props.onStep} style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.text}>Step</Text>
        </HoverPressable>

        <HoverPressable onPress={props.onReset} style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.text}>Reset</Text>
        </HoverPressable>

        {/* Speed */}
        <Row style={{ gap: 4, alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.textDim}>Speed</Text>
          {speeds.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setSpeedLocal(s);
                props.onSetSpeed(s);
              }}
              style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: TOKENS.radiusSm,
                backgroundColor: speed === s ? COLORS.blueDeep : COLORS.grayChip,
                borderWidth: 1,
                borderColor: speed === s ? COLORS.blue : COLORS.border,
              }}
            >
              <Text fontSize={9} color={speed === s ? COLORS.blue : COLORS.textDim}>{s + 'x'}</Text>
            </Pressable>
          ))}
        </Row>

        {/* Savestate */}
        <HoverPressable
          onPress={() => {
            const ss = props.onSaveState();
            if (ss) setSaveSlot(ss);
          }}
          style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}
        >
          <Text fontSize={10} color={COLORS.text}>Save</Text>
        </HoverPressable>

        <HoverPressable
          onPress={() => {
            if (saveSlot) props.onLoadSaveState(saveSlot);
          }}
          style={{
            padding: 8,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: saveSlot ? COLORS.panelAlt : COLORS.grayChip,
            borderWidth: 1,
            borderColor: saveSlot ? COLORS.border : COLORS.borderSoft,
          }}
        >
          <Text fontSize={10} color={saveSlot ? COLORS.text : COLORS.textMuted}>Load</Text>
        </HoverPressable>

        <Text fontSize={10} color={COLORS.textMuted}>{props.fps} fps</Text>
      </Row>
    </Col>
  );
}
