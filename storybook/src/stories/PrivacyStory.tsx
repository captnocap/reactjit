/**
 * Privacy — Package documentation page (Layout2 zigzag narrative).
 *
 * Visual demos for each privacy capability. All heavy crypto runs in C
 * via libsodium/OpenSSL FFI — these demos show the concepts visually.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  warn: 'rgba(245, 158, 11, 0.08)',
  warnBorder: 'rgba(245, 158, 11, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { usePrivacy } from '@reactjit/privacy'

const privacy = usePrivacy()
// privacy.sanitize.detectPII / redactPII / maskValue
// privacy.audit.create / append / verify
// privacy.safety.checkAlgorithmStrength / validateConfig`;

const PII_CODE = `const privacy = usePrivacy()
const matches = await privacy.sanitize.detectPII('Email: alice@acme.com SSN: 123-45-6789')
// [{type:'email', value:'alice@acme.com'}, {type:'ssn', ...}]

const safe = await privacy.sanitize.redactPII(text, { mask: true })
// "Email: *****@*******.*** SSN: ***-**-****"`;

const SHAMIR_CODE = `const shares = await privacy.shamir.split('deadbeef', 5, 3)
const secret = await privacy.shamir.combine([shares[0], shares[2], shares[4]])
// 'deadbeef' — any 3 of 5 recovers it`;

const NOISE_CODE = `const init = await privacy.noise.initiate(serverPubKey)
const resp = await privacy.noise.respond(serverPrivKey, init.message)
const cipher = await privacy.noise.send(init.sessionId, 'ping')
const plain  = await privacy.noise.receive(resp.sessionId, cipher)`;

const KEYRING_CODE = `const kr = await privacy.keyring.create('/keys.kr', 'master-pass')
await privacy.keyring.generateKey(kr, { type: 'x25519', label: 'session' })
await privacy.keyring.close(kr)
// Persists — wrong password rejects on reopen`;

const STEG_CODE = `const hidden = stegEmbedWhitespace('This looks normal.', 'SECRET')
// Visible text unchanged, zero-width chars injected between letters
const recovered = stegExtractWhitespace(hidden)  // 'SECRET'`;

const AUDIT_CODE = `const privacy = usePrivacy()
await privacy.audit.create('chain-key-hex')
await privacy.audit.append('user.login', { userId: 'alice' })
await privacy.audit.append('data.access', { table: 'users' })
const { valid } = await privacy.audit.verify()  // detects tampering`;

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
  );
}

// ── Band layout helpers ─────────────────────────────────

const BAND_STYLE = {
  flexDirection: 'row' as const,
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const TEXT_SIDE = { flexGrow: 1, flexBasis: 0, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const };

// ── Visual Demos ────────────────────────────────────────

function PIIDemo() {
  const c = useThemeColors();

  const detections = [
    { type: 'email', value: 'alice@acme.com', color: C.red, bg: 'rgba(243,139,168,0.15)' },
    { type: 'phone', value: '555-0123', color: C.peach, bg: 'rgba(250,179,135,0.15)' },
    { type: 'ssn', value: '123-45-6789', color: C.yellow, bg: 'rgba(249,226,175,0.15)' },
    { type: 'ipv4', value: '192.168.1.1', color: C.teal, bg: 'rgba(148,226,213,0.15)' },
    { type: 'credit', value: '4111...1111', color: C.mauve, bg: 'rgba(203,166,247,0.15)' },
  ];

  return (
    <Box style={{ gap: 6, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>{'detectPII() \u2192 finds + classifies:'}</Text>

      {detections.map(d => (
        <Box key={d.type} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Box style={{
            backgroundColor: d.bg,
            borderRadius: 3,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
            width: 44,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 8, color: d.color }}>{d.type}</Text>
          </Box>
          <Text style={{ fontSize: 10, color: d.color }}>{d.value}</Text>
        </Box>
      ))}

      <Text style={{ fontSize: 9, color: c.muted, paddingTop: 4 }}>{'redactPII() \u2192 masks in place:'}</Text>
      <Box style={{
        backgroundColor: c.surface,
        borderRadius: 6,
        padding: 8,
      }}>
        <Text style={{ fontSize: 10, color: c.muted }}>
          {'*****@***.*** | ***-**** | ***-**-****'}
        </Text>
      </Box>
    </Box>
  );
}

function ShamirDemo() {
  const c = useThemeColors();
  const used = [true, false, true, false, true]; // shares used for recovery
  const shareColors = [C.blue, C.green, C.peach, C.mauve, C.teal];

  return (
    <Box style={{ gap: 6, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      {/* Secret in */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 3,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ fontSize: 10, color: C.accent }}>{'deadbeef'}</Text>
        </Box>
        <Text style={{ fontSize: 8, color: c.muted }}>{'\u2192 split(5,3)'}</Text>
      </Box>

      {/* 5 shares — vertical list, compact */}
      <Box style={{ gap: 3, paddingLeft: 8 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <Box key={i} style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}>
            <Box style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: used[i] ? shareColors[i] : c.border,
            }} />
            <Text style={{
              fontSize: 9,
              color: used[i] ? shareColors[i] : c.muted,
            }}>{`share ${i + 1}`}</Text>
            {used[i] && (
              <Text style={{ fontSize: 8, color: c.muted }}>{'\u2713'}</Text>
            )}
          </Box>
        ))}
      </Box>

      {/* Recovered */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 8, color: c.muted }}>{'any 3 \u2192'}</Text>
        <Box style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: C.green,
        }} />
        <Box style={{
          backgroundColor: 'rgba(166,227,161,0.12)',
          borderRadius: 3,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ fontSize: 10, color: C.green }}>{'deadbeef'}</Text>
        </Box>
      </Box>

      <Text style={{ fontSize: 8, color: c.muted }}>{'GF(256) / 0x11B / gen 3'}</Text>
    </Box>
  );
}

