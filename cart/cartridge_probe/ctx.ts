// Shared React context. If host and guest get one module instance, they
// share the SAME context object — useContext lines up with Provider. If
// they each instantiate the module separately, they get two distinct
// context objects (createContext returns a fresh one each call), and the
// guest's useContext is keyed off an object the host's Provider doesn't
// know about → guest reads the context default.

// Use ambient `createContext` (framework/ambient.ts) — explicit
// `import { createContext } from 'react'` would also work, but staying on
// the ambient gives the same result while keeping this file dependency-free.
export const ProbeCtx: any = createContext('default-value (provider not seen)');
