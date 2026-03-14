import { useLoveRPC } from '@reactjit/core';
export const useConvert = () => useLoveRPC<any>('convert:convert');
