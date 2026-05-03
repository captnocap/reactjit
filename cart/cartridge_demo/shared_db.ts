// Tiny in-memory "database" that both the host cart and the guest cart see
// the same instance of. The state lives on globalThis so that the guest's
// own copy of this module (bundled into bundle-cartridge_demo_guest.cart.js)
// reads and writes the SAME store as the host's copy.

export type Row = { id: number; text: string; owner: string };

type Store = { rows: Row[]; nextId: number; subs: Set<() => void> };

function getStore(): Store {
  const g: any = globalThis as any;
  if (!g.__demoDB) {
    g.__demoDB = { rows: [], nextId: 1, subs: new Set() } as Store;
  }
  return g.__demoDB as Store;
}

export function listRows(): Row[] {
  return getStore().rows.slice();
}

export function addRow(text: string, owner: string): Row {
  const s = getStore();
  const row: Row = { id: s.nextId++, text, owner };
  s.rows.push(row);
  s.subs.forEach((fn) => fn());
  return row;
}

export function clearRows(): void {
  const s = getStore();
  s.rows = [];
  s.subs.forEach((fn) => fn());
}

// useDB — subscribe to the shared store. Re-renders the calling component
// whenever any module (host OR guest) mutates rows. React is shared between
// host and guest so useState hits the same dispatcher either way.
export function useDB() {
  const React = require('react');
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const s = getStore();
    const fn = () => force((x: number) => x + 1);
    s.subs.add(fn);
    return () => { s.subs.delete(fn); };
  }, []);
  return { rows: listRows(), addRow, clearRows };
}
