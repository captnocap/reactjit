// User route — identity + accommodations.
// Pass-1 scaffold: shows what loaded; full forms land in pass-2.

import { classifiers as S } from '@reactjit/core';
import { Section } from '../shared';
import { useSettingsCtx } from '../page';

export default function UserRoute() {
  const { user } = useSettingsCtx();
  return (
    <Section caption="Account" title="User">
      <S.Card>
        <S.Body>
          {user ? `Loaded: ${user.displayName || user.email || '(unnamed)'}` : 'No user row yet.'}
        </S.Body>
      </S.Card>
    </Section>
  );
}
