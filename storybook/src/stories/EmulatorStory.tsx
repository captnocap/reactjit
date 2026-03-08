import React, { useState } from 'react';
import { Box, Text, Pressable, Emulator, classifiers as S} from '../../../packages/core/src';
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
    <S.StoryRoot style={{ padding: 16, gap: 12 }}>
      {/* Header */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>NES Emulator</Text>
        <S.DimBody11>
          {romName
            ? `Playing: ${romName}`
            : 'Drag and drop a .nes ROM file to play'
          }
        </S.DimBody11>
      </Box>

      {/* Emulator viewport */}
      <S.GrowCenterAlign>
        {/* // rjit-ignore-next-line */}
        <Emulator
          playing={playing}
          style={{ width: 512, height: 480 }}
          onROMLoaded={(e) => setRomName(e.filename)}
        />
      </S.GrowCenterAlign>

      {/* Controls bar */}
      <S.RowCenterG8 style={{ width: '100%', justifyContent: 'center' }}>
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
          <S.StoryCap>
            Arrows=D-pad  Z=A  X=B  Enter=Start  Shift=Select
          </S.StoryCap>
        </Box>
      </S.RowCenterG8>
    </S.StoryRoot>
  );
}
