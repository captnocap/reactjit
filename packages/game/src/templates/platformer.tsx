import React, { useState } from 'react';
import { Box, Text } from '@ilovereact/core';
import { Game } from '../GameCanvas';

interface PlatformerState {
  score: number;
  collected: number;
  totalCoins: number;
  won: boolean;
}

const INITIAL_STATE: PlatformerState = {
  score: 0,
  collected: 0,
  totalCoins: 0,
  won: false,
};

export function PlatformerTemplate() {
  const [state, setState] = useState<PlatformerState>(INITIAL_STATE);

  return (
    <Game
      module="platformer"
      instanceKey="platformer-template"
      mode="react"
      config={{
        gravity: 600,
        moveSpeed: 120,
        jumpForce: 280,
        maxFallSpeed: 350,
      }}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      on={{
        state: (s: PlatformerState) => setState(s),
      }}
    >
      <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', padding: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, color: '#cdd6f4', fontWeight: 'bold' }}>Platformer (Lua Runtime)</Text>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 12, color: '#f9e2af' }}>{`Score: ${state.score}`}</Text>
          <Text style={{ fontSize: 12, color: '#a6e3a1' }}>{`Coins: ${state.collected}/${state.totalCoins}`}</Text>
        </Box>
      </Box>

      {state.won && (
        <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
          <Box style={{ backgroundColor: 'rgba(20,22,30,0.9)', borderWidth: 2, borderColor: '#a6e3a1', borderRadius: 8, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12 }}>
            <Text style={{ fontSize: 16, color: '#a6e3a1', fontWeight: 'bold' }}>All coins collected!</Text>
          </Box>
        </Box>
      )}

      <Box style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', padding: 6, flexDirection: 'row', gap: 16 }}>
        <Text style={{ fontSize: 10, color: '#6c7086' }}>Arrow keys / WASD to move</Text>
        <Text style={{ fontSize: 10, color: '#6c7086' }}>Space / W / Up to jump</Text>
      </Box>
    </Game>
  );
}
