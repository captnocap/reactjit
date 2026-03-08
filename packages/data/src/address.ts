export function normalizeCellAddress(address: string): string {
  return address.toUpperCase().replace(/\s+/g, '').replace(/\$/g, '');
}

export function columnIndexToLabel(index: number): string {
  let n = Math.floor(index);
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function parseCellAddress(address: string): { col: number; row: number } | null {
  const norm = normalizeCellAddress(address);
  const match = norm.match(/^([A-Z]+)([1-9][0-9]*)$/);
  if (!match) return null;
  let col = 0;
  for (let i = 0; i < match[1].length; i += 1) col = col * 26 + (match[1].charCodeAt(i) - 64);
  return { col: col - 1, row: Number(match[2]) - 1 };
}

export function buildAddressMatrix(rows: number, cols: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) out.push(`${columnIndexToLabel(c)}${r + 1}`);
  }
  return out;
}
