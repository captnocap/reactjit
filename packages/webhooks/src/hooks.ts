/**
 * Webhook React hooks — receive and send webhooks.
 * Receiving builds on @reactjit/server's useServer.
 * Sending is a standalone fetch wrapper with retries and HMAC signing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { hmacSHA256, timingSafeEqual } from './crypto';
import type {
  WebhookEvent,
  WebhookReceiverOptions,
  WebhookReceiverResult,
  WebhookSendOptions,
  WebhookSendResult,
  WebhookSenderOptions,
  WebhookSenderResult,
} from './types';

// ── Receiver ────────────────────────────────────────────

/**
 * Start an HTTP server that receives webhooks at a given path.
 * Builds on @reactjit/server (requires Lua HTTP server running).
 *
 * @example
 * // GitHub webhook receiver
 * const { events, latest } = useWebhook(9090, '/webhook/github', {
 *   secret: 'my-webhook-secret',
 * });
 *
 * @example
 * // Generic webhook — no signature verification
 * const { events } = useWebhook(9090, '/hooks/deploy');
 */
export function useWebhook(
  port: number | null,
  path: string,
  options?: WebhookReceiverOptions,
): WebhookReceiverResult {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [ready, setReady] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  // We need to import useServer dynamically to avoid a hard dependency
  // on @reactjit/server (it may not be in the bundle).
  // Instead, we use the low-level bridge RPC directly.
  const bridgeRef = useRef<any>(null);
  const serverIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (port == null) {
      setReady(false);
      return;
    }

    // Access bridge from context or globalThis
    const g = globalThis as any;
    if (!g.__loveRPC) return;

    const serverId = 'webhook_' + port + '_' + Date.now();
    serverIdRef.current = serverId;

    const routes = [
      { path, type: 'handler', method: undefined },
    ];

    g.__loveRPC('httpserver:listen', {
      serverId,
      port,
      host: optsRef.current?.host,
      routes,
    }).then((result: any) => {
      if (result && !result.error) {
        setReady(true);
      }
    }).catch(() => {});

    // Subscribe to incoming requests
    const handler = (payload: any) => {
      if (payload.serverId !== serverIdRef.current) return;

      const opts = optsRef.current;
      const rawBody = payload.body || '';
      const headers = payload.headers || {};

      // Method filter
      if (opts?.methods && !opts.methods.includes(payload.method)) {
        // Respond with 405
        g.__loveRPC('httpserver:respond', {
          serverId: payload.serverId,
          clientId: payload.clientId,
          status: 405,
          headers: {},
          body: 'Method Not Allowed',
        });
        return;
      }

      // Signature verification
      let verified: boolean | null = null;
      if (opts?.secret) {
        const sigHeader = opts.signatureHeader || 'x-hub-signature-256';
        const receivedSig = headers[sigHeader] || headers[sigHeader.toLowerCase()] || '';
        const expectedSig = 'sha256=' + hmacSHA256(opts.secret, rawBody);
        verified = timingSafeEqual(receivedSig, expectedSig);
      }

      // Parse body
      let body: any = rawBody;
      const ct = headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { body = JSON.parse(rawBody); } catch { /* keep raw */ }
      }

      const event: WebhookEvent = {
        id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        method: payload.method,
        path: payload.path,
        headers,
        body,
        rawBody,
        query: payload.query || {},
        verified,
      };

      const maxEvents = opts?.maxEvents ?? 100;
      setEvents(prev => [event, ...prev].slice(0, maxEvents));
      setTotalReceived(prev => prev + 1);

      // Respond
      g.__loveRPC('httpserver:respond', {
        serverId: payload.serverId,
        clientId: payload.clientId,
        status: opts?.responseStatus ?? 200,
        headers: { 'Content-Type': 'application/json' },
        body: opts?.responseBody ?? '{"ok":true}',
      }).catch(() => {});
    };

    // Subscribe to httpserver:request events
    if (g.__bridgeSubscribe) {
      const unsub = g.__bridgeSubscribe('httpserver:request', handler);
      return () => {
        unsub?.();
        if (serverIdRef.current) {
          g.__loveRPC('httpserver:close', { serverId: serverIdRef.current }).catch(() => {});
          serverIdRef.current = null;
          setReady(false);
        }
      };
    }

    return () => {
      if (serverIdRef.current) {
        g.__loveRPC('httpserver:close', { serverId: serverIdRef.current }).catch(() => {});
        serverIdRef.current = null;
        setReady(false);
      }
    };
  }, [port, path]);

  const clear = useCallback(() => setEvents([]), []);

  return {
    events,
    latest: events[0] ?? null,
    ready,
    totalReceived,
    clear,
  };
}

// ── Sender ──────────────────────────────────────────────

/**
 * Send a webhook payload to a URL.
 *
 * @example
 * await sendWebhook('https://example.com/hook', { event: 'deploy', ref: 'main' });
 *
 * @example
 * // With HMAC signing and retries
 * await sendWebhook('https://example.com/hook', data, {
 *   secret: 'shared-secret',
 *   retries: 3,
 * });
 */
export async function sendWebhook(
  url: string,
  payload: any,
  options?: WebhookSendOptions,
): Promise<WebhookSendResult> {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const method = options?.method || 'POST';
  const maxRetries = options?.retries ?? 0;
  const baseDelay = options?.retryDelay ?? 1000;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // HMAC signature
  if (options?.secret) {
    const sigHeader = options.signatureHeader || 'x-hub-signature-256';
    headers[sigHeader] = 'sha256=' + hmacSHA256(options.secret, body);
  }

  let lastError: Error | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;

    if (attempt > 0) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const res: any = await fetch(url, { method, headers, body });
      const resBody = await res.text();

      if (res.ok) {
        return { ok: true, status: res.status, body: resBody, attempts };
      }

      // Non-retriable status codes
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, body: resBody, attempts };
      }

      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  return { ok: false, status: 0, body: lastError?.message || 'Failed', attempts };
}

/**
 * React hook for sending webhooks with state tracking.
 *
 * @example
 * const { send, sending, error } = useWebhookSender({ retries: 3 });
 * await send('https://example.com/hook', { event: 'deploy' });
 */
export function useWebhookSender(options?: WebhookSenderOptions): WebhookSenderResult {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<WebhookSendResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const send = useCallback(async (
    url: string,
    payload: any,
    sendOpts?: WebhookSendOptions,
  ): Promise<WebhookSendResult> => {
    setSending(true);
    setError(null);
    try {
      const result = await sendWebhook(url, payload, {
        headers: optsRef.current?.headers,
        secret: optsRef.current?.secret,
        retries: optsRef.current?.retries ?? 3,
        ...sendOpts,
      });
      setLastResult(result);
      if (!result.ok) {
        setError(new Error(`Webhook failed: HTTP ${result.status}`));
      }
      setSending(false);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setSending(false);
      throw e;
    }
  }, []);

  return { send, sending, lastResult, error };
}
