import { Box, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

function crumbParts(path: string): string[] {
  const clean = String(path || '').replace(/^\.\//, '').replace(/\/+/g, '/');
  if (!clean) return ['.'];
  return clean.split('/').filter(Boolean);
}

export function DocsBreadcrumbs(props: { path: string }) {
  const parts = crumbParts(props.path);
  return (
    <Row style={{ alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, flexWrap: 'wrap' }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold', letterSpacing: 1 }}>BREADCRUMBS</Text>
      <Box style={{ width: 1, height: 12, backgroundColor: COLORS.borderSoft, marginLeft: 6, marginRight: 6 }} />
      {parts.map((part, index) => {
        const active = index === parts.length - 1;
        return (
          <Row key={`${part}-${index}`} style={{ alignItems: 'center', gap: 4 }}>
            {index > 0 ? <Text fontSize={9} color={COLORS.textDim}>/</Text> : null}
            <Text fontSize={10} color={active ? COLORS.textBright : COLORS.textDim} style={{ fontWeight: active ? 'bold' : 'normal', fontFamily: TOKENS.fontMono }}>
              {part}
            </Text>
          </Row>
        );
      })}
    </Row>
  );
}

export default DocsBreadcrumbs;
