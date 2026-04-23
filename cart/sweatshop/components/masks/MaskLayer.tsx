const React: any = require('react');
const { Children } = React;

import { Box } from '../../../../runtime/primitives';
import { renderMaskEffect, type MaskKind } from './maskEffects';

export function MaskLayer(props: {
  mask: MaskKind;
  width: number;
  height: number;
  time?: number;
  style?: any;
  children: any;
  [key: string]: any;
}) {
  const { mask, width, height, time = Date.now(), style = {}, children, ...rest } = props;
  const child = Children.only(children);
  const effect = renderMaskEffect(mask, { width, height, time, children: child, ...rest }, child);
  const base = React.cloneElement(child, {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      ...(child.props?.style || {}),
    },
  });
  return (
    <Box style={{ position: 'relative', width, height, overflow: 'hidden', ...style }}>
      {effect.underlay}
      {base}
      {effect.overlay}
    </Box>
  );
}

export default MaskLayer;

