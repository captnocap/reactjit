// Effects gallery — picker for the port of tsz/carts/conformance/mixed/effects.
// Click a tab at the top to switch the active effect.

import { Box, Row, Pressable, Text } from '../../runtime/primitives';
import Plasma from './plasma';
import Rings from './rings';
import Spirograph from './spirograph';
import Topography from './topography';
import CirclePathDebug from './circle_path_debug';
import PaisleyGarden from './paisley_garden';
import PaisleyGlassleaf from './paisley_glassleaf';
const React: any = require('react');
const { useState } = React;

const EFFECTS: { name: string; Component: any }[] = [
  { name: 'plasma', Component: Plasma },
  { name: 'rings', Component: Rings },
  { name: 'spirograph', Component: Spirograph },
  { name: 'topography', Component: Topography },
  { name: 'circle-debug', Component: CirclePathDebug },
  { name: 'paisley-garden', Component: PaisleyGarden },
  { name: 'paisley-glassleaf', Component: PaisleyGlassleaf },
];

export default function EffectsGallery() {
  const [idx, setIdx] = useState(0);
  const Active = EFFECTS[idx].Component;
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}>
      <Row style={{ padding: 8, gap: 6, backgroundColor: '#111111dd', borderBottomWidth: 1, borderColor: '#ffffff18', flexWrap: 'wrap' }}>
        {EFFECTS.map((fx: any, i: number) => (
          <Pressable
            key={fx.name}
            onPress={() => setIdx(i)}
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 999,
              backgroundColor: idx === i ? '#ffffff22' : '#ffffff08',
              borderWidth: 1,
              borderColor: idx === i ? '#ffffff55' : '#ffffff18',
            }}
          >
            <Text color={idx === i ? '#ffffff' : '#bbbbbb'} fontSize={12}>{fx.name}</Text>
          </Pressable>
        ))}
      </Row>
      <Box style={{ flexGrow: 1 }}>
        <Active />
      </Box>
    </Box>
  );
}
