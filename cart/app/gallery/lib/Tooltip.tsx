import { Tooltip as SharedTooltip, type TooltipAnchor, type TooltipRow } from '@reactjit/runtime/tooltip/Tooltip';

export type { TooltipRow };

export function Tooltip(props: {
  visible: boolean;
  x?: number;
  y?: number;
  anchor?: TooltipAnchor;
  title?: string;
  rows: TooltipRow[];
}) {
  return (
    <SharedTooltip
      visible={props.visible}
      anchor={props.anchor || { kind: 'cursor' }}
      title={props.title}
      rows={props.rows}
      variant="..-chart"
      staticSurfaceOverlay
    />
  );
}
