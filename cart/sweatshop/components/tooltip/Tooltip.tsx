
import { Box } from '../../../../runtime/primitives';
import { useHover } from '../../anim';
import { TooltipContext } from './TooltipLayer';
import type { TooltipRect } from './useAutoFlip';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export function Tooltip(props: {
  label: string;
  markdown?: boolean;
  side?: TooltipSide;
  delayMs?: number;
  disabled?: boolean;
  shortcut?: string;
  children: any;
}) {
  const ctx = useContext(TooltipContext);
  const [hoverHandlers, hovered] = useHover();
  const [anchor, setAnchor] = useState<TooltipRect | null>(null);
  const tokenRef = useRef<number | null>(null);
  const side = props.side || 'top';
  const delayMs = props.delayMs ?? 500;
  const shortcut = props.shortcut;

  useEffect(() => {
    if (!ctx || props.disabled || !hovered || !anchor) {
      if (tokenRef.current != null) ctx?.hide(tokenRef.current);
      tokenRef.current = null;
      return;
    }
    const timer = setTimeout(() => {
      tokenRef.current = ctx.show({ label: props.label, markdown: props.markdown, shortcut, side, anchor });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [anchor, ctx, delayMs, hovered, props.disabled, props.label, props.markdown, shortcut, side]);

  useEffect(() => {
    if (!hovered && tokenRef.current != null) {
      ctx?.hide(tokenRef.current);
      tokenRef.current = null;
    }
  }, [ctx, hovered]);

  if (props.disabled) return props.children;

  return (
    <Box
      {...hoverHandlers}
      onLayout={(rect: any) => setAnchor(rect)}
      style={{ position: 'relative', display: 'flex', overflow: 'visible' }}
    >
      {props.children}
    </Box>
  );
}
