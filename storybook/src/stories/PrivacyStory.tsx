import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, Pressable, TextInput } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import {
  detectPII,
  redactPII,
  maskValue,
  stegEmbedWhitespace,
  stegExtractWhitespace,
  checkAlgorithmStrength,
  sanitizeFilename,
  normalizeTimestamp,
  RECOMMENDED_DEFAULTS,
} from '../../../packages/privacy/src';
import { usePrivacy } from '../../../packages/privacy/src/hooks';
import type { PIIMatch, AlgorithmAssessment, ShamirShare } from '../../../packages/privacy/src/types';

// ── PII Detection & Redaction ────────────────────────

function PIIDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, text: c.text, dim: c.textDim, sec: c.textSecondary, ok: c.success, warn: c.warning, err: c.error, info: c.info, accent: c.accent, border: c.border };

  const [input, setInput] = useState('Contact john@acme.com or call 555-123-4567. SSN: 123-45-6789. Card: 4111 1111 1111 1111');
  const [matches, setMatches] = useState<PIIMatch[]>([]);
  const [redacted, setRedacted] = useState('');

  useEffect(() => {
    const m = detectPII(input);
    setMatches(m);
    setRedacted(redactPII(input, { mask: true }));
  }, [input]);

  const typeColors: Record<string, string> = {
    email: C.info, phone: C.accent, ssn: C.err, creditCard: C.warn, ipv4: C.ok, ipv6: C.ok,
  };

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Pure TypeScript -- regex-based PII scanner with masking</Text>

      <Box style={{ gap: 4, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.sec }}>Input text:</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          style={{ fontSize: 10, color: C.text, backgroundColor: C.bg, padding: 6, borderRadius: 4, width: '100%' }}
        />
      </Box>

      <Box style={{ gap: 4, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.sec }}>{`Detected PII (${matches.length} matches):`}</Text>
        {matches.map((m, i) => (
          <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: typeColors[m.type] || C.dim }} />
            <Text style={{ fontSize: 10, color: typeColors[m.type] || C.dim, width: 80 }}>{m.type}</Text>
            <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3 }}>
              <Text style={{ fontSize: 9, color: C.sec }}>{m.value}</Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box style={{ gap: 4, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.ok, fontWeight: 'normal' }}>Redacted (masked):</Text>
        <Box style={{ backgroundColor: C.bg, padding: 6, borderRadius: 4 }}>
          <Text style={{ fontSize: 9, color: C.sec }}>{redacted}</Text>
        </Box>
      </Box>
    </>
  );
}

// ── Data Masking ─────────────────────────────────────

function MaskDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, info: c.info, warn: c.warning, ok: c.success };

  const samples = [
    { label: 'Credit Card', value: '4111111111111111', color: C.warn },
    { label: 'SSN', value: '123-45-6789', color: C.info },
    { label: 'Email', value: 'alice@example.com', color: C.ok },
  ];

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>maskValue() -- configurable visible start/end + mask character</Text>

      {samples.map(s => (
        <Box key={s.label} style={{ gap: 2, width: '100%' }}>
          <Text style={{ fontSize: 10, color: s.color, fontWeight: 'normal' }}>{s.label}</Text>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 3, flexGrow: 1 }}>
              <Text style={{ fontSize: 10, color: C.sec }}>{s.value}</Text>
            </Box>
            <Text style={{ fontSize: 10, color: C.dim }}>{'->'}</Text>
            <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 3, flexGrow: 1 }}>
              <Text style={{ fontSize: 10, color: s.color }}>{maskValue(s.value)}</Text>
            </Box>
          </Box>
        </Box>
      ))}

      <Box style={{ gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.info, fontWeight: 'normal' }}>Custom mask (visibleStart: 2, visibleEnd: 2, maskChar: '#')</Text>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 10, color: C.sec }}>sensitive-data-here</Text>
          </Box>
          <Text style={{ fontSize: 10, color: C.dim }}>{'->'}</Text>
          <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 10, color: C.info }}>{maskValue('sensitive-data-here', { visibleStart: 2, visibleEnd: 2, maskChar: '#' })}</Text>
          </Box>
        </Box>
      </Box>
    </>
  );
}

