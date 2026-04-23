// Test cart B — load a big file via useFileContent hook + contentHandle prop.
//
// Click "Load" → hook sets a path → useEffect calls __hostLoadFileToBuffer →
// Zig reads the file into a buffer, returns a u32 handle → hook returns that
// handle → TextEditor primitive receives only the handle (8 bytes), reads
// the bytes from the Zig-owned buffer directly. No file content crosses the
// bridge.
//
// If the hook path is meaningfully faster than cart A (load_via_react.tsx),
// the 1MB prop serialization was the bottleneck. If they're the same, the
// bottleneck is downstream (paint, layout, text shaping, or something we
// haven't isolated yet).

const React: any = require('react');
const { useState } = React;

import { Box, Pressable, Text, TextEditor } from '../runtime/primitives';
import { useFileContent } from '../runtime/hooks/useFileContent';

const TEST_FILE = '/home/siah/creative/reactjit/cart/sweatshop/index.tsx';

export default function App() {
  const [path, setPath] = useState<string>('');
  const [loadedAt, setLoadedAt] = useState(0);
  const handle = useFileContent(path || null);

  const onLoad = () => {
    setPath(TEST_FILE);
    setLoadedAt(Date.now());
  };

  return (
    <Box style={{ width: '100%', height: '100%', padding: 20, gap: 12, backgroundColor: '#0b1020' }}>
      <Text fontSize={18} color="#f8fafc">B) load via hook (contentHandle)</Text>
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
        <Text fontSize={14} color="#ffffff">Load (handle={handle}, setState at t={loadedAt})</Text>
      </Pressable>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, borderWidth: 1, borderColor: '#1e293b', borderRadius: 6 }}>
        <TextEditor
          contentHandle={handle}
          value=""
          fontSize={12}
          color="#e2e8f0"
          paintText={true}
          style={{ width: '100%', height: '100%', padding: 8 }}
        />
      </Box>
    </Box>
  );
}
