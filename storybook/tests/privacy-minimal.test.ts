// Minimal privacy test — pure TS only, no RPC
import {
  detectPII,
  redactPII,
  maskValue,
  stegEmbedWhitespace,
  stegExtractWhitespace,
  checkAlgorithmStrength,
  sanitizeFilename,
} from '@reactjit/privacy';

test('detectPII finds email', async () => {
  const matches = detectPII('Contact user@example.com');
  if (matches.length !== 1) throw new Error(`Expected 1, got ${matches.length}`);
});

test('redactPII replaces email', async () => {
  const result = redactPII('Email: user@example.com');
  if (result.includes('user@example.com')) throw new Error('Not redacted');
});

test('maskValue works', async () => {
  const result = maskValue('4111111111111111');
  if (!result.endsWith('1111')) throw new Error(`Bad mask: ${result}`);
});

test('steg round-trip', async () => {
  const encoded = stegEmbedWhitespace('hello world', 'secret');
  const decoded = stegExtractWhitespace(encoded);
  if (decoded !== 'secret') throw new Error(`Got: ${decoded}`);
});

test('algorithm strength', async () => {
  const r = checkAlgorithmStrength('md5');
  if (r.strength !== 'weak') throw new Error(`Got: ${r.strength}`);
});

test('sanitize filename', async () => {
  const r = sanitizeFilename('../../../etc/passwd');
  if (r.includes('../')) throw new Error(`Not sanitized: ${r}`);
});
