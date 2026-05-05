
import { Pressable } from '@reactjit/runtime/primitives';
import { Tooltip } from '../tooltip';

export interface StatusSegmentProps {
  onPress?: () => void;
  tooltip?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: any;
}

export function StatusSegment(props: StatusSegmentProps) {
  const content = (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 2,
        paddingBottom: 2,
        borderRadius: 4,
        position: 'relative',
        backgroundColor: 'transparent',
      }}
    >
      {props.children}
    </Pressable>
  );

  if (!props.tooltip) return content;
  return (
    <Tooltip label={props.tooltip} side={props.side || 'top'}>
      {content}
    </Tooltip>
  );
}