// ── Whitespace Steganography ─────────────────────────

function StegDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, info: c.info, accent: c.accent };

  const carrier = 'This is a perfectly normal sentence with nothing hidden.';
  const secret = 'TOP SECRET';
  const embedded = stegEmbedWhitespace(carrier, secret);
  const extracted = stegExtractWhitespace(embedded);

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Zero-width characters (U+200B / U+200C) encode binary in whitespace</Text>

      <Box style={{ gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.sec }}>Carrier text:</Text>
        <Box style={{ backgroundColor: C.bg, padding: 6, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.info }}>{carrier}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.accent, fontWeight: 'normal' }}>Secret to embed:</Text>
        <Box style={{ backgroundColor: C.bg, padding: 6, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.accent }}>{secret}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.sec }}>{`Embedded text (${embedded.length} chars vs ${carrier.length} visible):`}</Text>
        <Box style={{ backgroundColor: C.bg, padding: 6, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.info }}>{carrier}</Text>
        </Box>
        <Text style={{ fontSize: 8, color: C.dim }}>{`Hidden bytes: ${embedded.length - carrier.length} zero-width characters injected`}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: extracted === secret ? C.ok : c.error,
        }} />
        <Text style={{ fontSize: 11, color: extracted === secret ? C.ok : c.error, fontWeight: 'normal' }}>
          {extracted === secret ? `Extracted: "${extracted}" -- round-trip OK` : `Extraction failed: "${extracted}"`}
        </Text>
      </Box>
    </>
  );
}

// ── Algorithm Safety ─────────────────────────────────

function AlgorithmSafetyDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, warn: c.warning, err: c.error, info: c.info };

  const algorithms = [
    'xchacha20-poly1305', 'aes-256-gcm', 'blake3', 'argon2id',
    'aes-128-gcm', 'scrypt', 'pbkdf2',
    'sha1', 'md5', 'des',
    'md4', 'des-ecb', 'none',
  ];

  const strengthColors: Record<string, string> = {
    strong: C.ok, acceptable: C.info, weak: C.warn, broken: C.err,
  };

  const results: AlgorithmAssessment[] = algorithms.map(a => checkAlgorithmStrength(a));

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Pure TypeScript -- checks algorithm against known strength tiers</Text>

      {results.map(r => (
        <Box key={r.algorithm} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', width: '100%' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: strengthColors[r.strength] || C.dim }} />
          <Text style={{ fontSize: 10, color: c.text, width: 160 }}>{r.algorithm}</Text>
          <Text style={{ fontSize: 10, color: strengthColors[r.strength] || C.dim, width: 80, fontWeight: 'normal' }}>{r.strength}</Text>
          {r.deprecated && (
            <Text style={{ fontSize: 8, color: C.err }}>DEPRECATED</Text>
          )}
        </Box>
      ))}

      <Box style={{ backgroundColor: C.bg, padding: 8, borderRadius: 4, gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 9, color: C.dim }}>Recommended defaults:</Text>
        <Text style={{ fontSize: 9, color: C.ok }}>{`cipher: ${RECOMMENDED_DEFAULTS.algorithm}  kdf: ${RECOMMENDED_DEFAULTS.kdf}  hash: ${RECOMMENDED_DEFAULTS.hashAlgorithm}`}</Text>
        <Text style={{ fontSize: 9, color: C.ok }}>{`keySize: ${RECOMMENDED_DEFAULTS.keySize}B  nonce: ${RECOMMENDED_DEFAULTS.nonceSize}B  salt: ${RECOMMENDED_DEFAULTS.saltSize}B`}</Text>
      </Box>
    </>
  );
}

// ── Shamir's Secret Sharing ──────────────────────────

function ShamirDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, warn: c.warning, err: c.error, info: c.info, accent: c.accent };

  const privacy = usePrivacy();
  const secretHex = 'deadbeefcafebabe';

  const [shares, setShares] = useState<ShamirShare[]>([]);
  const [recovered, setRecovered] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runDemo = useCallback(async () => {
    try {
      const s = await privacy.shamir.split(secretHex, 5, 3);
      setShares(s);
      // Combine using only shares 0, 2, 4 (any 3 of 5)
      const rec = await privacy.shamir.combine([s[0], s[2], s[4]]);
      setRecovered(rec);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [privacy]);

  useEffect(() => { runDemo(); }, []);

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Lua FFI -- split secret into N shares, recover with any K (threshold)</Text>

      <Box style={{ gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.sec }}>Secret (hex):</Text>
        <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.info }}>{secretHex}</Text>
        </Box>
      </Box>

      <Text style={{ fontSize: 10, color: C.sec }}>{`Split into 5 shares (threshold: 3):`}</Text>

      {error && (
        <Text style={{ fontSize: 10, color: C.err }}>{`Shamir error: ${error}`}</Text>
      )}

      {shares.map(s => (
        <Box key={s.index} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 10, color: C.accent, width: 60 }}>{`Share ${s.index}`}</Text>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 8, color: C.sec }}>{s.hex}</Text>
          </Box>
        </Box>
      ))}

      {recovered && (
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: recovered === secretHex ? C.ok : C.err,
          }} />
          <Text style={{ fontSize: 11, color: recovered === secretHex ? C.ok : C.err, fontWeight: 'normal' }}>
            {recovered === secretHex ? `Recovered with shares [0,2,4]: ${recovered}` : `Recovery mismatch: ${recovered}`}
          </Text>
        </Box>
      )}

      <Pressable onPress={runDemo}>
        <Box style={{ backgroundColor: C.info, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.bg, fontWeight: 'normal' }}>Re-split</Text>
        </Box>
      </Pressable>
    </>
  );
}

// ── HKDF Key Derivation ──────────────────────────────

function HKDFDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, info: c.info, accent: c.accent };

  const privacy = usePrivacy();
  const [derivedKey, setDerivedKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ikm = 'user-provided-input-key-material';
  const salt = 'application-salt-2026';
  const info = 'encryption-key-v1';

  useEffect(() => {
    (async () => {
      try {
        const key = await privacy.hkdf.derive(ikm, { salt, info, length: 32 });
        setDerivedKey(key);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Lua FFI -- HMAC-based Extract-and-Expand Key Derivation Function</Text>

      <Box style={{ gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.sec }}>Input key material:</Text>
        <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.info }}>{ikm}</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <Box style={{ gap: 2, flexGrow: 1 }}>
          <Text style={{ fontSize: 9, color: C.dim }}>salt:</Text>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: C.accent }}>{salt}</Text>
          </Box>
        </Box>
        <Box style={{ gap: 2, flexGrow: 1 }}>
          <Text style={{ fontSize: 9, color: C.dim }}>info:</Text>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: C.accent }}>{info}</Text>
          </Box>
        </Box>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: c.error }}>{`HKDF error: ${error}`}</Text>
      )}

      {derivedKey && (
        <Box style={{ gap: 2, width: '100%' }}>
          <Text style={{ fontSize: 10, color: C.ok, fontWeight: 'normal' }}>Derived key (32 bytes, hex):</Text>
          <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: C.sec }}>{derivedKey}</Text>
          </Box>
        </Box>
      )}
    </>
  );
}

// ── Secure Memory ────────────────────────────────────

function SecureMemDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, warn: c.warning, err: c.error, info: c.info };

  const privacy = usePrivacy();
  const [steps, setSteps] = useState<{ label: string; value: string; color: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runDemo = useCallback(async () => {
    setSteps([]);
    setError(null);
    try {
      const data = 'cafebabe12345678';
      const log: typeof steps = [];

      log.push({ label: 'Allocating secure memory with data', value: data, color: C.info });
      setSteps([...log]);

      const handle = await privacy.secureMem.alloc(data);
      log.push({ label: 'Handle obtained', value: `#${handle}`, color: C.ok });
      setSteps([...log]);

      const readBack = await privacy.secureMem.read(handle);
      log.push({ label: 'Read back from secure memory', value: readBack, color: C.ok });
      setSteps([...log]);

      await privacy.secureMem.protect(handle, 'readonly');
      log.push({ label: 'Protected (readonly)', value: 'mprotect applied', color: C.warn });
      setSteps([...log]);

      await privacy.secureMem.free(handle);
      log.push({ label: 'Freed (sodium_memzero + munlock)', value: 'wiped', color: C.ok });
      setSteps([...log]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [privacy]);

  useEffect(() => { runDemo(); }, []);

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Lua FFI -- mlock + mprotect + sodium_memzero lifecycle</Text>

      {error && (
        <Text style={{ fontSize: 10, color: C.err }}>{`Secure memory error: ${error}`}</Text>
      )}

      {steps.map((s, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 9, color: C.dim, width: 14 }}>{`${i + 1}.`}</Text>
          <Text style={{ fontSize: 10, color: s.color, flexGrow: 1 }}>{s.label}</Text>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, color: C.sec }}>{s.value}</Text>
          </Box>
        </Box>
      ))}

      <Pressable onPress={runDemo}>
        <Box style={{ backgroundColor: C.info, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.bg, fontWeight: 'normal' }}>Re-run cycle</Text>
        </Box>
      </Pressable>
    </>
  );
}

// ── Encrypted Store ──────────────────────────────────

function EncryptedStoreDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, warn: c.warning, err: c.error, info: c.info, accent: c.accent };

  const privacy = usePrivacy();
  const [log, setLog] = useState<{ action: string; result: string; color: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runDemo = useCallback(async () => {
    setLog([]);
    setError(null);
    const entries: typeof log = [];
    try {
      const store = await privacy.store.create({ path: '/tmp/demo-store', password: 'demo-pass-123' });
      entries.push({ action: 'create()', result: 'Store opened', color: C.ok });
      setLog([...entries]);

      await store.set('api-key', 'sk-live-abc123xyz');
      entries.push({ action: 'set("api-key", ...)', result: 'Encrypted + stored', color: C.info });
      setLog([...entries]);

      await store.set('user-token', 'eyJhbGciOiJIUzI1NiJ9.payload');
      entries.push({ action: 'set("user-token", ...)', result: 'Encrypted + stored', color: C.info });
      setLog([...entries]);

      const keys = await store.list();
      entries.push({ action: 'list()', result: keys.join(', '), color: C.accent });
      setLog([...entries]);

      const val = await store.get('api-key');
      entries.push({ action: 'get("api-key")', result: String(val), color: C.ok });
      setLog([...entries]);

      await store.delete('user-token');
      entries.push({ action: 'delete("user-token")', result: 'Removed', color: C.warn });
      setLog([...entries]);

      const keysAfter = await store.list();
      entries.push({ action: 'list() after delete', result: keysAfter.join(', ') || '(empty)', color: C.accent });
      setLog([...entries]);

      await store.close();
      entries.push({ action: 'close()', result: 'Store closed + cleared', color: C.ok });
      setLog([...entries]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [privacy]);

  useEffect(() => { runDemo(); }, []);

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Encrypted key-value store -- encrypt via crypto RPC, in-memory map</Text>

      {error && (
        <Text style={{ fontSize: 10, color: C.err }}>{`Store error: ${error}`}</Text>
      )}

      {log.map((entry, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
          <Box style={{ width: 140 }}>
            <Text style={{ fontSize: 9, color: C.dim }}>{entry.action}</Text>
          </Box>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 9, color: entry.color }}>{entry.result}</Text>
          </Box>
        </Box>
      ))}

      <Pressable onPress={runDemo}>
        <Box style={{ backgroundColor: C.info, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.bg, fontWeight: 'normal' }}>Re-run</Text>
        </Box>
      </Pressable>
    </>
  );
}

// ── Audit Log ────────────────────────────────────────

function AuditDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, warn: c.warning, err: c.error, info: c.info, accent: c.accent };

  const privacy = usePrivacy();
  const [entries, setEntries] = useState<{ event: string; hash: string }[]>([]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDemo = useCallback(async () => {
    setEntries([]);
    setVerified(null);
    setError(null);
    try {
      // createAuditLog is a sync init -- must import directly
      const { createAuditLog, appendAudit, verifyAudit } = await import('../../../packages/privacy/src/audit');
      createAuditLog('demo-chain-key-hex-0123456789abcdef');

      const e1 = await appendAudit('user.login', { userId: 'alice', ip: '10.0.0.1' });
      const e2 = await appendAudit('data.access', { table: 'users', action: 'read' });
      const e3 = await appendAudit('config.change', { key: 'max_retries', from: 3, to: 5 });

      setEntries([
        { event: e1.event, hash: e1.hash.slice(0, 32) + '...' },
        { event: e2.event, hash: e2.hash.slice(0, 32) + '...' },
        { event: e3.event, hash: e3.hash.slice(0, 32) + '...' },
      ]);

      const result = await verifyAudit();
      setVerified(result.valid);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [privacy]);

  useEffect(() => { runDemo(); }, []);

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>HMAC-SHA256 hash chain -- each entry links to previous via prevHash</Text>

      {error && (
        <Text style={{ fontSize: 10, color: C.err }}>{`Audit error: ${error}`}</Text>
      )}

      {entries.map((e, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 10, color: C.accent, width: 100 }}>{e.event}</Text>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 8, color: C.sec }}>{e.hash}</Text>
          </Box>
        </Box>
      ))}

      {verified !== null && (
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: verified ? C.ok : C.err,
          }} />
          <Text style={{ fontSize: 11, color: verified ? C.ok : C.err, fontWeight: 'normal' }}>
            {verified ? 'Chain integrity verified -- no tampering detected' : 'Chain integrity BROKEN'}
          </Text>
        </Box>
      )}

      <Pressable onPress={runDemo}>
        <Box style={{ backgroundColor: C.info, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.bg, fontWeight: 'normal' }}>Re-run</Text>
        </Box>
      </Pressable>
    </>
  );
}

// ── File Integrity ───────────────────────────────────

function FileIntegrityDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, err: c.error, info: c.info };

  const privacy = usePrivacy();
  const filePath = '/etc/hostname';
  const [hash, setHash] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const h = await privacy.integrity.hashFile(filePath, 'sha256');
        setHash(h);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Lua FFI -- SHA-256 file hash for integrity verification</Text>

      <Box style={{ gap: 2, width: '100%' }}>
        <Text style={{ fontSize: 10, color: C.sec }}>File path:</Text>
        <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: C.info }}>{filePath}</Text>
        </Box>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: C.err }}>{`Hash error: ${error}`}</Text>
      )}

      {hash && (
        <Box style={{ gap: 2, width: '100%' }}>
          <Text style={{ fontSize: 10, color: C.ok, fontWeight: 'normal' }}>SHA-256 hash:</Text>
          <Box style={{ backgroundColor: C.bg, padding: 4, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: C.sec }}>{hash}</Text>
          </Box>
        </Box>
      )}
    </>
  );
}

// ── Utility Demos (sanitizeFilename, normalizeTimestamp) ──

function UtilityDemo() {
  const c = useThemeColors();
  const C = { bg: c.bg, dim: c.textDim, sec: c.textSecondary, ok: c.success, info: c.info, warn: c.warning };

  const filenames = [
    '../../../etc/passwd',
    './sneaky\x00hidden.txt',
    '  my document (final) [v2].pdf  ',
  ];

  const timestamps = [
    '2026-03-03T14:30:00.123Z',
    'March 3, 2026',
    new Date(2026, 2, 3, 10, 0, 0).toISOString(),
  ];

  return (
    <>
      <Text style={{ fontSize: 9, color: C.dim }}>Pure TypeScript -- path traversal prevention + timestamp normalization</Text>

      <Text style={{ fontSize: 10, color: C.info, fontWeight: 'normal' }}>sanitizeFilename()</Text>
      {filenames.map((f, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', width: '100%' }}>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 9, color: C.warn }}>{JSON.stringify(f)}</Text>
          </Box>
          <Text style={{ fontSize: 10, color: C.dim }}>{'->'}</Text>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 9, color: C.ok }}>{JSON.stringify(sanitizeFilename(f))}</Text>
          </Box>
        </Box>
      ))}

      <Text style={{ fontSize: 10, color: C.info, fontWeight: 'normal' }}>normalizeTimestamp()</Text>
      {timestamps.map((t, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', width: '100%' }}>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 9, color: C.sec }}>{String(t)}</Text>
          </Box>
          <Text style={{ fontSize: 10, color: C.dim }}>{'->'}</Text>
          <Box style={{ backgroundColor: C.bg, padding: 3, borderRadius: 3, flexGrow: 1 }}>
            <Text style={{ fontSize: 9, color: C.ok }}>{normalizeTimestamp(t)}</Text>
          </Box>
        </Box>
      ))}
    </>
  );
}

