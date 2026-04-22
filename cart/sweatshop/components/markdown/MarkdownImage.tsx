const React: any = require('react');
const { useEffect, useState } = React;

import { Box, Col, Image, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export function MarkdownImage(props: { alt: string; src: string; width?: number; maxWidth?: number }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const timer = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(timer);
  }, [props.src]);

  return (
    <Col style={{ gap: 4, maxWidth: props.maxWidth || '100%' }}>
      <Box style={{ minHeight: 160, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        {loaded ? (
          <Image
            source={props.src}
            style={{ width: props.width || '100%', maxWidth: props.maxWidth || '100%', minHeight: 160 }}
          />
        ) : (
          <Text fontSize={10} color={COLORS.textDim}>Loading image…</Text>
        )}
      </Box>
      {props.alt ? <Text fontSize={9} color={COLORS.textDim}>{props.alt}</Text> : null}
    </Col>
  );
}
