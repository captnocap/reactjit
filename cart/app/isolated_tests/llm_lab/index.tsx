// llm_lab — local text-generation, end-to-end.
//
// What it validates:
//   1. framework/local_ai_runtime.zig dlopen's a LM Studio llama.cpp
//      backend at runtime (default: ROCm; override RJIT_LLM_BACKEND).
//   2. The HIP runtime path coexists with the renderer's Vulkan/wgpu
//      stack — no VkInstance contention, no killed model-load.
//   3. useLocalChat streams tokens back through __localai_poll into
//      a state slot the cart renders live.
//
// Try the picker — both Qwen 3.6 27B (Q4_K_M) and Gemma 4 E4B (Q8_0)
// are on disk and run in LM Studio, so they should both load here.

import { useState } from 'react';
import { Box, Row, Col, Text, Pressable, ScrollView, TextInput } from '@reactjit/runtime/primitives';
import { useLocalChat } from '@reactjit/runtime/hooks/useLocalChat';

interface ModelChoice {
  label: string;
  path: string;
  note: string;
}

const MODELS: ModelChoice[] = [
  {
    label: 'Qwen 3.6 27B (Q4_K_M)',
    path: '/home/siah/.lmstudio/models/lmstudio-community/Qwen3.6-27B-GGUF/Qwen3.6-27B-Q4_K_M.gguf',
    note: '~16 GB VRAM. Runs on the 7900 XTX with ROCm.',
  },
  {
    label: 'Gemma 4 E4B (Q8_0, OBLITERATED)',
    path: '/home/siah/.lmstudio/models/OBLITERATUS/gemma-4-E4B-it-OBLITERATED/gemma-4-E4B-it-OBLITERATED-Q8_0.gguf',
    note: '~5 GB VRAM. Fits on either GPU.',
  },
];

const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#21262d',
  border: '#30363d',
  text: '#e6edf3',
  dim: '#7d8590',
  accent: '#2f81f7',
  good: '#3fb950',
  warn: '#d29922',
  err: '#f85149',
};

export default function LlmLab() {
  const [pickedIdx, setPickedIdx] = useState(1); // gemma is fastest to validate
  const picked = MODELS[pickedIdx];
  const [prompt, setPrompt] = useState('Say something weirdly profound in under 15 words.');
  const [reply, setReply] = useState<string>('');
  const [askMs, setAskMs] = useState<number>(0);
  const [t0, setT0] = useState<number>(0);

  const chat = useLocalChat({
    model: picked.path,
    nCtx: 2048,
    persistAcrossUnmount: true,
  });

  function handleAsk() {
    if (!chat.ready) return;
    setReply('');
    setT0(Date.now());
    chat
      .ask(prompt)
      .then((out) => {
        setReply(out);
        setAskMs(Date.now() - t0);
      })
      .catch((err) => {
        setReply(`error: ${err?.message || err}`);
      });
  }

  const status = chat.error
    ? `error: ${chat.error}`
    : `${chat.phase} · ${chat.lastStatus || '—'} · pulse ${chat.pulse}`;
  const dot = chat.error ? C.err : chat.ready ? C.good : C.warn;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'column' } as any}>
      <Row
        style={{
          backgroundColor: C.surface,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          padding: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        } as any}
      >
        <Col>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: 600 } as any}>LLM Lab</Text>
          <Text style={{ color: C.dim, fontSize: 12 } as any}>
            dlopen'd LM Studio backend · text-gen on GPU without Vulkan contention
          </Text>
        </Col>
        <Row style={{ alignItems: 'center', gap: 8 } as any}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot } as any} />
          <Text style={{ color: C.dim, fontSize: 12 } as any}>{status}</Text>
        </Row>
      </Row>

      <Col style={{ flexGrow: 1, padding: 24, gap: 16 } as any}>
        <Col style={{ gap: 6 } as any}>
          <Text style={{ color: C.dim, fontSize: 12 } as any}>Model</Text>
          <Row style={{ gap: 8, flexWrap: 'wrap' } as any}>
            {MODELS.map((m, i) => {
              const active = i === pickedIdx;
              return (
                <Pressable
                  key={m.path}
                  onPress={() => setPickedIdx(i)}
                  style={{
                    backgroundColor: active ? C.accent : C.surface2,
                    borderWidth: 1,
                    borderColor: active ? C.accent : C.border,
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 8,
                    paddingBottom: 8,
                    borderRadius: 6,
                  } as any}
                >
                  <Text style={{ color: active ? '#fff' : C.text, fontSize: 13, fontWeight: 600 } as any}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
          <Text style={{ color: C.dim, fontSize: 11 } as any}>{picked.note}</Text>
          <Text style={{ color: C.dim, fontSize: 11 } as any}>
            Switching models on a live cart will re-init the session — wait for status to settle.
          </Text>
        </Col>

        <Col style={{ gap: 6 } as any}>
          <Text style={{ color: C.dim, fontSize: 12 } as any}>Prompt</Text>
          <TextInput
            value={prompt}
            onChange={setPrompt}
            style={{
              backgroundColor: C.surface2,
              color: C.text,
              borderWidth: 1,
              borderColor: C.border,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: 13,
              height: 36,
            } as any}
          />
          <Row style={{ gap: 8 } as any}>
            <Pressable
              onPress={handleAsk}
              style={{
                backgroundColor: chat.ready ? C.accent : C.surface,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 6,
              } as any}
            >
              <Text style={{ color: chat.ready ? '#fff' : C.dim, fontSize: 13, fontWeight: 600 } as any}>
                {chat.phase === 'generating' ? 'Generating…' : 'Ask'}
              </Text>
            </Pressable>
            {askMs > 0 ? (
              <Text style={{ color: C.dim, fontSize: 12, alignSelf: 'center' } as any}>
                last reply: {askMs} ms
              </Text>
            ) : null}
          </Row>
        </Col>

        <Col
          style={{
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 8,
            padding: 16,
            gap: 8,
            flexGrow: 1,
            minHeight: 0,
          } as any}
        >
          <Text style={{ color: C.text, fontSize: 13, fontWeight: 600 } as any}>Output</Text>
          <ScrollView style={{ flexGrow: 1, minHeight: 0 } as any}>
            <Text style={{ color: C.text, fontSize: 13 } as any}>
              {chat.phase === 'generating' ? chat.streaming : reply || '(awaiting first ask)'}
            </Text>
          </ScrollView>
        </Col>
      </Col>
    </Box>
  );
}
