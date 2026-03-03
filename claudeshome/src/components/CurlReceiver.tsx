/**
 * CurlReceiver — HTTP endpoint that lets you send messages to Vesper from anywhere.
 *
 * Usage (from any machine that can reach this host):
 *   curl -X POST http://localhost:9100/message -d "hey, quick question..."
 *   curl -X POST http://localhost:9100/message -H "Content-Type: application/json" -d '{"message":"do the thing"}'
 *
 * Endpoints:
 *   POST /message   — send a message to the Claude session (returns 200 OK)
 *   GET  /ping      — health check (returns {"ok":true,"port":9100})
 */

import React, { useMemo, useRef } from 'react';
import { useLoveRPC } from '@reactjit/core';
import { useServer } from '@reactjit/server';
import type { HttpRequest, HttpResponse } from '@reactjit/server';

const PORT = 9100;

function jsonOk(body: object): HttpResponse {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function jsonErr(status: number, message: string): HttpResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

export function CurlReceiver() {
  const sendRpc = useLoveRPC('claude:send');
  const sendRef = useRef(sendRpc);
  sendRef.current = sendRpc;

  const config = useMemo(() => ({
    port: PORT,
    routes: [
      {
        method: 'GET' as const,
        path: '/ping',
        handler: (_req: HttpRequest): HttpResponse =>
          jsonOk({ ok: true, port: PORT, identity: 'Vesper' }),
      },
      {
        method: 'POST' as const,
        path: '/message',
        handler: async (req: HttpRequest): Promise<HttpResponse> => {
          // Accept plain text or JSON { message: string }
          let message = req.body ?? '';
          const ct = (req.headers['content-type'] ?? req.headers['Content-Type'] ?? '');
          if (ct.includes('application/json')) {
            try {
              const parsed = JSON.parse(message);
              message = parsed.message ?? parsed.text ?? parsed.msg ?? JSON.stringify(parsed);
            } catch {
              return jsonErr(400, 'invalid JSON body');
            }
          }

          message = message.trim();
          if (!message) return jsonErr(400, 'empty message');

          try {
            await sendRef.current({ message });
            return jsonOk({ ok: true });
          } catch (err: any) {
            return jsonErr(500, String(err?.message ?? err));
          }
        },
      },
    ],
  }), []);

  useServer(config);

  return null;
}
