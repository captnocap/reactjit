// Isolated Tests panel — surfaces every standalone test as a click-to-open
// native <Window>. Each window is a separate OS window sharing the React
// tree; state flows back into the app, but layout is fully isolated. The
// hidden zero-size container holds the <Window> nodes so they don't eat
// page layout.
//
// Add a new test: drop a default-export component into
// cart/app/isolated_tests/, import it below, and append to TESTS.

import { useState } from 'react';
import { Box, Pressable, Text, ScrollView, Window } from '@reactjit/runtime/primitives';

import BrowseAgent       from '../isolated_tests/browse-agent';
import ChatLoom          from '../isolated_tests/chat-loom';
import ClipboardMenuTest from '../isolated_tests/clipboard_menu_test';
import Composer          from '../isolated_tests/composer';
import ContextMenuDemo   from '../isolated_tests/context_menu_demo';
import Dictation         from '../isolated_tests/dictation';
import FlowEditor        from '../isolated_tests/flow_editor';
import IftttTest         from '../isolated_tests/ifttt_test';
import RotateText        from '../isolated_tests/rotate_text';
import ShadowTest        from '../isolated_tests/shadow_test';
import TileDrag          from '../isolated_tests/tile_drag';
import TransparencyTest  from '../isolated_tests/transparency_test';
import WhisperBench      from '../isolated_tests/whisper_bench';
import EmbedLab          from '../isolated_tests/embed_lab';
import FontLab           from '../isolated_tests/font_lab';
import InputLab          from '../isolated_tests/input_lab';
import LlmLab            from '../isolated_tests/llm_lab';
import Scene3DLab        from '../isolated_tests/scene3d_lab';

type TestEntry = {
  id: string;
  label: string;
  Component: () => any;
  width?: number;
  height?: number;
};

const TESTS: TestEntry[] = [
  { id: 'browse-agent',         label: 'Browse Agent',         Component: BrowseAgent },
  { id: 'chat-loom',            label: 'Chat Loom',            Component: ChatLoom },
  { id: 'clipboard-menu-test',  label: 'Clipboard Menu Test',  Component: ClipboardMenuTest },
  { id: 'composer',             label: 'Composer',             Component: Composer, width: 1280, height: 820 },
  { id: 'context-menu-demo',    label: 'Context Menu Demo',    Component: ContextMenuDemo },
  { id: 'dictation',            label: 'Dictation',            Component: Dictation },
  { id: 'embed-lab',            label: 'Embed Lab',            Component: EmbedLab },
  { id: 'flow-editor',          label: 'Flow Editor',          Component: FlowEditor, width: 1280, height: 820 },
  { id: 'font-lab',             label: 'Font Lab',             Component: FontLab },
  { id: 'ifttt-test',           label: 'IFTTT Test',           Component: IftttTest },
  { id: 'input-lab',            label: 'Input Lab',            Component: InputLab, width: 1280, height: 820 },
  { id: 'llm-lab',              label: 'LLM Lab',              Component: LlmLab },
  { id: 'rotate-text',          label: 'Rotate Text',          Component: RotateText },
  { id: 'scene3d-lab',          label: 'Scene 3D Lab',         Component: Scene3DLab, width: 1280, height: 820 },
  { id: 'shadow-test',          label: 'Shadow Test',          Component: ShadowTest },
  { id: 'tile-drag',            label: 'Tile Drag',            Component: TileDrag },
  { id: 'transparency-test',    label: 'Transparency Test',    Component: TransparencyTest },
  { id: 'whisper-bench',        label: 'Whisper Bench',        Component: WhisperBench },
];

export default function TestsPanel() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  return (
    <Box style={{ flexDirection: 'column', gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: 700, color: 'theme:ink' }}>
        Isolated Tests
      </Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDim' }}>
        Click a test to open it in its own native window.
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

      {/* Zero-size container — holds the live <Window> nodes without
          consuming layout in the about page. */}
      <Box style={{ width: 0, height: 0, overflow: 'hidden' }}>
        {TESTS.filter((t) => open[t.id]).map((t) => {
          const Comp = t.Component;
          return (
            <Window
              key={t.id}
              title={t.label}
              width={t.width ?? 960}
              height={t.height ?? 720}
              onClose={() => toggle(t.id)}
            >
              <Comp />
            </Window>
          );
        })}
      </Box>
    </Box>
  );
}
