import { Box } from '../../../../runtime/primitives';
import { MaskLayer } from './MaskLayer';
import { SourceFrame } from './SourceFrame';
import type { MaskStackItem } from './maskCatalog';
import type { MediaItem } from '../media/useMediaStore';

export function stageSize(item: MediaItem | null): { width: number; height: number } {
  const w = 760;
  if (!item) return { width: w, height: 420 };
  const ratio = item.width > 0 ? item.height / item.width : 0.66;
  const h = Math.round(w * ratio);
  return { width: w, height: Math.max(280, Math.min(460, h)) };
}

export function buildStackPreview(item: MediaItem | null, width: number, height: number, time: number, stack: MaskStackItem[]) {
  if (!item) return null;
  let content: any = (
    <Box style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <SourceFrame item={item} />
    </Box>
  );
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const entry = stack[i];
    if (!entry.enabled) continue;
    content = (
      <MaskLayer key={entry.id} mask={entry.maskId} width={width} height={height} time={time} {...entry.params}>
        {content}
      </MaskLayer>
    );
  }
  return content;
}
