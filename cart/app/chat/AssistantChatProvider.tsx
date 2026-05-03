// AssistantChatProvider — invisible coordinator that mounts the
// chat-generation hook and publishes its `ask` to the module-level
// askAssistant() in cart/app/chat/store.ts.
//
// Why a separate component instead of mounting the hook inside
// <AssistantChat>? The chat panel re-mounts when the GOLDEN morph
// swaps slots (rail vs activity area). If the generation hook lived
// there, every morph would tear down and re-spawn the Claude
// subprocess. Mounting one level up — inside ShellBody, alongside
// <NavigationBus> — keeps the session alive across the morph.
//
// The provider also wraps the hook's bare `ask(text, onPart)` with the
// transcript-orchestration: append a user turn, append an empty asst
// turn, mutate the asst turn body as parts stream in, finalize on
// resolve / reject. Call sites (e.g. InputStrip.submit()) only have to
// call `askAssistant(text)` from the store.

import { useEffect, useRef } from 'react';
import { useRoute } from '@reactjit/runtime/router';
import { useAssistantChat } from './useAssistantChat';
import { appendTurn, nextTurnId, setAsker, setChatStatus, updateTurnBody } from './store';

function nowHHMMSS(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function AssistantChatProvider() {
  const chat = useAssistantChat();
  const route = useRoute();

  // Live route ref so the asker closure (mounted via setAsker once)
  // can read the *current* path at submit time, not the path that was
  // captured the first time setAsker ran.
  const routeRef = useRef<string>(route.path);
  routeRef.current = route.path;

  // Last route the assistant was told about. Compare on each ask:
  //   - first ask of the session → prepend "User is on route X"
  //   - route differs from last sent → prepend "User has moved to route X"
  //   - same route as last sent → no prefix
  // The transcript shows the user's typed text only; the prefix is
  // sent to Claude as a [system-style] note so it stays oriented
  // without polluting the chat surface.
  const lastSentRouteRef = useRef<string | null>(null);

  // Publish hook state to the chat-status store so AssistantChat's
  // header can render live phase/status/error. Without this, every
  // failure path (no bindings, spawn fail, model not yet loaded)
  // looks identical to the user — empty asst turn, no signal.
  useEffect(() => {
    setChatStatus({
      phase: chat.phase,
      lastStatus: chat.lastStatus || '',
      error: chat.error || null,
    });
  }, [chat.phase, chat.lastStatus, chat.error]);

  useEffect(() => {
    const orchestratedAsk = async (text: string): Promise<string> => {
      const ts = nowHHMMSS();
      const userId = nextTurnId('u');
      const asstId = nextTurnId('a');

      appendTurn({
        id: userId,
        author: 'user',
        timestamp: ts,
        body: text,
      });
      appendTurn({
        id: asstId,
        author: 'asst',
        timestamp: ts,
        body: '',
      });

      // Build the actual prompt sent to Claude — prepend a route note
      // when this is the first send or the route has changed since the
      // last send. The transcript turn (above) renders only `text` so
      // the user sees what they typed; Claude sees the route context.
      const currentRoute = routeRef.current;
      let routeNote = '';
      if (lastSentRouteRef.current === null) {
        routeNote = `[Context: User is on route ${currentRoute}.]\n\n`;
      } else if (lastSentRouteRef.current !== currentRoute) {
        routeNote = `[Context: User has moved from ${lastSentRouteRef.current} to ${currentRoute}.]\n\n`;
      }
      lastSentRouteRef.current = currentRoute;
      const promptForClaude = routeNote + text;

      try {
        // Trim only LEADING whitespace — some models emit a leading
        // space as their first token (tokenizer artifact, especially
        // BPE-style tokenizers) which renders as a visible indent
        // because the chat row's first character is the body. We
        // preserve trailing whitespace in case the model is mid-word.
        const stripLeading = (s: string) => s.replace(/^[ \t]+/, '');
        const final = await chat.ask(promptForClaude, {
          onPart: (partial) => updateTurnBody(asstId, stripLeading(partial)),
        });
        if (final && final.length > 0) updateTurnBody(asstId, stripLeading(final));
        return final;
      } catch (err: any) {
        const msg = err && err.message ? err.message : String(err);
        updateTurnBody(asstId, `[error] ${msg}`);
        throw err;
      }
    };

    setAsker(orchestratedAsk);
    return () => { setAsker(null); };
  }, [chat.ask]);

  return null;
}
