import { useLoveRPC } from '@reactjit/core';

/** Single hook for all math operations. All compute runs in Lua via LuaJIT. */
export function useMath() {
  return useLoveRPC<any>('math:call');
}
