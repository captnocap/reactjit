#!/usr/bin/env node
// push-bundle — push a JS bundle to a running reactjit dev host.
//
// Usage: node scripts/push-bundle.mjs <tab-name> <bundle-path>
//
// Connects to /tmp/reactjit.sock (the dev_ipc.zig listener), sends a PUSH
// message, waits for ack, exits 0 on success or 1 on failure.

import net from 'node:net';
import fs from 'node:fs';

const SOCKET_PATH = '/tmp/reactjit.sock';

const [name, bundlePath] = process.argv.slice(2);
if (!name || !bundlePath) {
  console.error('[push-bundle] usage: push-bundle.mjs <tab-name> <bundle-path>');
  process.exit(1);
}

let bundle;
try {
  bundle = fs.readFileSync(bundlePath);
} catch (e) {
  console.error(`[push-bundle] cannot read ${bundlePath}: ${e.message}`);
  process.exit(1);
}

const client = net.createConnection(SOCKET_PATH);
let buffered = '';
let timedOut = false;

const timer = setTimeout(() => {
  timedOut = true;
  console.error(`[push-bundle] timeout waiting for host @ ${SOCKET_PATH}`);
  client.destroy();
  process.exit(2);
}, 3000);

client.on('connect', () => {
  client.write(`PUSH ${name} ${bundle.length}\n`);
  client.write(bundle);
});

client.on('data', (chunk) => {
  buffered += chunk.toString();
  const nl = buffered.indexOf('\n');
  if (nl === -1) return;
  const reply = buffered.slice(0, nl).trim();
  clearTimeout(timer);
  if (reply.startsWith('OK')) {
    client.end();
    process.exit(0);
  } else {
    console.error(`[push-bundle] host error: ${reply}`);
    client.end();
    process.exit(1);
  }
});

client.on('error', (e) => {
  if (timedOut) return;
  clearTimeout(timer);
  // ENOENT / ECONNREFUSED = host not running. Exit 2 so the caller can decide
  // whether to spawn one.
  if (e.code === 'ENOENT' || e.code === 'ECONNREFUSED') {
    process.exit(2);
  }
  console.error(`[push-bundle] ${e.message}`);
  process.exit(1);
});
