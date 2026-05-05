/**
 * host_test — exercises useHost http with a few routes and a hit counter.
 * Bound to 0.0.0.0:8500. Curl-able from outside the cart process.
 */

import * as React from 'react';
import { useState, useRef } from 'react';
import { useHost } from '@reactjit/runtime/hooks/useHost';

export default function App() {
  const [hits, setHits] = useState(0);
  const [last, setLast] = useState<{ method: string; path: string } | null>(null);
  const hitsRef = useRef(0);

  const srv = useHost({
    kind: 'http',
    port: 8500,
    routes: [{ path: '/', kind: 'handler' }],
    onRequest: (req, res) => {
      hitsRef.current += 1;
      setHits(hitsRef.current);
      setLast({ method: req.method, path: req.path });

      if (req.path === '/health') {
        res.send(200, 'application/json', JSON.stringify({ ok: true, hits: hitsRef.current }));
        return;
      }
      if (req.path === '/echo') {
        res.send(200, 'application/json', JSON.stringify({
          method: req.method,
          path: req.path,
          body: req.body,
          hits: hitsRef.current,
        }));
        return;
      }
      if (req.path === '/') {
        res.send(200, 'text/plain', `host_test hit #${hitsRef.current} from useHost\n`);
        return;
      }
      res.send(404, 'text/plain', `unknown route: ${req.path}\n`);
    },
  });

  return (
    <div style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>host_test</h1>
      <pre>{JSON.stringify({
        port: 8500,
        state: srv.state,
        error: srv.error,
        hits,
        last,
      }, null, 2)}</pre>
      <p>try: curl http://127.0.0.1:8500/health</p>
    </div>
  );
}
