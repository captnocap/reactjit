export function copyToClipboard(text: string): void {
  const host: any = globalThis;
  if (typeof host.__clipboard_set === 'function') {
    try {
      host.__clipboard_set(text);
    } catch {}
  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }
}
