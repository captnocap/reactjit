// Classic-JSX factory shim. esbuild is configured with jsxFactory: 'h' /
// jsxFragment: 'Fragment', so every .tsx file's JSX lowers to h(...) /
// <Fragment> at bundle time. This file is inject'd into every build so
// those identifiers are always in scope without an explicit import.
//
// MUST use lazy require('react') for h. When esbuild injects this file into
// react/index.js's own CJS body, require('react') returns the partial {}
// module. Capturing React.createElement at init time stores undefined.
// Deferring to JSX execution time resolves to the real React.
//
// Fragment uses Symbol.for("react.fragment") directly — it is the stable
// well-known symbol React uses, so it needs no runtime lookup and avoids
// the circular-init problem entirely.

export const h = function h(...a: any[]) {
  return (require('react') as any).createElement(...a);
};

export const Fragment: any = Symbol.for('react.fragment');
