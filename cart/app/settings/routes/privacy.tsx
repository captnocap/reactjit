// Privacy route — proxy, tools allowlist, filesystem allowlist.
// Pass-1 scaffold; full editors land pass-2.

import { classifiers as S } from '@reactjit/core';
import { Box } from '@reactjit/runtime/primitives';
import { Section } from '../shared';
import { useSettingsCtx } from '../page';

export default function PrivacyRoute() {
  const { privacy } = useSettingsCtx();
  const fsCount     = privacy?.filesystem?.allow?.length || 0;
  const toolCount   = privacy?.tools?.allow?.length || 0;
  const proxy       = privacy?.network?.proxy || '— direct —';
  return (
    <Section caption="Boundaries" title="Privacy">
      <S.Card>
        <Box style={{ flexDirection: 'column', gap: 6 }}>
          <S.Body>Proxy: {proxy}</S.Body>
          <S.Body>Tools allowed: {toolCount}</S.Body>
          <S.Body>Filesystem paths allowed: {fsCount}</S.Body>
        </Box>
      </S.Card>
    </Section>
  );
}
