import { Box, Canvas, Col, Graph, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { parseSmiles } from '../../lib/chemistry/smiles';

const ATOM_COLORS: Record<string, string> = {
  C: COLORS.textDim,
  H: COLORS.textBright,
  N: COLORS.blue,
  O: COLORS.red,
  S: COLORS.yellow,
  P: COLORS.orange,
  F: COLORS.green,
  Cl: COLORS.green,
  Br: COLORS.orange,
  I: COLORS.purple,
};

function bondD(a: { x: number; y: number }, b: { x: number; y: number }): string {
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function atomColor(element: string): string {
  return ATOM_COLORS[element] || COLORS.textBright;
}

export function MoleculeView(props: { smiles: string }) {
  let molecule;
  let error = '';
  try {
    molecule = parseSmiles(props.smiles);
  } catch (err: any) {
    error = String(err?.message || err || 'SMILES parse failed');
    molecule = null;
  }

  if (error) {
    return (
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
        <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>{error}</Text>
      </Box>
    );
  }

  if (!molecule || molecule.atoms.length === 0) {
    return (
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
        <Text fontSize={10} color={COLORS.textDim}>No atoms to render.</Text>
      </Box>
    );
  }

  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const atom of molecule.atoms) {
    if (atom.x < minX) minX = atom.x;
    if (atom.y < minY) minY = atom.y;
    if (atom.x > maxX) maxX = atom.x;
    if (atom.y > maxY) maxY = atom.y;
  }
  const width = Math.max(320, Math.ceil(maxX - minX + 120));
  const height = Math.max(240, Math.ceil(maxY - minY + 120));
  const offsetX = width / 2;
  const offsetY = height / 2;

  return (
    <Col style={{ gap: 10 }}>
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, overflow: 'hidden' }}>
        <Canvas style={{ width, height, backgroundColor: COLORS.panelBg }}>
          <Graph style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
            {molecule.bonds.map((bond, index) => {
              const a = molecule.atoms[bond.from];
              const b = molecule.atoms[bond.to];
              if (!a || !b) return null;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const px = -dy / len;
              const py = dx / len;
              const gap = bond.order > 1 ? 3 : 0;
              const lines = bond.order >= 3 ? [-gap, 0, gap] : bond.order >= 2 ? [-gap / 2, gap / 2] : [0];
              return lines.map((shift, idx) => (
                <Graph.Path
                  key={`${index}-${idx}`}
                  d={bondD(
                    { x: a.x + offsetX + px * shift, y: a.y + offsetY + py * shift },
                    { x: b.x + offsetX + px * shift, y: b.y + offsetY + py * shift },
                  )}
                  stroke={COLORS.borderSoft}
                  strokeWidth={bond.order >= 2 ? 2 : 1.6}
                  fill="none"
                />
              ));
            })}
          </Graph>
          {molecule.atoms.map((atom, index) => (
            <Canvas.Node key={index} gx={atom.x + offsetX - 16} gy={atom.y + offsetY - 16} gw={32} gh={32}>
              <Box style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: atomColor(atom.element),
                backgroundColor: COLORS.panelRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text fontSize={10} color={atomColor(atom.element)} style={{ fontWeight: 'bold' }}>{atom.element}</Text>
              </Box>
            </Canvas.Node>
          ))}
        </Canvas>
      </Box>
    </Col>
  );
}

