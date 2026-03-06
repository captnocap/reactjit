/**
 * NESPanel — Libretro NES emulator panel.
 *
 * Runs Mega Man 2 (or any NES ROM) via the Libretro capability with nestopia core.
 * Controls: Arrows=D-pad, Z=A, X=B, Enter=Start, RShift=Select
 *           F5=Save state, F9=Load state, F6=Reset
 */
import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, Libretro } from '@reactjit/core';
import { C } from '../theme';

const CORE_PATH = '/usr/lib/x86_64-linux-gnu/libretro/nestopia_libretro.so';

const ROMS: Array<{ label: string; path: string }> = [
  { label: 'Mega Man',   path: '/home/siah/creative/reactjit/claudeshome/games/roms/USA/Mega Man (U).nes' },
  { label: 'Mega Man 2', path: '/home/siah/creative/reactjit/claudeshome/games/roms/USA/Mega Man 2 (U).nes' },
  { label: 'Mega Man 3', path: '/home/siah/creative/reactjit/claudeshome/games/roms/USA/Mega Man 3 (U) [!].nes' },
  { label: 'Mega Man 4', path: '/home/siah/creative/reactjit/claudeshome/games/roms/USA/Mega Man 4 (U).nes' },
  { label: 'Mega Man 5', path: '/home/siah/creative/reactjit/claudeshome/games/roms/USA/Mega Man 5 (U).nes' },
  { label: 'Mega Man 6', path: '/home/siah/creative/reactjit/claudeshome/games/roms/USA/Mega Man 6 (U).nes' },
];

interface LoadedInfo {
  coreName: string;
  coreVersion: string;
  romPath: string;
}

export function NESPanel() {
  const [selectedRom, setSelectedRom] = useState(1); // Default: Mega Man 2
  const [running, setRunning] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loaded, setLoaded] = useState<LoadedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [romKey, setRomKey] = useState(0);

  const handleLoaded = useCallback((e: any) => {
    setLoaded({ coreName: e.coreName, coreVersion: e.coreVersion, romPath: e.romPath });
    setError(null);
  }, []);

  const handleError = useCallback((e: any) => {
    setError(e.message || 'Unknown error');
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed(prev => {
      if (prev === 1) return 2;
      if (prev === 2) return 4;
      return 1;
    });
  }, []);

  const switchRom = useCallback((idx: number) => {
    setSelectedRom(idx);
    setRomKey(k => k + 1);
    setLoaded(null);
    setError(null);
  }, []);

  const rom = ROMS[selectedRom];

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header bar */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 8, paddingRight: 8,
        paddingTop: 4, paddingBottom: 4,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
        gap: 6,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, color: '#e44', fontWeight: 'bold' }}>{'NES'}</Text>
          <Text style={{ fontSize: 9, color: C.textMuted }}>{rom.label}</Text>
          {loaded && (
            <Text style={{ fontSize: 8, color: C.textDim }}>
              {`${loaded.coreName} ${loaded.coreVersion}`}
            </Text>
          )}
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setRunning(r => !r)} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1,
            borderColor: running ? C.approve + '66' : C.deny + '66',
            backgroundColor: running ? C.approve + '11' : C.deny + '11',
          }}>
            <Text style={{ fontSize: 8, color: running ? C.approve : C.deny }}>
              {running ? 'PLAY' : 'PAUSE'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setMuted(m => !m)} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 8, color: muted ? C.deny : C.textMuted }}>
              {muted ? 'MUTED' : 'SND'}
            </Text>
          </Pressable>
          <Pressable onPress={cycleSpeed} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 8, color: speed > 1 ? C.warning : C.textMuted }}>
              {`${speed}x`}
            </Text>
          </Pressable>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Box style={{ padding: 8, backgroundColor: C.deny + '11' }}>
          <Text style={{ fontSize: 9, color: C.deny }}>{error}</Text>
        </Box>
      )}

      {/* Emulator viewport */}
      <Box style={{ flexGrow: 1, backgroundColor: '#000' }}>
        <Libretro
          key={romKey}
          core={CORE_PATH}
          rom={rom.path}
          running={running}
          muted={muted}
          speed={speed}
          volume={0.8}
          onLoaded={handleLoaded}
          onError={handleError}
          style={{ flexGrow: 1 }}
        />
      </Box>

      {/* ROM selector */}
      <Box style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
        paddingLeft: 6, paddingRight: 6,
        paddingTop: 4, paddingBottom: 4,
        borderTopWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        {ROMS.map((r, i) => (
          <Pressable key={i} onPress={() => switchRom(i)} style={{
            paddingLeft: 6, paddingRight: 6,
            paddingTop: 2, paddingBottom: 2,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: i === selectedRom ? '#e44' + '66' : C.border,
            backgroundColor: i === selectedRom ? '#e44' + '11' : 'transparent',
          }}>
            <Text style={{ fontSize: 8, color: i === selectedRom ? '#e44' : C.textMuted }}>
              {r.label}
            </Text>
          </Pressable>
        ))}
      </Box>

      {/* Controls legend */}
      <Box style={{
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 8, paddingRight: 8,
        paddingTop: 2, paddingBottom: 4,
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 7, color: C.textDim }}>
          {'Arrows=Move  Z=A  X=B  Enter=Start  RShift=Select  F5=Save  F9=Load  F6=Reset'}
        </Text>
      </Box>
    </Box>
  );
}
