import { Box, Graph } from '../../../../runtime/primitives';
import { Braces, Check, List, Target, Terminal } from '../../../../runtime/icons/icons';

const VIEW = 24;
const HALF = 12;

export type RailBadgeName = 'terminal' | 'braces' | 'target' | 'list' | 'check';

function resolveIcon(name: RailBadgeName): number[][] {
  if (name === 'terminal') return Terminal;
  if (name === 'braces') return Braces;
  if (name === 'target') return Target;
  if (name === 'check') return Check;
  return List;
}

function polylineToD(poly: number[]): string {
  if (poly.length < 4) return '';
  let out = `M ${poly[0] - HALF},${poly[1] - HALF}`;
  for (let index = 2; index < poly.length; index += 2) {
    out += ` L ${poly[index] - HALF},${poly[index + 1] - HALF}`;
  }
  return out;
}

export function RailBadge({ name, color }: { name: RailBadgeName; color: string }) {
  const icon = resolveIcon(name);

  return (
    <Box
      style={{
        width: 14,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#232843',
        borderWidth: 1,
        borderColor: color,
        borderRadius: 3,
      }}
    >
      <Box style={{ width: 10, height: 10, overflow: 'hidden' }}>
        <Graph style={{ width: 10, height: 10 }} viewX={0} viewY={0} viewZoom={10 / VIEW}>
          {icon.map((poly, index) => (
            <Graph.Path key={`${name}-${index}`} d={polylineToD(poly)} stroke={color} strokeWidth={2} fill="none" />
          ))}
        </Graph>
      </Box>
    </Box>
  );
}
