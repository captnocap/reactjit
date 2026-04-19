// Direct CJS require bypasses esbuild's __toESM wrapping, which Hermes mis-handles
// (turns createElement into the version string '18.3.1').
const React: any = require('react');
export const h = React.createElement;
export const Fragment = React.Fragment;
