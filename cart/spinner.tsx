import { Box } from '../runtime/primitives';
const React: any = require('react');
const { useState, useEffect } = React;

const COLORS = ['red', 'blue', 'green', 'yellow', 'cyan', 'magenta'];

export default function SpinnerTest() {
  const [spinIdx, setSpinIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSpinIdx((i: number) => (i + 1) % COLORS.length);
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: 'black', padding: 20, flexDirection: 'row', gap: 20, justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 16 }}>
        {COLORS.map((color, i) => (
          <Box
            key={i}
            style={{
              width: 60,
              height: 60,
              backgroundColor: spinIdx === i ? 'white' : color,
              borderRadius: 8,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
