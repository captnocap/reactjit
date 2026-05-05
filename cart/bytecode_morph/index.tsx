// filter_morph — Filter intensity as animation. Two patterns:
//   1. Boot fade-in: app starts at intensity=1, eases to 0 (one-time)
//   2. List swap:    switching tabs pixelates ONLY the list, swaps content,
//                    eases back. The text scrambles via the pixelate shader.
//
// IMPORTANT: nested <Filter> doesn't currently work — the inner filter's
// primitives go to a separate offscreen texture, so the outer filter's
// capture sees empty space where the inner filter is. To avoid nesting:
// the outer (boot) Filter is rendered conditionally, and only while its
// intensity > 0. The inner (list) Filter is rendered only while ITS
// intensity > 0. They never overlap.
import { useEffect, useRef, useState } from 'react';
import { Box, Col, Filter, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { installBrowserShims } from '@reactjit/runtime/hooks';

installBrowserShims();

const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);
const EASE_IN_OUT_CUBIC = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// setTimeout-based tween — runtime has no requestAnimationFrame.
function tween(
  setter: (n: number) => void,
  from: number,
  to: number,
  ms: number,
  easing: (t: number) => number = EASE_OUT_CUBIC,
  onDone?: () => void,
) {
  const start = Date.now();
  let stopped = false;
  let timer: any = 0;
  const step = () => {
    if (stopped) return;
    const elapsed = Date.now() - start;
    const t = Math.min(1, elapsed / ms);
    setter(from + (to - from) * easing(t));
    if (t < 1) timer = setTimeout(step, 16);
    else onDone?.();
  };
  timer = setTimeout(step, 0);
  return () => { stopped = true; clearTimeout(timer); };
}

const MENUS = {
  Tools: ['Hammer', 'Screwdriver', 'Wrench', 'Pliers', 'Level'],
  Items: ['Rope', 'Lantern', 'Map', 'Compass', 'Canteen'],
  Spells: ['Fireball', 'Heal', 'Shield', 'Lightning', 'Frost'],
};
type MenuKey = keyof typeof MENUS;

export default function BytecodeMorph() {
  const [bootK, setBootK] = useState(1);   // global boot fade
  const [listK, setListK] = useState(0);   // list-scoped menu swap
  const [menu, setMenu] = useState<MenuKey>('Tools');
  const [selected, setSelected] = useState<number | null>(null);

  // Slow durations are intentional — bytecode intensity drives a visible
  // top-to-bottom scan, not a uniform fade. You're meant to watch the
  // decode sweep.
  useEffect(() => {
    return tween(setBootK, 1, 0, 1500, EASE_IN_OUT_CUBIC);
  }, []);

  const swapMenu = (next: MenuKey) => {
    if (next === menu) return;
    tween(setListK, 0, 1, 600, EASE_IN_OUT_CUBIC, () => {
      setMenu(next);
      setSelected(null);
      tween(setListK, 1, 0, 900, EASE_OUT_CUBIC);
    });
  };

  const items = MENUS[menu];
  const bootActive = bootK > 0.001;
  const listActive = listK > 0.001;

  // The list — pixelated only when listActive, never nested under boot.
  const listContent = (
    <Col style={{ gap: 6, width: '100%' }}>
      {items.map((label, i) => {
        const isSel = selected === i;
        return (
          <Pressable key={`${menu}-${i}`} onPress={() => setSelected(i)}>
            <Box style={{
              paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12,
              borderRadius: 6,
              backgroundColor: isSel ? '#1f3a4a' : '#14100d',
              borderWidth: 1,
              borderColor: isSel ? '#3b7da0' : '#1a1511',
            }}>
              <Text style={{
                fontSize: 15,
                fontWeight: isSel ? 700 : 500,
                color: isSel ? '#9fd1eb' : '#e8dcc4',
              }}>{label}</Text>
            </Box>
          </Pressable>
        );
      })}
    </Col>
  );
  const list = listActive ? (
    <Filter shader="bytecode" intensity={listK} style={{ width: '100%' }}>
      {listContent}
    </Filter>
  ) : listContent;

  const body = (
    <Box style={{
      width: '100%', height: '100%',
      backgroundColor: '#0e0b09',
      padding: 32, gap: 24,
    }}>
      <Text style={{ fontSize: 28, fontWeight: 700, color: '#e8dcc4' }}>
        Filter Morph
      </Text>
      <Text style={{ fontSize: 13, color: '#a89880', marginBottom: 8 }}>
        Click a tab — the list decodes into bytes, swaps content, then decodes back.
      </Text>

      <Row style={{ gap: 8 }}>
        {(Object.keys(MENUS) as MenuKey[]).map((k) => (
          <Pressable key={k} onPress={() => swapMenu(k)}>
            <Box style={{
              paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
              borderRadius: 6,
              backgroundColor: k === menu ? '#d26a2a' : '#1a1511',
              borderWidth: 1,
              borderColor: k === menu ? '#e8501c' : '#2a1f14',
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: 700,
                color: k === menu ? '#0e0b09' : '#a89880',
              }}>{k}</Text>
            </Box>
          </Pressable>
        ))}
      </Row>

      {list}
    </Box>
  );

  // Boot phase: outer Filter wraps everything. listActive is forced false
  // by bootK starting at 1 (no clicks yet), so no nesting risk.
  return bootActive ? (
    <Filter shader="bytecode" intensity={bootK} style={{ width: '100%', height: '100%' }}>
      {body}
    </Filter>
  ) : body;
}
