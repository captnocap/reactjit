
import { Text } from '@reactjit/runtime/primitives';
import { exec } from '../../host';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';
import { resolveMarkdownLink } from './useMarkdownAst';

const host: any = globalThis as any;

function shellQuote(value: string): string {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function openExternal(url: string): void {
  const quoted = shellQuote(url);
  const cmd = `xdg-open ${quoted} >/dev/null 2>&1 || open ${quoted} >/dev/null 2>&1 || true`;
  exec(cmd);
}

export function MarkdownLink(props: {
  basePath?: string;
  url: string;
  children: any;
  onOpenPath?: (path: string) => void;
  color?: string;
}) {
  const resolved = resolveMarkdownLink(props.basePath || '', props.url);
  const external = /^(https?:|mailto:|file:|data:)/i.test(resolved);
  const anchor = resolved.startsWith('#');
  const tone = props.color || COLORS.blue;

  const handlePress = () => {
    if (anchor) return;
    if (external) {
      openExternal(resolved);
      return;
    }
    if (props.onOpenPath && resolved) props.onOpenPath(resolved);
  };

  return (
    <HoverPressable onPress={handlePress} style={{ backgroundColor: 'transparent' }} hoverScale={1.01}>
      <Text fontSize={11} color={tone} style={{ textDecorationLine: 'underline' }}>
        {props.children}
      </Text>
    </HoverPressable>
  );
}
