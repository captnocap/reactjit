import { Box } from '../runtime/primitives';

export default function SpinnerTest({ spinIdx }: { spinIdx: number }) {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: 'black', padding: 20, flexDirection: 'row', gap: 20, justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 16 }}>
        <Box style={{ width: 60, height: 60, backgroundColor: spinIdx === 0 ? 'white' : 'red',     borderRadius: 8 }} />
        <Box style={{ width: 60, height: 60, backgroundColor: spinIdx === 1 ? 'white' : 'blue',    borderRadius: 8 }} />
        <Box style={{ width: 60, height: 60, backgroundColor: spinIdx === 2 ? 'white' : 'green',   borderRadius: 8 }} />
        <Box style={{ width: 60, height: 60, backgroundColor: spinIdx === 3 ? 'white' : 'yellow',  borderRadius: 8 }} />
        <Box style={{ width: 60, height: 60, backgroundColor: spinIdx === 4 ? 'white' : 'cyan',    borderRadius: 8 }} />
        <Box style={{ width: 60, height: 60, backgroundColor: spinIdx === 5 ? 'white' : 'magenta', borderRadius: 8 }} />
      </Box>
    </Box>
  );
}
