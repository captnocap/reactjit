import React, { useState } from 'react';
import { Box, Text, Pressable, Emulator } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

/**
 * EmulatorStory — NES emulation demo
 *
 * Drag and drop a .nes ROM file onto the emulator to play.
 *
 * Controls:
 *   Arrow keys  → D-pad
 *   Z           → A button
 *   X           → B button
 *   Enter       → Start
 *   Shift       → Select
 */

export default function EmulatorStory() {
  const c = useThemeColors();
  const [playing, setPlaying] = useState(true);
  const [romName, setRomName] = useState<string | null>(null);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 12 }}>
      {/* Header */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>NES Emulator</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>
          {romName
            ? `Playing: ${romName}`
            : 'Drag and drop a .nes ROM file to play'
          }
        </Text>
      </Box>

      {/* Emulator viewport */}
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* // rjit-ignore-next-line */}
        <Emulator
          playing={playing}
          style={{ width: 512, height: 480 }}
          onROMLoaded={(e) => setRomName(e.filename)}
        />
      </Box>

      {/* Controls bar */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={() => setPlaying(!playing)}>
          <Box style={{
            backgroundColor: playing ? c.error : c.success,
            borderRadius: 6,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
          }}>
            <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: '600' }}>
              {playing ? 'Pause' : 'Play'}
            </Text>
          </Box>
        </Pressable>

        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 8, gap: 2 }}>
          <Text style={{ fontSize: 9, color: c.textDim }}>
            Arrows=D-pad  Z=A  X=B  Enter=Start  Shift=Select
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