// ── Code Examples ────────────────────────────────────

function CodeBlock({ label, code, color }: { label: string; code: string[]; color?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.bg, borderRadius: 6, padding: 10, gap: 3, width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{label}</Text>
      {code.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: color || c.success }}>{line}</Text>
      ))}
    </Box>
  );
}

function UsageExamples() {
  return (
    <>
      <CodeBlock
        label="// PII detection + redaction (pure TS, sync)"
        code={[
          "import { detectPII, redactPII, maskValue } from '@reactjit/privacy';",
          "",
          "const matches = detectPII('Email: user@test.com');",
          "const safe = redactPII(text, { mask: true });",
          "const masked = maskValue('4111111111111111');",
        ]}
      />

      <CodeBlock
        label="// Shamir's Secret Sharing (Lua FFI)"
        code={[
          "const privacy = usePrivacy();",
          "const shares = await privacy.shamir.split('deadbeef', 5, 3);",
          "const secret = await privacy.shamir.combine(shares.slice(0, 3));",
        ]}
      />

      <CodeBlock
        label="// Whitespace steganography (pure TS)"
        code={[
          "import { stegEmbedWhitespace, stegExtractWhitespace } from '@reactjit/privacy';",
          "",
          "const hidden = stegEmbedWhitespace('normal text', 'secret');",
          "const recovered = stegExtractWhitespace(hidden);",
        ]}
      />

      <CodeBlock
        label="// Audit log with hash chain verification"
        code={[
          "const { audit } = usePrivacy();",
          "await audit.append('user.login', { userId: 'alice' });",
          "const { valid } = await audit.verify();",
        ]}
      />
    </>
  );
}

// ── Main Story ───────────────────────────────────────

export function PrivacyStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      <StorySection index={1} title="@reactjit/privacy">
        <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
          PII detection, data masking, steganography, Shamir SSS, HKDF, secure memory, encrypted storage, audit chains, file integrity -- privacy toolkit for ReactJIT.
        </Text>
      </StorySection>

      <StorySection index={2} title="PII Detection & Redaction">
        <PIIDemo />
      </StorySection>

      <StorySection index={3} title="Data Masking">
        <MaskDemo />
      </StorySection>

      <StorySection index={4} title="Whitespace Steganography">
        <StegDemo />
      </StorySection>

      <StorySection index={5} title="Algorithm Safety">
        <AlgorithmSafetyDemo />
      </StorySection>

      <StorySection index={6} title="Shamir's Secret Sharing">
        <ShamirDemo />
      </StorySection>

      <StorySection index={7} title="HKDF Key Derivation">
        <HKDFDemo />
      </StorySection>

      <StorySection index={8} title="Secure Memory">
        <SecureMemDemo />
      </StorySection>

      <StorySection index={9} title="Encrypted Store">
        <EncryptedStoreDemo />
      </StorySection>

      <StorySection index={10} title="Audit Log">
        <AuditDemo />
      </StorySection>

      <StorySection index={11} title="File Integrity">
        <FileIntegrityDemo />
      </StorySection>

      <StorySection index={12} title="Sanitization Utilities">
        <UtilityDemo />
      </StorySection>

      <StorySection index={13} title="Usage Examples">
        <UsageExamples />
      </StorySection>
    </StoryPage>
  );
}
