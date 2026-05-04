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
import { parseIntent, type Node } from '@reactjit/runtime/intent/parser';
import { useAssistantChat } from './useAssistantChat';
import { appendTurn, nextTurnId, setAsker, setChatStatus, updateTurnBody, updateTurnSurface } from './store';

// Loom system prompt — teaches the model the tag DSL the persistent
// chat parses with `parseIntent`. Always-on for v1; promoted to a
// settings toggle once we've confirmed it works across both Claude
// and local-runtime backends. Mirrors the prompt the chat-loom probe
// cart used (cart/testing_carts/chat-loom.tsx) but lives here because
// the persistent chat is now the only place loom rendering ships.
const LOOM_SYSTEM_PROMPT = `You respond to the user with an interactive chat surface, not prose.

Wrap your entire response in [ ... ]. Inside, compose a small tree from these tags ONLY:

  <Title>large heading text</Title>
  <Text>body paragraph text</Text>
  <Card>group related content in a padded surface</Card>
  <Row>arrange children horizontally</Row>
  <Col>arrange children vertically</Col>
  <List>one item per line</List>
  <Btn reply="what to send back when clicked">label shown to user</Btn>

Display tags (use freely to make the surface read like a real UI):

  <Badge tone=success>label</Badge>     // tones: neutral, success, warning, error, info — bare word, no quotes
  <Code lang=ts>...code text...</Code>  // formatted code block; lang is bare
  <Divider />                           // horizontal separator inside a Col
  <Kbd>Cmd+S</Kbd>                      // inline keyboard chip
  <Spacer size=md />                    // vertical/horizontal gap; size: sm, md, lg

Forms (use when collecting structured input):

  <Form>
    <Field name="fieldKey" label="Label shown above" placeholder="hint text" />
    <Field name="another" label="..." />
    <Submit reply="message template with {fieldKey} interpolation">Submit label</Submit>
  </Form>

Rules:
- Always wrap output in [ ... ].
- Use <Btn> for single-choice picks. Use <Form> when you need multiple values.
- A <Submit>'s reply attribute is a template — every {fieldKey} is replaced with that field's current value. Always use this so you control the format.
- The user will reply with the interpolated string. When you receive a form submission, respond with a confirmation card showing what was received.
- Plain text outside any tag is allowed for short prose.
- No other tags. No HTML. No markdown.`;

function hasIntentTags(nodes: Node[]): boolean {
  return nodes.some((n) => n.kind !== 'text');
}

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

  // First-ever send of this provider's lifetime — used to prepend the
  // loom system prompt exactly once. Neither useClaudeChat nor
  // useLocalChat exposes a system-prompt knob, so the prompt rides on
  // the first user message (matches the pattern in cart/browse-agent.tsx).
  const loomPromptSentRef = useRef(false);

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

      // Prepend the loom system prompt on the very first send. Backend
      // hooks have no system-prompt parameter; this is the only seam.
      let loomPrelude = '';
      if (!loomPromptSentRef.current) {
        loomPrelude = `${LOOM_SYSTEM_PROMPT}\n\n`;
        loomPromptSentRef.current = true;
      }

      const promptForClaude = loomPrelude + routeNote + text;

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
        const finalText = final && final.length > 0 ? stripLeading(final) : '';
        if (finalText) updateTurnBody(asstId, finalText);

        // Loom always-on: try to parse the finalized reply. If the
        // model emitted any non-text tags, attach an intent surface
        // and clear the body (the raw `[<Title>...]` text would
        // otherwise render alongside the rendered card). If parsing
        // yields only text nodes, leave the prose body alone.
        if (finalText) {
          try {
            const nodes = parseIntent(finalText);
            if (hasIntentTags(nodes)) {
              updateTurnSurface(asstId, { kind: 'intent', nodes });
              updateTurnBody(asstId, '');
            }
          } catch { /* parse failure → leave prose body in place */ }
        }
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
