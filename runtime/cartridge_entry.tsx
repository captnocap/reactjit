// Cartridge bundle entry. Replaces runtime/index.tsx when cart-bundle.js is
// invoked with --cartridge. The host has already booted React, the
// reconciler, the renderer, console, timers, fs, and event dispatch — all of
// that infra is in scope via globalThis. A guest cart only needs to register
// its root component so the host's <Cartridge> primitive can render it.

// @ts-ignore — bundle-time alias, resolved by scripts/cart-bundle.js
import App from '@cart-entry';

const g: any = globalThis as any;
const slot = g.__cartridgeLoadSlot;
if (slot && typeof slot === 'object') {
  // Loader writes the slot object; we plug the component in. Indirection
  // means the host can route concurrent loads of different cartridges to
  // distinct slots without collision.
  slot.App = App;
} else {
  // Single-shot fallback for ad-hoc evals.
  g.__lastCartridge = App;
}
