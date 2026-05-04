// SQL helpers — minimal client-side escaping while framework/pg.zig has
// param binding stubbed (see `paramsJson` ignored at framework/pg.zig:177).
// Once param binding lands, replace these with real $1/$2 placeholders.

/** Single-quote a SQL string literal, doubling embedded quotes. */
export function lit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Double-quote a SQL identifier (table / column / db name). Doubles
 *  embedded quotes. We always quote so reserved words like "user" are
 *  safe. */
export function ident(s: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(s)) {
    throw new Error(`Refusing to quote identifier with unexpected chars: ${s}`);
  }
  return `"${s.replace(/"/g, '""')}"`;
}

/** Render a JSON value as a SQL JSONB literal: `'<json>'::jsonb`. */
export function jsonb(value: unknown): string {
  return `${lit(JSON.stringify(value ?? null))}::jsonb`;
}

/** Render a JS primitive as a SQL literal. Strings → 'quoted', booleans
 *  → TRUE/FALSE, null/undefined → NULL, numbers → as-is, anything else
 *  → JSONB. */
export function val(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Refusing to render non-finite number: ${v}`);
    return String(v);
  }
  if (typeof v === 'string') return lit(v);
  return jsonb(v);
}

/** Map an entity name (kebab-case) to a SQL table name (snake_case). */
export function tableName(entity: string): string {
  return entity.replace(/-/g, '_');
}
