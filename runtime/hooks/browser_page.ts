import { callHost, callHostJson, subscribe } from '../ffi';

export interface BrowserPageResponse {
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
  truncated?: boolean;
  error?: string;
}

let _browserPageReqSeq = 1;

export function fetchPageAsync(url: string): Promise<BrowserPageResponse> {
  const sync = callHostJson<BrowserPageResponse | null>(
    '__browser_page_sync',
    null,
    JSON.stringify({ url }),
  );
  if (sync) return Promise.resolve(sync);

  const reqId = `page${_browserPageReqSeq++}`;
  return new Promise<BrowserPageResponse>((resolve) => {
    const unsub = subscribe(`browser-page:${reqId}`, (payload) => {
      unsub();
      resolve(typeof payload === 'string' ? JSON.parse(payload) : payload);
    });
    callHost<void>('__browser_page_async', undefined as any, JSON.stringify({ url }), reqId);
  });
}
