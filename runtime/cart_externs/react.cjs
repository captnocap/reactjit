// Cartridge-mode external — proxies to the host's already-loaded React so
// guest carts share React's dispatcher, hooks state, and refs with the host.
// Used only when the bundle is built with `cart-bundle.js --cartridge`.
module.exports = globalThis.__hostModules.react;
