// =============================================================================
// PromptComposer — shared prompt + system prompt + fan-out button
// =============================================================================
// Typed prompt lives on the session so adding a new column mid-edit doesn't
// lose what the user typed. The fan-out button dispatches the prompt to every
// active column in parallel via useFanOut(). Stop-all cancels every live
// stream.
// =============================================================================

import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import {
  setPrompt, setSystemPrompt, setSystemPromptEnabled,
  useLlmStudioSession,
} from './hooks/useLlmStudioSession';
import { fanOut, stopAll } from './hooks/useFanOut';

export function PromptComposer() {
  const s = useLlmStudioSession();
  const anyStreaming = s.columns.some((c) => c.streaming);
  const disabled = s.prompt.trim().length === 0 || s.columns.length === 0;

  return (
    <Col style={{
      gap: 6, padding: 10,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      {/* system prompt row — collapsible */}
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>System prompt</Text>
        <Pressable onPress={() => setSystemPromptEnabled(!s.systemPromptEnabled)} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
          borderRadius: TOKENS.radiusPill, borderWidth: 1,
          borderColor: s.systemPromptEnabled ? COLORS.green : COLORS.border,
          backgroundColor: s.systemPromptEnabled ? COLORS.greenDeep : COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={s.systemPromptEnabled ? COLORS.green : COLORS.textDim} style={{ fontWeight: 'bold' }}>
            {s.systemPromptEnabled ? 'ON — sent with every fan-out' : 'OFF — not sent'}
          </Text>
        </Pressable>
      </Row>
      {s.systemPromptEnabled ? (
        <TextInput
          value={s.systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="You are a helpful assistant."
          multiline={true as any}
          style={{
            minHeight: 40, padding: 6,
            borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
            backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
          }}
        />
      ) : null}

      {/* user prompt */}
      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Prompt</Text>
      <TextInput
        value={s.prompt}
        onChangeText={setPrompt}
        placeholder="Ask all active columns…"
        multiline={true as any}
        style={{
          minHeight: 60, padding: 8,
          borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
          backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
        }}
      />

      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pressable onPress={() => { if (!disabled) { fanOut(s.prompt); } }} style={{
          paddingLeft: 14, paddingRight: 14, paddingTop: 6, paddingBottom: 6,
          borderRadius: TOKENS.radiusSm, borderWidth: 1,
          borderColor: disabled ? COLORS.border : COLORS.blue,
          backgroundColor: disabled ? COLORS.panelAlt : COLORS.blueDeep,
        }}>
          <Text fontSize={11} color={disabled ? COLORS.textDim : COLORS.blue} style={{ fontWeight: 'bold' }}>
            Fan-out → {s.columns.length} column{s.columns.length === 1 ? '' : 's'}
          </Text>
        </Pressable>
        {anyStreaming ? (
          <Pressable onPress={stopAll} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
            borderRadius: TOKENS.radiusSm, borderWidth: 1,
            borderColor: COLORS.red, backgroundColor: COLORS.redDeep,
          }}>
            <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>stop all</Text>
          </Pressable>
        ) : null}
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          {s.prompt.length} chars · ~{Math.ceil(s.prompt.length / 4)} tok est
        </Text>
      </Row>
    </Col>
  );
}
