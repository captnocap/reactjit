// Test cart A — load a big file via React state.
//
// Click "Load" → JS reads the file (via the existing __fs_read host-fn) →
// stores the entire content in React state → React passes it as `value` prop
// to TextEditor → bridge serializes the full string to JSON → Zig parses and
// applies. The watched variable is the `input-latency` line in stderr after
// a click.
//
// Test cart B (load_via_hook.tsx) does the same UI with the contentHandle
// path. Compare click-latency numbers between the two.

const React: any = require('react');
const { useState } = React;

import { Box, Pressable, Text, TextEditor } from '../runtime/primitives';
import * as fs from '../runtime/hooks/fs';

const TEST_FILE = '/home/siah/creative/reactjit/cart/sweatshop/index.tsx';

export default function App() {
  const [content, setContent] = useState('');
  const [loadedAt, setLoadedAt] = useState(0);

  const onLoad = () => {
    const text = fs.readFile(TEST_FILE);
    setContent(text || '');
    setLoadedAt(Date.now());
  };

  return (
    <Box style={{ width: '100%', height: '100%', padding: 20, gap: 12, backgroundColor: '#0b1020' }}>
      <Text fontSize={18} color="#f8fafc">A) load via React (value prop)</Text>
      <Text fontSize={12} color="#94a3b8">{TEST_FILE}</Text>
      <Pressable
        onPress={onLoad}
        style={{
          alignSelf: 'flex-start',
          paddingTop: 10, paddingBottom: 10, paddingLeft: 14, paddingRight: 14,
          borderRadius: 8,
          backgroundColor: '#1d4ed8',
        }}
      >
        <Text fontSize={14} color="#ffffff">Load ({content.length} chars, setState at t={loadedAt})</Text>
      </Pressable>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, borderWidth: 1, borderColor: '#1e293b', borderRadius: 6 }}>
        <TextEditor
          value={content}
          fontSize={12}
          color="#e2e8f0"
          paintText={true}
          style={{ width: '100%', height: '100%', padding: 8 }}
        />
      </Box>
    </Box>
  );
}
