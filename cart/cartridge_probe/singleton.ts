// Module-init counter. Both host and guest import this file.
//
// Each time the module BODY runs, it bumps a counter on globalThis and
// captures the new value as its local marker. If host and guest share the
// same module instance, the body runs once → both see marker = 1. If they
// each get their own copy, host sees 1 and guest sees 2.
//
// The counter lives on globalThis so its lifetime spans both host and
// guest's separate module scopes (the local `marker` would not — it'd be
// undefined when the other side reads it).

const g: any = globalThis as any;
g.__probe_module_inits = (g.__probe_module_inits || 0) + 1;
const marker = g.__probe_module_inits;

export function getMarker(): number {
  return marker;
}
