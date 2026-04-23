const React: any = require('react');
const { useCallback } = React;

import { Box, Effect } from '../../../../runtime/primitives';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../../lib/emulator/ppu';
import type { Bus } from '../../lib/emulator/bus';

export function EmulatorScreen(props: {
  busRef: React.MutableRefObject<Bus | null>;
  tick: (dt: number) => boolean;
  scale: number;
  style?: any;
}) {
  const { busRef, tick, scale, style } = props;

  const width = SCREEN_WIDTH * scale;
  const height = SCREEN_HEIGHT * scale;

  const onRender = useCallback((e: any) => {
    const bus = busRef.current;
    if (!bus) {
      e.clearColor(0, 0, 0, 1);
      return;
    }

    tick(e.dt);

    const fb = bus.ppu.framebuffer;
    e.clearColor(0, 0, 0, 1);

    if (scale === 1) {
      for (let y = 0; y < SCREEN_HEIGHT; y++) {
        for (let x = 0; x < SCREEN_WIDTH; x++) {
          const i = (y * SCREEN_WIDTH + x) * 4;
          e.setPixelRaw(x, y, fb[i], fb[i + 1], fb[i + 2], fb[i + 3]);
        }
      }
    } else {
      for (let y = 0; y < SCREEN_HEIGHT; y++) {
        for (let x = 0; x < SCREEN_WIDTH; x++) {
          const i = (y * SCREEN_WIDTH + x) * 4;
          const r = fb[i];
          const g = fb[i + 1];
          const b = fb[i + 2];
          const a = fb[i + 3];
          const dx = x * scale;
          const dy = y * scale;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              e.setPixelRaw(dx + sx, dy + sy, r, g, b, a);
            }
          }
        }
      }
    }
  }, [busRef, tick, scale]);

  return (
    <Box style={{ width, height, ...style }}>
      <Effect onRender={onRender} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
}