function NoiseDemo() {
  const c = useThemeColors();

  const steps = [
    { from: 'Client', to: 'Server', label: 'ephemeral X25519 pubkey', color: C.blue },
    { from: 'Server', to: 'Client', label: 'session established', color: C.green },
    { from: 'Client', to: 'Server', label: 'AEAD ciphertext', color: C.mauve },
    { from: 'Server', to: 'Client', label: 'AEAD ciphertext', color: C.peach },
  ];

  return (
    <Box style={{ gap: 6, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      {/* Endpoints header */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4 }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} />
          <Text style={{ fontSize: 10, color: C.blue }}>{'Client'}</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: C.teal }}>{'Server'}</Text>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal }} />
        </Box>
      </Box>

      {/* Message arrows */}
      {steps.map((s, i) => (
        <Box key={i} style={{
          backgroundColor: `${s.color}15`,
          borderRadius: 4,
          padding: 6,
          paddingLeft: 10,
          paddingRight: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Text style={{ fontSize: 10, color: s.color }}>
            {s.from === 'Client' ? '\u2192' : '\u2190'}
          </Text>
          <Text style={{ fontSize: 9, color: s.color }}>{s.label}</Text>
        </Box>
      ))}

      {/* Features */}
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
        {['forward secrecy', 'replay protection', 'HKDF session keys'].map(f => (
          <Box key={f} style={{
            backgroundColor: c.surface,
            borderRadius: 3,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
            <Text style={{ fontSize: 8, color: c.muted }}>{f}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function KeyringDemo() {
  const c = useThemeColors();

  const keys = [
    { label: 'session-key', type: 'x25519', status: 'active', color: C.green },
    { label: 'signing-key', type: 'ed25519', status: 'active', color: C.green },
    { label: 'backup-key', type: 'x25519', status: 'rotated', color: C.yellow },
    { label: 'legacy-key', type: 'ed25519', status: 'revoked', color: C.red },
  ];

  return (
    <Box style={{ gap: 6, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Box style={{
        backgroundColor: c.surface,
        borderRadius: 6,
        padding: 10,
        gap: 6,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Image src="lock" style={{ width: 10, height: 10 }} tintColor={C.accent} />
          <Text style={{ fontSize: 10, color: c.text }}>{'keys.kr'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'AEAD encrypted'}</Text>
        </Box>

        {keys.map(k => (
          <Box key={k.label} style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 16,
          }}>
            <Box style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: k.color,
            }} />
            <Text style={{ fontSize: 10, color: c.text, width: 90 }}>{k.label}</Text>
            <Box style={{
              backgroundColor: `${k.color}22`,
              borderRadius: 3,
              paddingLeft: 5,
              paddingRight: 5,
              paddingTop: 1,
              paddingBottom: 1,
            }}>
              <Text style={{ fontSize: 8, color: k.color }}>{k.type}</Text>
            </Box>
            <Text style={{ fontSize: 8, color: k.color }}>{k.status}</Text>
          </Box>
        ))}
      </Box>
      <Text style={{ fontSize: 9, color: c.muted }}>
        {'generate \u2192 store \u2192 rotate \u2192 revoke \u2192 close/reopen'}
      </Text>
    </Box>
  );
}

function SecureMemoryDemo() {
  const c = useThemeColors();

  const stages = [
    { label: 'alloc', desc: 'sodium_malloc + guard pages', icon: '\u25cb', color: C.blue },
    { label: 'write', desc: 'cafebabe12345678', icon: '\u25cf', color: C.green },
    { label: 'protect', desc: 'noaccess mode', icon: '\u25a0', color: C.yellow },
    { label: 'read', desc: 'managed read-through', icon: '\u25b6', color: C.mauve },
    { label: 'free', desc: 'sodium_memzero + free', icon: '\u2715', color: C.red },
  ];

  return (
    <Box style={{ gap: 4, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingBottom: 4,
      }}>
        <Text style={{ fontSize: 9, color: c.muted }}>{'handle: opaque int'}</Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 3,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
        }}>
          <Text style={{ fontSize: 10, color: C.accent }}>{'#7'}</Text>
        </Box>
        <Text style={{ fontSize: 9, color: c.muted }}>{'(TS never sees raw bytes)'}</Text>
      </Box>

      {stages.map((s, i) => (
        <Box key={s.label} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 4,
        }}>
          <Text style={{ fontSize: 10, color: s.color }}>{s.icon}</Text>
          <Text style={{ fontSize: 10, color: s.color, width: 50 }}>{s.label}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{s.desc}</Text>
          {i < stages.length - 1 && (
            <Text style={{ fontSize: 8, color: c.border }}>{''}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

function StegDemo() {
  const c = useThemeColors();
  const carrier = 'This looks normal.';
  const secret = 'TOP SECRET';
  // First N letters carry hidden bits (1 bit per letter)
  const bitCount = secret.length * 8;

  return (
    <Box style={{ gap: 8, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      {/* Carrier text — looks innocent */}
      <Text style={{ fontSize: 9, color: c.muted }}>{'carrier text (visible):'}</Text>
      <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 10 }}>
        <Text style={{ fontSize: 12, color: c.text }}>{carrier}</Text>
      </Box>

      {/* Reveal: show which letters carry bits */}
      <Text style={{ fontSize: 9, color: c.muted }}>{'what is actually there:'}</Text>
      <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 10, gap: 6 }}>
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {carrier.split('').map((ch, i) => (
            <Text key={i} style={{
              fontSize: 12,
              color: i < bitCount ? C.mauve : c.text,
              backgroundColor: i < bitCount ? 'rgba(203,166,247,0.12)' : 'transparent',
            }}>{ch}</Text>
          ))}
        </Box>
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Box style={{ width: 8, height: 3, backgroundColor: C.mauve, borderRadius: 1 }} />
          <Text style={{ fontSize: 8, color: C.mauve }}>
            {'zero-width U+200B/U+200C injected between highlighted chars'}
          </Text>
        </Box>
      </Box>

      {/* Extracted */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 9, color: c.muted }}>{'extract \u2192'}</Text>
        <Box style={{
          backgroundColor: 'rgba(203,166,247,0.15)',
          borderRadius: 4,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 4,
          paddingBottom: 4,
        }}>
          <Text style={{ fontSize: 12, color: C.mauve }}>{secret}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function AuditDemo() {
  const c = useThemeColors();

  const entries = [
    { event: 'user.login', data: 'alice', hash: 'a3f1..', color: C.blue },
    { event: 'data.access', data: 'users', hash: '7b02..', color: C.green },
    { event: 'data.export', data: 'csv', hash: 'c8d9..', color: C.peach },
    { event: 'user.logout', data: 'alice', hash: '12ef..', color: C.mauve },
  ];

  return (
    <Box style={{ gap: 4, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      {entries.map((e, i) => (
        <Box key={i}>
          <Box style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: `${e.color}10`,
            borderRadius: 4,
            padding: 6,
            paddingLeft: 10,
            paddingRight: 10,
          }}>
            <Text style={{ fontSize: 9, color: e.color, width: 80 }}>{e.event}</Text>
            <Text style={{ fontSize: 9, color: c.muted, flexGrow: 1 }}>{e.data}</Text>
            <Text style={{ fontSize: 8, color: c.border }}>{`hmac: ${e.hash}`}</Text>
          </Box>
          {i < entries.length - 1 && (
            <Box style={{ paddingLeft: 20 }}>
              <Text style={{ fontSize: 8, color: c.border }}>{'\u2502 chain'}</Text>
            </Box>
          )}
        </Box>
      ))}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
        <Text style={{ fontSize: 9, color: C.green }}>{'verifyAudit() \u2192 chain intact'}</Text>
      </Box>
    </Box>
  );
}

function AlgoSafetyDemo() {
  const c = useThemeColors();

  const algos = [
    { name: 'xchacha20-poly1305', strength: 'strong', color: C.green },
    { name: 'aes-256-gcm', strength: 'strong', color: C.green },
    { name: 'aes-128-gcm', strength: 'acceptable', color: C.yellow },
    { name: 'sha1', strength: 'weak', color: C.peach },
    { name: 'md5', strength: 'broken', color: C.red },
    { name: 'des', strength: 'broken', color: C.red },
  ];

  return (
    <Box style={{ gap: 4, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      {algos.map(a => (
        <Box key={a.name} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Box style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: a.color,
          }} />
          <Text style={{ fontSize: 10, color: c.text, width: 130 }}>{a.name}</Text>
          <Box style={{
            backgroundColor: `${a.color}22`,
            borderRadius: 3,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 1,
            paddingBottom: 1,
          }}>
            <Text style={{ fontSize: 8, color: a.color }}>{a.strength}</Text>
          </Box>
        </Box>
      ))}
      <Text style={{ fontSize: 8, color: c.muted, paddingTop: 4 }}>
        {'RECOMMENDED_DEFAULTS: xchacha20 / argon2id / blake3 / 32-byte keys'}
      </Text>
    </Box>
  );
}

function EnvelopeDemo() {
  const c = useThemeColors();

  return (
    <Box style={{ gap: 8, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
      {/* Stacked layers — deepest = most nested */}
      <Box style={{
        backgroundColor: 'rgba(250,179,135,0.10)',
        borderRadius: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 10,
        gap: 6,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Image src="key" style={{ width: 9, height: 9 }} tintColor={C.peach} />
          <Text style={{ fontSize: 9, color: C.peach }}>{'KEK (your key)'}</Text>
        </Box>

        <Box style={{
          backgroundColor: 'rgba(137,180,250,0.10)',
          borderRadius: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 6,
          paddingBottom: 8,
          gap: 4,
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image src="key" style={{ width: 8, height: 8 }} tintColor={C.blue} />
            <Text style={{ fontSize: 9, color: C.blue }}>{'DEK (random per-op)'}</Text>
          </Box>

          <Box style={{
            backgroundColor: c.surface,
            borderRadius: 4,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
          }}>
            <Text style={{ fontSize: 9, color: c.muted }}>{'your data \u2014 XChaCha20-Poly1305'}</Text>
          </Box>
        </Box>
      </Box>

      <Text style={{ fontSize: 8, color: c.muted }}>
        {'fresh DEK per encrypt \u2014 same plaintext never produces same ciphertext'}
      </Text>
    </Box>
  );
}

// ── PrivacyStory ─────────────────────────────────────────

export function PrivacyStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="shield" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'usePrivacy'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/privacy'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Encryption, PII, keys, channels'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Privacy toolkit: PII detection, Shamir secret sharing, Noise-NK channels, encrypted keyrings, steganography.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Two tiers: Lua FFI for all crypto and string operations (PII regex, policy, audit — via libsodium, OpenSSL), and shell-out for battle-tested tools (GPG, exiftool). TypeScript is a one-liner hook.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Install: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'usePrivacy() returns all operations namespaced by domain. Individual functions can also be imported directly.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── PII: demo | text ── */}
        <Box style={BAND_STYLE}>
          <PIIDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="eye">{'PII DETECTION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Lua pattern scanner. Finds emails, phone numbers, SSNs, IPv4/v6, and credit cards with match boundaries for surgical redaction. All logic in LuaJIT — zero JS compute.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={PII_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Shamir: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="key">{'SHAMIR SECRET SHARING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Split a secret into N shares where any K can reconstruct it. Fewer than K shares reveal zero information. Bordered shares are the 3 used for recovery.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={SHAMIR_CODE} />
          </Box>
          <ShamirDemo />
        </Box>

        <Divider />

        {/* ── Callout: crypto tiers ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All crypto runs in C via LuaJIT FFI. TypeScript never touches raw secret bytes \u2014 secure memory uses opaque integer handles.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Envelope: demo | text ── */}
        <Box style={BAND_STYLE}>
          <EnvelopeDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="lock">{'ENVELOPE ENCRYPTION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Two-layer encryption: a random DEK encrypts data, then the DEK itself is encrypted with your KEK. XChaCha20-Poly1305 AEAD throughout.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Noise: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="wifi">{'NOISE-NK CHANNELS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Noise-NK secure channel: ephemeral X25519 DH with HKDF-derived session keys. Bidirectional encrypted messaging with replay protection built in.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={NOISE_CODE} />
          </Box>
          <NoiseDemo />
        </Box>

        <Divider />

        {/* ── Callout: secure memory ── */}
        <Box style={{
          backgroundColor: C.warn,
          borderLeftWidth: 3,
          borderColor: C.warnBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.warnBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Secure memory uses sodium_malloc with guard pages. Raw secret bytes never enter the JS heap or GC.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Keyring: demo | text ── */}
        <Box style={BAND_STYLE}>
          <KeyringDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="database">{'ENCRYPTED KEYRING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Password-protected keyring files. Generate, store, rotate, and revoke Ed25519/X25519 keys. Persists across close/reopen.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={KEYRING_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Secure Memory: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="shield">{'SECURE MEMORY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Allocate secrets in sodium_malloc pages with guard-page overflow protection. Handle lifecycle is strictly enforced \u2014 read after free throws.'}
            </Text>
          </Box>
          <SecureMemoryDemo />
        </Box>

        <Divider />

        {/* ── Steg: demo | text ── */}
        <Box style={BAND_STYLE}>
          <StegDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="eye">{'STEGANOGRAPHY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Hide data in plain sight. Whitespace steganography encodes binary as zero-width Unicode between visible carrier text. Image steganography uses LSB encoding via Love2D ImageData.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={STEG_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Audit: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="terminal">{'AUDIT LOG'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Tamper-evident append-only log using HMAC-SHA256 hash chains. Each entry links to the previous. verifyAudit() walks the chain and detects any modification.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={AUDIT_CODE} />
          </Box>
          <AuditDemo />
        </Box>

        <Divider />

        {/* ── Safety: demo | text ── */}
        <Box style={BAND_STYLE}>
          <AlgoSafetyDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="settings">{'ALGORITHM SAFETY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Lua strength checker. Rates algorithms as strong/acceptable/weak/broken with deprecation flags. RECOMMENDED_DEFAULTS live in Lua — xchacha20 / argon2id / blake3 / 32-byte keys.'}
            </Text>
          </Box>
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="shield" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Privacy'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
