// Data route — pick the active backing store (sqlite / pg) and probe.
// Pass-1 scaffold: shows the currently-selected engine. Probe + write
// flow lands pass-2.

import { classifiers as S } from '@reactjit/core';
import { Section } from '../shared';
import { useSettingsCtx } from '../page';

export default function DataRoute() {
  const { user } = useSettingsCtx();
  const engine = user?.database?.engine || '— not set —';
  return (
    <Section caption="Storage" title="Data">
      <S.Card>
        <S.Body>Active engine: {engine}</S.Body>
      </S.Card>
    </Section>
  );
}
