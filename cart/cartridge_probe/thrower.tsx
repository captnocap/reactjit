// A guest that throws on render. Used to probe what happens when an
// unbounded React error originates inside a <Cartridge>. The host wraps
// THIS instance in an ErrorBoundary so the rest of the tree survives —
// we display what the boundary caught so the test asserts containment.

export default function Thrower() {
  throw new Error('thrower-guest: deliberate render-time throw');
}
