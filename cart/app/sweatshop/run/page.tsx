// Run — the sequencer surface.
//
// Per docs/03-sequencer-plan-trace.md: a 2D toggle grid where each cell is a
// behavior/rule/pose/loop armed for this run. Steps are not units of time —
// they are heterogeneous things the user wants armed. Pressing play sweeps
// the playhead left-to-right; each column serializes into the plan.
//
// **The sequencer is build-time. The plan is runtime. The prose is the seam.**
//
// This file is a placeholder. The real grid + sweep + plan emission lands
// here. For now: a static toggle grid mock + a Play affordance + an empty
// plan panel showing the read-twice-into-text shape.

import { useState } from 'react';
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { Play } from '@reactjit/runtime/icons/icons';
import { Icon } from '@reactjit/runtime/icons/Icon';

const ROWS = ['pin', 'plan', 'explore', 'write', 'review', 'commit'];
const COLS = 6;

type Grid = boolean[][];

function emptyGrid(): Grid {
  return ROWS.map(() => Array.from({ length: COLS }, () => false));
}

function Cell({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      width: 36,
      height: 36,
      borderRadius: 6,
      backgroundColor: on ? 'theme:accent' : 'theme:surfaceSubtle',
      borderColor: on ? 'theme:accent' : 'theme:lineSoft',
      borderWidth: 1,
    }} />
  );
}

function ToggleGrid({ grid, toggle }: { grid: Grid; toggle: (r: number, c: number) => void }) {
  return (
    <Col style={{ gap: 6 }}>
      {ROWS.map((label, r) => (
        <Row key={label} style={{ gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 80 }}>
            <Text size={11} color="theme:inkMuted">{label}</Text>
          </Box>
          {grid[r].map((on, c) => (
            <Cell key={c} on={on} onPress={() => toggle(r, c)} />
          ))}
        </Row>
      ))}
      <Row style={{ gap: 6, marginTop: 4, paddingLeft: 80 }}>
        {Array.from({ length: COLS }, (_, c) => (
          <Box key={c} style={{ width: 36, alignItems: 'center' }}>
            <Text size={9} color="theme:inkMuted">{`p${c + 1}`}</Text>
          </Box>
        ))}
      </Row>
    </Col>
  );
}

function planFromGrid(grid: Grid): string {
  const passes: string[] = [];
  for (let c = 0; c < COLS; c++) {
    const armed: string[] = [];
    for (let r = 0; r < ROWS.length; r++) {
      if (grid[r][c]) armed.push(ROWS[r]);
    }
    if (armed.length) passes.push(`pass ${c + 1}: ${armed.join(' + ')}`);
  }
  return passes.length ? passes.join('\n') : '(empty plan — arm at least one cell)';
}

export default function RunPage() {
  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const toggle = (r: number, c: number) => {
    setGrid((g) => g.map((row, ri) => row.map((on, ci) => (ri === r && ci === c ? !on : on))));
  };
  const plan = planFromGrid(grid);

  return (
    <Row style={{ flexGrow: 1, padding: 24, gap: 24, backgroundColor: 'theme:bg' }}>
      <Col style={{ flexGrow: 1, gap: 16 }}>
        <Row style={{ alignItems: 'baseline', gap: 12 }}>
          <Text size={20} color="theme:ink" bold={true}>Sequencer</Text>
          <Text size={11} color="theme:inkMuted">arm cells, sweep to commit</Text>
        </Row>

        <Col style={{
          padding: 24,
          backgroundColor: 'theme:surface',
          borderColor: 'theme:lineSoft',
          borderWidth: 1,
          borderRadius: 12,
          gap: 16,
        }}>
          <ToggleGrid grid={grid} toggle={toggle} />
        </Col>

        <Row style={{ gap: 12, alignItems: 'center' }}>
          <Pressable onPress={() => {}} style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: 'theme:accent',
            borderRadius: 8,
          }}>
            <Icon icon={Play} size={14} color="theme:onAccent" />
            <Text size={12} color="theme:onAccent" bold={true}>Sweep</Text>
          </Pressable>
          <Text size={11} color="theme:inkMuted">animation is the commit ceremony</Text>
        </Row>
      </Col>

      <Col style={{ width: 360, gap: 12 }}>
        <Text size={14} color="theme:ink" bold={true}>Plan (preview)</Text>
        <Box style={{
          flexGrow: 1,
          padding: 16,
          backgroundColor: 'theme:surfaceSubtle',
          borderColor: 'theme:lineSoft',
          borderWidth: 1,
          borderRadius: 8,
        }}>
          <Text size={11} color="theme:ink">{plan}</Text>
        </Box>
        <Text size={10} color="theme:inkMuted">
          structured form is canonical; the prose is rendered from it.
        </Text>
      </Col>
    </Row>
  );
}
