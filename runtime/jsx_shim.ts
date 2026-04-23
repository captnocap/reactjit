// Classic-JSX factory shim. esbuild is configured with jsxFactory: '__jsx' /
// jsxFragment: 'Fragment', so every .tsx file's JSX lowers to __jsx(...) /
// <Fragment> at bundle time. This file is inject'd into every build so
// those identifiers are always in scope without an explicit import.
//
// Why `__jsx` and not the short `h`: carts routinely declare `const h = ...`
// (height, host, hours, hash) inside functions that return JSX. Each such
// local shadows the factory and makes the component crash at click-time
// with `hN is not a function`. `__jsx` is reserved-prefix-shaped and won't
// collide with anything a cart author writes.
//
// MUST use lazy require('react') wrappers, not top-level capture.
// esbuild's inject can place this file's init function inside react/index.js's
// own CJS body. At that moment require('react') returns the partial {}
// module. Capturing React.createElement / React.Fragment at init time stores
// undefined forever. Deferring to JSX execution time (after react finishes
// its body) resolves to the real React.

export const __jsx = function __jsx(...a: any[]) {
  return (require('react') as any).createElement(...a);
};

// Fragment must be the actual well-known Symbol so React.createElement's
// identity check (type === REACT_FRAGMENT_TYPE) succeeds. Symbol.for is
// safe because it does not depend on the React module being loaded.
export const Fragment: any = Symbol.for('react.fragment');
