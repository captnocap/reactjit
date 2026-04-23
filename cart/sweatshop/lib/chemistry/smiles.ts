export type MoleculeAtom = {
  element: string;
  x: number;
  y: number;
};

export type MoleculeBond = {
  from: number;
  to: number;
  order: number;
};

export type ParsedMolecule = {
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
};
type ParsedAtom = MoleculeAtom & {
  aromatic?: boolean;
};
const AROMATIC_ELEMENTS: Record<string, string> = { c: 'C', n: 'N', o: 'O', s: 'S', p: 'P' };

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function parseAtom(smiles: string, index: number): { element: string; aromatic?: boolean; next: number } | null {
  const ch = smiles.charAt(index);
  if (!ch) return null;
  if (ch === '[') {
    const close = smiles.indexOf(']', index + 1);
    if (close < 0) throw new Error('unclosed bracket atom');
    const body = smiles.slice(index + 1, close);
    const match = body.match(/([A-Z][a-z]?|[a-z])/);
    if (!match) throw new Error('empty bracket atom');
    const raw = match[1];
    const aromatic = raw.length === 1 && raw === raw.toLowerCase();
    return { element: aromatic ? (AROMATIC_ELEMENTS[raw] || raw.toUpperCase()) : raw, aromatic, next: close + 1 };
  }
  if (ch >= 'A' && ch <= 'Z') {
    const next = smiles.charAt(index + 1);
    if (next >= 'a' && next <= 'z') return { element: ch + next, next: index + 2 };
    return { element: ch, next: index + 1 };
  }
  if (AROMATIC_ELEMENTS[ch]) return { element: AROMATIC_ELEMENTS[ch], aromatic: true, next: index + 1 };
  return null;
}

function addBond(bonds: MoleculeBond[], from: number, to: number, order: number): void {
  if (from === to) return;
  bonds.push({ from, to, order });
}

export function parseSmiles(smiles: string): ParsedMolecule {
  const text = String(smiles || '').trim();
  if (!text) throw new Error('smiles is empty');
  const atoms: ParsedAtom[] = [];
  const bonds: MoleculeBond[] = [];
  const branchStack: number[] = [];
  const ringClosures = new Map<string, { atom: number; order: number; aromatic: boolean }>();
  let currentAtom = -1;
  let pendingBond = 1;

  for (let i = 0; i < text.length;) {
    const ch = text.charAt(i);
    if (ch === '(') {
      if (currentAtom < 0) throw new Error('branch without atom');
      branchStack.push(currentAtom);
      i += 1;
      continue;
    }
    if (ch === ')') {
      const next = branchStack.pop();
      if (next == null) throw new Error('unmatched branch close');
      currentAtom = next;
      i += 1;
      continue;
    }
    if (ch === '.') {
      currentAtom = -1;
      pendingBond = 1;
      i += 1;
      continue;
    }
    if (ch === '=') { pendingBond = 2; i += 1; continue; }
    if (ch === '#') { pendingBond = 3; i += 1; continue; }
    if (ch === '-') { pendingBond = 1; i += 1; continue; }
    if (ch === ':') { pendingBond = 1.5; i += 1; continue; }

    let ringKey = '';
    if (ch === '%') {
      ringKey = text.slice(i + 1, i + 3);
      if (!/^\d\d$/.test(ringKey)) throw new Error('invalid ring index');
      i += 3;
    } else if (isDigit(ch)) {
      ringKey = ch;
      i += 1;
    }

    if (ringKey) {
      if (currentAtom < 0) throw new Error('ring index without atom');
      const existing = ringClosures.get(ringKey);
      if (existing) {
        const order = pendingBond !== 1 ? pendingBond : existing.order || (existing.aromatic ? 1.5 : 1);
        addBond(bonds, existing.atom, currentAtom, order);
        ringClosures.delete(ringKey);
      } else {
        ringClosures.set(ringKey, { atom: currentAtom, order: pendingBond, aromatic: !!atoms[currentAtom]?.aromatic });
      }
      pendingBond = 1;
      continue;
    }

    const atom = parseAtom(text, i);
    if (!atom) throw new Error(`unsupported SMILES token "${ch}" at index ${i}`);
    const index = atoms.push({ element: atom.element, x: atoms.length * 1.4, y: 0, aromatic: atom.aromatic }) - 1;
    if (currentAtom >= 0) {
      const prev = atoms[currentAtom];
      const order = pendingBond !== 1 ? pendingBond : (prev?.aromatic && atom.aromatic ? 1.5 : 1);
      addBond(bonds, currentAtom, index, order);
    }
    currentAtom = index;
    pendingBond = 1;
    i = atom.next;
  }

  if (branchStack.length > 0) throw new Error('unclosed branch');
  if (ringClosures.size > 0) throw new Error('unclosed ring');
  return layoutMolecule({ atoms, bonds });
}
function layoutMolecule(molecule: ParsedMolecule): ParsedMolecule {
  const atoms: ParsedAtom[] = molecule.atoms.map((atom) => ({ ...atom }));
  const bonds = molecule.bonds.slice();
  const n = atoms.length;
  if (n <= 1) return { atoms, bonds };

  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n;
    atoms[i].x = Math.cos(angle) * (n > 4 ? 1.4 : 0.9);
    atoms[i].y = Math.sin(angle) * (n > 4 ? 1.1 : 0.7);
  }

  const iterations = 16, repulsion = 1.25, spring = 0.12;
  for (let iter = 0; iter < iterations; iter++) {
    const forces = atoms.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = atoms[j].x - atoms[i].x;
        const dy = atoms[j].y - atoms[i].y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(dist2);
        const force = repulsion / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[i].x -= fx;
        forces[i].y -= fy;
        forces[j].x += fx;
        forces[j].y += fy;
      }
    }
    for (const bond of bonds) {
      const a = atoms[bond.from];
      const b = atoms[bond.to];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const desired = 1.25 / Math.max(0.75, bond.order);
      const force = (dist - desired) * spring;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces[bond.from].x += fx;
      forces[bond.from].y += fy;
      forces[bond.to].x -= fx;
      forces[bond.to].y -= fy;
    }
    for (let i = 0; i < n; i++) {
      atoms[i].x += forces[i].x * 0.08;
      atoms[i].y += forces[i].y * 0.08;
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const atom of atoms) {
    if (atom.x < minX) minX = atom.x;
    if (atom.y < minY) minY = atom.y;
    if (atom.x > maxX) maxX = atom.x;
    if (atom.y > maxY) maxY = atom.y;
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const spanX = Math.max(maxX - minX, 0.001);
  const spanY = Math.max(maxY - minY, 0.001);
  const scale = 140 / Math.max(spanX, spanY);
  for (const atom of atoms) {
    atom.x = (atom.x - centerX) * scale;
    atom.y = (atom.y - centerY) * scale;
  }
  return { atoms, bonds };
}
