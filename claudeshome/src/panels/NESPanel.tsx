/**
 * NESPanel — Libretro NES emulator panel with live memory HUD.
 *
 * Runs Mega Man 2 (or any NES ROM) via the Libretro capability with nestopia core.
 * Reads NES system RAM in real-time to show lives, HP, boss HP, weapon, stage.
 *
 * Controls: Arrows=D-pad, Z=A, X=B, Enter=Start, RShift=Select
 *           F5=Save state, F9=Load state, F6=Reset
 */
import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, Libretro } from '@reactjit/core';
import { useNESMemory } from '../hooks/useNESMemory';
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

function HpBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const blocks = Math.round(pct * 14);
  const bar = '\u2588'.repeat(blocks) + '\u2591'.repeat(14 - blocks);
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 7, color: C.textMuted, width: 24 }}>{label}</Text>
      <Text style={{ fontSize: 8, color, fontFamily: 'monospace' }}>{bar}</Text>
      <Text style={{ fontSize: 7, color: C.textDim }}>{`${value}`}</Text>
    </Box>
  );
}

export function NESPanel() {
  const [selectedRom, setSelectedRom] = useState(1);
  const [running, setRunning] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loaded, setLoaded] = useState<{ coreName: string; coreVersion: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [romKey, setRomKey] = useState(0);
  const [showHud, setShowHud] = useState(true);

  const mem = useNESMemory();

  const handleLoaded = useCallback((e: any) => {
    setLoaded({ coreName: e.coreName, coreVersion: e.coreVersion });
    setError(null);
  }, []);

  const handleError = useCallback((e: any) => {
    setError(e.message || 'Unknown error');
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed(prev => prev === 1 ? 2 : prev === 2 ? 4 : 1);
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
      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0, gap: 6,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, color: '#e44', fontWeight: 'bold' }}>{'NES'}</Text>
          <Text style={{ fontSize: 9, color: C.textMuted }}>{rom.label}</Text>
          {loaded && (
            <Text style={{ fontSize: 8, color: C.textDim }}>
              {`${loaded.coreName} ${loaded.coreVersion}`}
            </Text>
          )}
          {mem.connected && (
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.approve }} />
          )}
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setShowHud(h => !h)} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 8, color: showHud ? C.accent : C.textMuted }}>{'HUD'}</Text>
          </Pressable>
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

      {error && (
        <Box style={{ padding: 8, backgroundColor: C.deny + '11' }}>
          <Text style={{ fontSize: 9, color: C.deny }}>{error}</Text>
        </Box>
      )}

      {/* Emulator + HUD side by side */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {/* Viewport */}
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

        {/* Memory HUD sidebar */}
        {showHud && mem.connected && (
          <Box style={{
            width: 120, flexShrink: 0, backgroundColor: C.bg,
            borderLeftWidth: 1, borderColor: C.border,
            paddingLeft: 6, paddingRight: 6, paddingTop: 6, paddingBottom: 6,
            gap: 6,
          }}>
            <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: 'bold' }}>{'MEMORY'}</Text>

            {/* Lives */}
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 7, color: C.textDim }}>{'LIVES'}</Text>
              <Text style={{ fontSize: 14, color: '#e44', fontWeight: 'bold' }}>
                {'\u2665 '.repeat(Math.min(mem.state.lives, 9)).trim() || '\u2665'}
              </Text>
            </Box>

            {/* HP bars */}
            <Box style={{ gap: 3 }}>
              <HpBar label="HP" value={mem.state.hp} max={28} color={C.approve} />
              <HpBar label="BOSS" value={mem.state.bossHp} max={28} color="#e44" />
            </Box>

            {/* Stage / Weapon */}
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 7, color: C.textDim }}>{'STAGE'}</Text>
              <Text style={{ fontSize: 9, color: C.text }}>{mem.stageName}</Text>
            </Box>
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 7, color: C.textDim }}>{'WEAPON'}</Text>
              <Text style={{ fontSize: 9, color: C.accent }}>{mem.weaponName}</Text>
            </Box>

            {/* Game state */}
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 7, color: C.textDim }}>{'STATE'}</Text>
              <Text style={{ fontSize: 8, color: C.textMuted }}>
                {`0x${mem.state.gameState.toString(16).padStart(2, '0')}`}
              </Text>
            </Box>

            {/* Raw memory peek */}
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 7, color: C.textDim }}>{'RAM $00-$0F'}</Text>
              <Text style={{ fontSize: 7, color: C.textMuted, fontFamily: 'monospace' }}>
                {mem.state.raw.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(' ')}
              </Text>
            </Box>

            {mem.error && (
              <Text style={{ fontSize: 7, color: C.deny }}>{mem.error}</Text>
            )}
          </Box>
        )}
      </Box>

      {/* ROM selector */}
      <Box style={{
        flexDirection: 'row', flexWrap: 'wrap', gap: 3,
        paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
        borderTopWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        {ROMS.map((r, i) => (
          <Pressable key={i} onPress={() => switchRom(i)} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1,
            borderColor: i === selectedRom ? '#e44' + '66' : C.border,
            backgroundColor: i === selectedRom ? '#e44' + '11' : 'transparent',
          }}>
            <Text style={{ fontSize: 8, color: i === selectedRom ? '#e44' : C.textMuted }}>
              {r.label}
            </Text>
          </Pressable>
        ))}
      </Box>

      {/* Controls */}
      <Box style={{
        flexDirection: 'row', gap: 8,
        paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 4,
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 7, color: C.textDim }}>
          {'Arrows=Move  Z=A  X=B  Enter=Start  RShift=Select  F5=Save  F9=Load  F6=Reset'}
        </Text>
      </Box>
    </Box>
  );
}
