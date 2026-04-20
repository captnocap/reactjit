declare const globalThis: any;

const host = (): any => globalThis;

export function sendUpdate(
  nodeId: number,
  props: Record<string, any>,
  options?: { removeKeys?: string[]; removeStyleKeys?: string[] }
) {
  const h = host();
  const flush: any = h.__hostFlush;
  if (typeof flush !== 'function') return;
  const cmd: any = { op: 'UPDATE', id: nodeId, props };
  if (options?.removeKeys?.length) cmd.removeKeys = options.removeKeys;
  if (options?.removeStyleKeys?.length) cmd.removeStyleKeys = options.removeStyleKeys;
  try {
    flush(JSON.stringify([cmd]));
  } catch {}
}

export function setNodeDim(id: number, intensity: number) {
  const h = host();
  if (typeof h.setNodeDim === 'function') h.setNodeDim(id, intensity);
}

export function resetNodeDim() {
  const h = host();
  if (typeof h.resetNodeDim === 'function') h.resetNodeDim();
}

export function getHostFps(): number {
  const h = host();
  return typeof h.getFps === 'function' ? Math.round(h.getFps()) : 0;
}

export function getHostLayoutUs(): number {
  const h = host();
  return typeof h.getLayoutUs === 'function' ? Math.round(h.getLayoutUs()) : 0;
}

export function getHostPaintUs(): number {
  const h = host();
  return typeof h.getPaintUs === 'function' ? Math.round(h.getPaintUs()) : 0;
}

export function getHostTickUs(): number {
  const h = host();
  return typeof h.getTickUs === 'function' ? Math.round(h.getTickUs()) : 0;
}

export function getHostTelemetry(): any {
  const h = host();
  try {
    return typeof h.__tel_nodes === 'function' ? h.__tel_nodes() : null;
  } catch {
    return null;
  }
}
