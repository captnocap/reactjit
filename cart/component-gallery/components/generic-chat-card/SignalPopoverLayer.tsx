import { Box } from '../../../../runtime/primitives';
import { TripwireMenu, type SignalAnchor } from './TripwireMenu';

export function SignalPopoverLayer({
  anchor,
  selected,
  viewport,
}: {
  anchor: SignalAnchor;
  selected: string;
  viewport: { x: number; y: number; width: number; height: number };
}) {
  if (!anchor || !viewport) return null;
  const menuWidth = 194;
  const menuHeight = 136;
  const gap = 10;
  const localX = anchor.x - viewport.x;
  const localY = anchor.y - viewport.y;
  const preferBelow = localY < viewport.height * 0.45;
  const left = Math.max(8, Math.min(localX + anchor.width / 2 - menuWidth / 2, viewport.width - menuWidth - 8));
  const top = preferBelow
    ? Math.min(localY + anchor.height + gap, viewport.height - menuHeight - 8)
    : Math.max(8, localY - menuHeight - gap);
  const arrowLeft = Math.max(16, Math.min(localX + anchor.width / 2 - left - 5, menuWidth - 16));
  const arrowTop = preferBelow ? -5 : menuHeight - 5;

  return (
    <Box style={{ position: 'absolute', left, top, zIndex: 100, overflow: 'visible' }}>
      <Box
        style={{
          position: 'absolute',
          left: arrowLeft,
          top: arrowTop,
          width: 10,
          height: 10,
          backgroundColor: '#1d1b27',
          borderLeftWidth: 1,
          borderTopWidth: 1,
          borderColor: '#c55adb',
          transform: { rotate: 45 },
        }}
      />
      <TripwireMenu selected={selected} />
    </Box>
  );
}
