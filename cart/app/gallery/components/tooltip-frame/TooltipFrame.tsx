import { Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, VerticalSpine } from '../controls-specimen/controlsSpecimenParts';
import type { ControlTone } from '../controls-specimen/controlsSpecimenTheme';

export type TooltipFrameProps = {
  children?: any;
  width?: number;
  tone?: ControlTone;
  spine?: string;
};

export function TooltipFrame({ children, width = 336, tone = 'accent', spine = 'TIP' }: TooltipFrameProps) {
  return (
    <Row style={{ alignItems: 'stretch', gap: 0 }}>
      <VerticalSpine label={spine} tone={tone} solid={true} minWidth={30} />
      <AtomFrame width={width} padding={12} gap={10} tone={tone}>
        {children || (
          <>
            <Body fontSize={14} fontWeight="bold">Tooltip frame</Body>
            <Mono fontSize={9} letterSpacing={0.4}>Controls-specimen surface and spine atoms</Mono>
          </>
        )}
      </AtomFrame>
    </Row>
  );
}
