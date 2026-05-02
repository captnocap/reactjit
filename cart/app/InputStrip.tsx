// Persistent supervisor-input strip — pinned to the bottom of the app
// chrome once onboarding completes. Visually a CommandComposer (gallery
// shape: route/target chips up top, prompt area + action rail in the
// middle, branch chip + shortcut hints in the footer). The static prompt
// segments are swapped for a live <TextInput> so the surface is actually
// editable; the rest of the composer is the gallery's components/styling
// verbatim.
//
// Today: tier-1 only. Submit parses @-tokens against `tokens.ts` and
// fires `app:navigate` on the IFTTT bus for each route token. Anything
// else is dropped — the router-model + supervisor-session wiring lands
// in follow-up commits, and will plug into the same `submit()` path.

import { useState, useRef } from 'react';
import { TextInput } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { useRoute } from '@reactjit/runtime/router';
import { useBreakpoint } from '@reactjit/runtime/theme';
import { busEmit } from '@reactjit/runtime/hooks/useIFTTT';
import { CommandComposerHeader } from '../component-gallery/components/command-composer/CommandComposerHeader';
import { CommandComposerFooter } from '../component-gallery/components/command-composer/CommandComposerFooter';
import { CommandComposerChip } from '../component-gallery/components/command-composer/CommandComposerChip';
import type {
  CommandComposer,
  CommandComposerChip as CommandComposerChipData,
} from '../component-gallery/data/command-composer';
import { resolveTokens, TokenMatch } from './tokens';
import { askAssistant } from './chat/store';

// Static envelope — none of these change per-keystroke. When the router
// model lands, `route` swaps to the live model name; `target` swaps to
// whichever app currently owns focus.
const ROUTE_CHIP: CommandComposerChipData = {
  id: 'route', prefix: '@', label: 'tier-1 only', tone: 'muted',
};
const TARGET_CHIP: CommandComposerChipData = {
  id: 'target', prefix: '+', label: 'nav', tone: 'muted',
};
const LEFT_SHORTCUTS = [
  { id: 'tag-file', key: '@', label: 'tag file' },
  { id: 'variable', key: '{}', label: 'variable' },
  { id: 'command', key: '/', label: 'command' },
];
const EXECUTE_SHORTCUT = {
  id: 'execute', key: '⌘', secondaryKey: 'enter', joiner: '+', label: 'execute',
};

function tokenToChip(m: TokenMatch): CommandComposerChipData {
  return {
    id: `chip:${m.raw}`,
    prefix: '@',
    label: m.token.label,
    tone: 'accent',
  };
}

export function InputStrip() {
  const route = useRoute();
  const bp = useBreakpoint();
  // At `sm` the composer drops its routing/attached header and shortcut
  // footer — those are secondary affordances (model identity, hint legend)
  // that just describe the space. The required surface is the prompt
  // input + send rail; everything else tucks away.
  const compact = bp === 'sm';
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  draftRef.current = draft;

  const matches = resolveTokens(draft);

  const submit = () => {
    const text = draftRef.current.trim();
    if (!text) return;
    const tokens = resolveTokens(text);
    for (const m of tokens) {
      if (m.token.type === 'route') busEmit('app:navigate', m.token.path);
    }
    // Fire the chat — fire-and-forget so the input clears immediately.
    // The provider tracks the user/asst turn pair through to streamed
    // resolution; errors land on the asst turn body and don't bubble
    // here. See cart/app/chat/AssistantChatProvider.tsx.
    void askAssistant(text).catch(() => {
      /* asst turn carries the [error] string */
    });
    setDraft('');
    draftRef.current = '';
  };

  const branchChip: CommandComposerChipData = {
    id: 'branch', prefix: '⌁', label: route.path, tone: 'success',
  };

  // Build a CommandComposer row for the gallery's Header / Footer to
  // consume. The middle section is composed manually below so we can
  // host a live <TextInput>; `prompt` here is a no-op slot.
  const row: CommandComposer = {
    id: 'app-input-strip',
    routingLabel: 'ROUTING',
    route: ROUTE_CHIP,
    target: TARGET_CHIP,
    attachLabel: 'ATTACHED',
    attachments: [],
    prompt: [],
    branch: branchChip,
    leftShortcuts: LEFT_SHORTCUTS,
    executeShortcut: EXECUTE_SHORTCUT,
    modeGlyph: '¶',
    sendLabel: 'SEND',
  };

  return (
    <S.CommandComposerFrame>
      {compact ? null : <CommandComposerHeader row={row} />}

      <S.CommandComposerMain>
        <S.CommandComposerPromptRows>
          {matches.length > 0 ? (
            <S.CommandComposerPromptFlow>
              {matches.map((m) => (
                <CommandComposerChip key={m.raw} chip={tokenToChip(m)} />
              ))}
            </S.CommandComposerPromptFlow>
          ) : null}
          <S.CommandComposerPromptFlow>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmit={submit}
              placeholder="Ask, or @-mention a place to open…"
              style={{
                flexGrow: 1, flexBasis: 0,
                minHeight: 24,
                fontSize: 14,
                color: 'theme:ink',
                backgroundColor: 'transparent',
                borderWidth: 0,
              }}
            />
          </S.CommandComposerPromptFlow>
        </S.CommandComposerPromptRows>

        <S.CommandComposerActionRow>
          <CommandComposerChip chip={branchChip} />
          <S.CommandComposerShortcutGroup>
            <S.CommandComposerIconButton>
              <S.CommandComposerIconText>{row.modeGlyph}</S.CommandComposerIconText>
            </S.CommandComposerIconButton>
            <S.CommandComposerSend onPress={submit}>
              <S.CommandComposerActionText>{row.sendLabel}</S.CommandComposerActionText>
            </S.CommandComposerSend>
          </S.CommandComposerShortcutGroup>
        </S.CommandComposerActionRow>
      </S.CommandComposerMain>

      {compact ? null : <CommandComposerFooter row={row} />}
    </S.CommandComposerFrame>
  );
}
