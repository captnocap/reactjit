const React: any = require('react');
const { useState, useCallback } = React;

import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { useEmulator } from '../../lib/emulator/hooks/useEmulator';
import { useController, DEFAULT_BINDINGS } from '../../lib/emulator/hooks/useController';
import { EmulatorScreen } from './EmulatorScreen';
import { EmulatorControls } from './EmulatorControls';
import { ControllerMapper } from './ControllerMapper';

const SCALES = [1, 2, 3, 4];

export function EmulatorPanel() {
  const emulator = useEmulator();
  const [scale, setScale] = useState(2);
  const [showBindings, setShowBindings] = useState(false);

  const handleButtonChange = useCallback((button: keyof typeof DEFAULT_BINDINGS, pressed: boolean) => {
    const bus = emulator.busRef.current;
    if (!bus) return;
    bus.controller1.setButton(button, pressed);
  }, [emulator.busRef]);

  const controller = useController(handleButtonChange);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      {/* Header */}
      <Row style={{ padding: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <Text fontSize={14} color={COLORS.text} style={{ fontWeight: 'bold' }}>NES Emulator</Text>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.textDim}>Scale</Text>
          {SCALES.map((s) => (
            <Box
              key={s}
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 4,
                backgroundColor: scale === s ? COLORS.blueDeep : COLORS.panelAlt,
                borderWidth: 1,
                borderColor: scale === s ? COLORS.blue : COLORS.border,
              }}
            >
              <Text
                fontSize={10}
                color={scale === s ? COLORS.blue : COLORS.textDim}
                onPress={() => setScale(s)}
              >
                {s}x
              </Text>
            </Box>
          ))}
          <Box
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 4,
              backgroundColor: showBindings ? COLORS.blueDeep : COLORS.panelAlt,
              borderWidth: 1,
              borderColor: showBindings ? COLORS.blue : COLORS.border,
            }}
          >
            <Text
              fontSize={10}
              color={showBindings ? COLORS.blue : COLORS.textDim}
              onPress={() => setShowBindings((v) => !v)}
            >
              Bindings
            </Text>
          </Box>
        </Row>
      </Row>

      {/* Screen */}
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        {emulator.romName ? (
          <EmulatorScreen
            busRef={emulator.busRef}
            tick={emulator.tick}
            scale={scale}
          />
        ) : (
          <Col style={{ alignItems: 'center', gap: 8 }}>
            <Text fontSize={12} color={COLORS.textDim}>No ROM loaded</Text>
            <Text fontSize={10} color={COLORS.textMuted}>Enter a .nes file path and click Load</Text>
          </Col>
        )}
      </Box>

      {/* Controls */}
      <EmulatorControls
        state={emulator.state}
        romName={emulator.romName}
        fps={emulator.fps}
        onLoadROM={emulator.loadROM}
        onPlay={emulator.play}
        onPause={emulator.pause}
        onStep={emulator.step}
        onReset={emulator.reset}
        onSetSpeed={emulator.setSpeed}
        onSaveState={emulator.saveState}
        onLoadSaveState={emulator.loadSaveState}
      />

      {showBindings ? (
        <ControllerMapper
          bindings={controller.bindings}
          onChange={controller.setBindings}
          onReset={controller.resetBindings}
        />
      ) : null}
    </Col>
  );
}
