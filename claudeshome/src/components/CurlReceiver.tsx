/**
 * CurlReceiver — HTTP endpoint for bidirectional messaging with Vesper.
 *
 * Usage (from any terminal):
 *   curl -X POST http://localhost:9100/message -d "hey vesper"
 *   curl http://localhost:9100/inbox
 *   curl http://localhost:9100/ping
 *
 * Endpoints:
 *   POST /message   — send a message to Vesper (also forwards to Claude session)
 *   GET  /inbox     — read the full conversation thread (JSON array)
 *   GET  /ping      — health check
 */

import React, { useMemo, useRef } from 'react';
import { useLoveRPC } from '@reactjit/core';
import { useServer } from '@reactjit/server';
import type { HttpRequest, HttpResponse } from '@reactjit/server';
import type { Message } from '../hooks/useMessages';

const PORT = 9100;

function jsonOk(body: object): HttpResponse {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body, null, 2),
  };
}

function jsonErr(status: number, message: string): HttpResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

interface Props {
  onReceive: (text: string) => void;
  messages: Message[];
}

export function CurlReceiver({ onReceive, messages }: Props) {
  const sendRpc = useLoveRPC('claude:send');
  const sendRef = useRef(sendRpc);
  sendRef.current = sendRpc;

  const onReceiveRef = useRef(onReceive);
  onReceiveRef.current = onReceive;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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
        method: 'GET' as const,
        path: '/inbox',
        handler: (_req: HttpRequest): HttpResponse => {
          const msgs = messagesRef.current.map(m => ({
            sender: m.sender,
            text: m.text,
            time: new Date(m.ts).toISOString(),
          }));
          return jsonOk({ messages: msgs, count: msgs.length });
        },
      },
      {
        method: 'POST' as const,
        path: '/message',
        handler: async (req: HttpRequest): Promise<HttpResponse> => {
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

          // Store in message history
          onReceiveRef.current(message);

          // Also forward to Claude session
          try {
            await sendRef.current({ message: `[Message from human] ${message}` });
          } catch {}

          return jsonOk({ ok: true, stored: true });
        },
      },
    ],
  }), []);

  useServer(config);

  return null;
}
