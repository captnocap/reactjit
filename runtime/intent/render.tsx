/**
 * Public renderer entry. Thin alias over the component-gallery's
 * IntentSurface so callers (cart/chat-loom and friends) don't need to
 * reach into the gallery directory directly.
 */
import type { Node } from './parser';
import { IntentSurface } from '../../cart/app/gallery/components/intent-surface/IntentSurface';

interface RenderProps {
  nodes: Node[];
  onAction: (reply: string) => void;
}

export function RenderIntent({ nodes, onAction }: RenderProps) {
  return <IntentSurface nodes={nodes} onAction={onAction} />;
}
