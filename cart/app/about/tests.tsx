// Isolated Tests panel — surfaces every standalone test as a click-to-open
// native <Window>. Each window mounts a <Cartridge> pointing at a guest
// bundle pre-built by scripts/build-isolated-tests. The cartridge bundle
// is a fresh module graph (separate IIFE in the same V8), so a test's
// own TooltipRoot, Router, providers, classifiers, and side-effects live
// in their own scope and can't smear into the app shell. Close the
// window — gone.
//
// Add a new test:
//   1. Drop a default-export component into cart/app/isolated_tests/
//   2. Run scripts/build-isolated-tests
//   3. Append an entry to TESTS below.

import { useState } from 'react';
import { Box, Pressable, Text, ScrollView, Window, Cartridge } from '@reactjit/runtime/primitives';

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

export default function TestsPanel() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  return (
    <Box style={{ flexDirection: 'column', gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: 700, color: 'theme:ink' }}>
        Isolated Tests
      </Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDim' }}>
        Click a test to open it in its own native window. Each runs from a
        cartridge bundle (rebuild with scripts/build-isolated-tests).
      </Text>

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

      {/* BIGDICKWINDOWHERE — restore the <Window> wrapper around <Cartridge>
          once the Window primitive bug is sorted. Inline mount confirmed
          cartridges load fine on their own; the failure was Window-side. */}
      <Box style={{ flexDirection: 'column', gap: 16, paddingTop: 12 }}>
        {TESTS.filter((t) => open[t.id]).map((t) => (
          <Box
            key={t.id}
            style={{
              borderWidth: 1,
              borderColor: 'theme:rule',
              borderRadius: 8,
              padding: 12,
              minHeight: 320,
              flexDirection: 'column',
            }}
          >
            <Text style={{ fontSize: 12, color: 'theme:inkDim', marginBottom: 8 }}>
              {t.label} — {BUNDLE_DIR}/{t.id}.cart.js
            </Text>
            <Cartridge src={`${BUNDLE_DIR}/${t.id}.cart.js`} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
