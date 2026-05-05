// cart/hello2.tsx — Phase 1 ambient-primitives smoke test.
// NO imports, no `const React = require('react')`. Box / Text / Pressable /
// useState all resolve via esbuild's inject of framework/ambient.ts.

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <Box style={{ width: '100%', height: '100%', padding: 24, gap: 12, backgroundColor: '#0b1020' }}>
      <Text fontSize={28} color="#f8fafc">hello from ambient</Text>
      <Text fontSize={14} color="#94a3b8">no imports, no React require — primitives and hooks come from framework/ambient.ts</Text>
      <Pressable
        onPress={() => setCount((n: number) => n + 1)}
        style={{
          alignSelf: 'flex-start',
          paddingTop: 10, paddingBottom: 10, paddingLeft: 14, paddingRight: 14,
          borderRadius: 8, backgroundColor: '#1d4ed8',
        }}
      >
        <Text fontSize={14} color="#ffffff">tap ({count})</Text>
      </Pressable>
    </Box>
  );
}
