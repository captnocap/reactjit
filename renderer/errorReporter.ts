export function reportError(e: unknown, ctx: string): void {
  (globalThis as any).print('[err] ' + ctx + ': ' + String(e));
}
