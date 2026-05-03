// Tests route — surfaces every standalone test as a click-to-open
// inline cartridge. Each entry mounts a <Cartridge> pointing at a guest
// bundle pre-built by scripts/build-isolated-tests. The cartridge bundle
// is a fresh module graph (separate IIFE in the same V8), so a test's
// own TooltipRoot, Router, providers, classifiers, and side-effects live
// in their own scope and can't smear into the app shell.
//
// Add a new test:
//   1. Drop a default-export component into cart/app/isolated_tests/
//   2. Run scripts/build-isolated-tests
//   3. Append an entry to TESTS below.

import { useEffect, useState } from 'react';
import { Box, Pressable, Text, ScrollView, Cartridge, Window } from '@reactjit/runtime/primitives';
import { Section } from '../shared';

type TestEntry = {
  id: string;
  label: string;
  width?: number;
  height?: number;
};

const TESTS: TestEntry[] = [
  { id: 'browse-agent',         label: 'Browse Agent' },
  { id: 'chat-loom',            label: 'Chat Loom' },
  { id: 'clipboard_menu_test',  label: 'Clipboard Menu Test' },
  { id: 'composer',             label: 'Composer',         width: 1280, height: 820 },
  { id: 'context_menu_demo',    label: 'Context Menu Demo' },
  { id: 'dictation',            label: 'Dictation' },
  { id: 'embed_lab',            label: 'Embed Lab' },
  { id: 'flow_editor',          label: 'Flow Editor',      width: 1280, height: 820 },
  { id: 'font_lab',             label: 'Font Lab' },
  { id: 'ifttt_test',           label: 'IFTTT Test' },
  { id: 'input_lab',            label: 'Input Lab',        width: 1280, height: 820 },
  { id: 'llm_lab',              label: 'LLM Lab' },
  { id: 'rotate_text',          label: 'Rotate Text' },
  { id: 'scene3d_lab',          label: 'Scene 3D Lab',     width: 1280, height: 820 },
  { id: 'shadow_test',          label: 'Shadow Test' },
  { id: 'tile_drag',            label: 'Tile Drag' },
  { id: 'transparency_test',    label: 'Transparency Test' },
  { id: 'whisper_bench',        label: 'Whisper Bench' },
];

const BUNDLE_DIR = '.cache/isolated_tests';

export default function TestsRoute() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [useWindow, setUseWindow] = useState(true);
  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  // Trace flags — flip both on while debugging the <Window> + <Cartridge>
  // composition. Logs land in the host's stdout/stderr.
  useEffect(() => {
    const g = globalThis as any;
    g.__TRACE_WINDOWS = true;
    g.__TRACE_CARTRIDGE = true;
    console.log('[tests] trace flags enabled (TRACE_WINDOWS, TRACE_CARTRIDGE)');
    return () => {
      g.__TRACE_WINDOWS = false;
      g.__TRACE_CARTRIDGE = false;
    };
  }, []);

  return (
    <Section
      title="Isolated Tests"
      caption="Click a test to open. Toggle the Window/inline switch to compare composition modes — logs land in the host stdout."
    >
      <Box style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
        <Pressable onPress={() => setUseWindow((v) => !v)}>
          <Box style={{
            paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
            borderRadius: 6, borderWidth: 1, borderColor: 'theme:rule',
            backgroundColor: useWindow ? 'theme:accent' : 'theme:bg2',
          }}>
            <Text style={{ fontSize: 11, color: useWindow ? 'theme:onAccent' : 'theme:ink' }}>
              mode: {useWindow ? '<Window><Cartridge>' : 'inline <Cartridge>'}
            </Text>
          </Box>
        </Pressable>
      </Box>
      <ScrollView style={{ width: '100%', maxHeight: 360 }}>
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
          {TESTS.map((t) => {
            const isOpen = !!open[t.id];
            return (
              <Pressable key={t.id} onPress={() => toggle(t.id)}>
                <Box style={{
                  paddingLeft: 12, paddingRight: 12,
                  paddingTop: 8, paddingBottom: 8,
                  borderRadius: 6,
                  backgroundColor: isOpen ? 'theme:accent' : 'theme:bg2',
                  borderWidth: 1,
                  borderColor: isOpen ? 'theme:accent' : 'theme:rule',
                }}>
                  <Text style={{
                    fontSize: 12,
                    color: isOpen ? 'theme:onAccent' : 'theme:ink',
                  }}>
                    {t.label}{isOpen ? ' ●' : ''}
                  </Text>
                </Box>
              </Pressable>
            );
          })}
        </Box>
      </ScrollView>

      {/* Inline mode — cartridge mounts under the panel. Window mode —
          each open test renders inside a <Window>; the inline tile
          shows just a placeholder so we can still see what's open.
          BIGDICKWINDOWHERE: the Window branch is what's currently
          broken; logs from runtime/primitives.tsx + cartridge_loader.ts
          should reveal where the chain falls over. */}
      <Box style={{ flexDirection: 'column', gap: 16, paddingTop: 12 }}>
        {TESTS.filter((t) => open[t.id]).map((t) => (
          <Box
            key={t.id}
            style={{
              borderWidth: 1,
              borderColor: 'theme:rule',
              borderRadius: 8,
              padding: 12,
              minHeight: useWindow ? 60 : 320,
              flexDirection: 'column',
            }}
          >
            <Text style={{ fontSize: 12, color: 'theme:inkDim', marginBottom: 8 }}>
              {t.label} — {BUNDLE_DIR}/{t.id}.cart.js {useWindow ? '(in <Window>)' : '(inline)'}
            </Text>
            {useWindow ? (
              <Window
                title={t.label}
                width={t.width ?? 960}
                height={t.height ?? 720}
                onClose={() => toggle(t.id)}
              >
                <Cartridge src={`${BUNDLE_DIR}/${t.id}.cart.js`} />
              </Window>
            ) : (
              <Cartridge src={`${BUNDLE_DIR}/${t.id}.cart.js`} />
            )}
          </Box>
        ))}
      </Box>
    </Section>
  );
}
