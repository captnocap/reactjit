/**
 * Privacy — Package documentation page (Layout2 zigzag narrative).
 *
 * Visual demos for each privacy capability. All heavy crypto runs in C
 * via libsodium/OpenSSL FFI — these demos show the concepts visually.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

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
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
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
    <S.GrowCenterAlign style={{ gap: 6, flexBasis: 0 }}>
      <S.StoryCap>{'detectPII() \u2192 finds + classifies:'}</S.StoryCap>

      {detections.map(d => (
        <S.RowCenterG8 key={d.type}>
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
        </S.RowCenterG8>
      ))}

      <S.StoryCap style={{ paddingTop: 4 }}>{'redactPII() \u2192 masks in place:'}</S.StoryCap>
      <S.SurfaceR6 style={{ padding: 8 }}>
        <S.StoryMuted>
          {'*****@***.*** | ***-**** | ***-**-****'}
        </S.StoryMuted>
      </S.SurfaceR6>
    </S.GrowCenterAlign>
  );
}

function ShamirDemo() {
  const c = useThemeColors();
  const used = [true, false, true, false, true]; // shares used for recovery
  const shareColors = [C.blue, C.green, C.peach, C.mauve, C.teal];

  return (
    <S.GrowCenterAlign style={{ gap: 6, flexBasis: 0 }}>
      {/* Secret in */}
      <S.RowCenterG6>
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
        <S.StoryTiny>{'\u2192 split(5,3)'}</S.StoryTiny>
      </S.RowCenterG6>

      {/* 5 shares — vertical list, compact */}
      <Box style={{ gap: 3, paddingLeft: 8 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <S.RowCenterG6 key={i}>
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
              <S.StoryTiny>{'\u2713'}</S.StoryTiny>
            )}
          </S.RowCenterG6>
        ))}
      </Box>

      {/* Recovered */}
      <S.RowCenterG6>
        <S.StoryTiny>{'any 3 \u2192'}</S.StoryTiny>
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
      </S.RowCenterG6>

      <S.StoryTiny>{'GF(256) / 0x11B / gen 3'}</S.StoryTiny>
    </S.GrowCenterAlign>
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
    <S.GrowCenterAlign style={{ gap: 6, flexBasis: 0 }}>
      {/* Endpoints header */}
      <S.RowSpaceBetween style={{ paddingLeft: 4, paddingRight: 4 }}>
        <S.RowCenterG6>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} />
          <Text style={{ fontSize: 10, color: C.blue }}>{'Client'}</Text>
        </S.RowCenterG6>
        <S.RowCenterG6>
          <Text style={{ fontSize: 10, color: C.teal }}>{'Server'}</Text>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal }} />
        </S.RowCenterG6>
      </S.RowSpaceBetween>

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
      <S.RowG6 style={{ flexWrap: 'wrap', paddingTop: 4 }}>
        {['forward secrecy', 'replay protection', 'HKDF session keys'].map(f => (
          <S.StoryChip key={f}>
            <S.StoryTiny>{f}</S.StoryTiny>
          </S.StoryChip>
        ))}
      </S.RowG6>
    </S.GrowCenterAlign>
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
    <S.GrowCenterAlign style={{ gap: 6, flexBasis: 0 }}>
      <S.SurfaceR6 style={{ padding: 10, gap: 6 }}>
        <S.RowCenterG6>
          <S.StorySectionIcon src="lock" tintColor={C.accent} />
          <S.StoryBody>{'keys.kr'}</S.StoryBody>
          <S.StoryTiny>{'AEAD encrypted'}</S.StoryTiny>
        </S.RowCenterG6>

        {keys.map(k => (
          <S.RowCenterG8 key={k.label} style={{ paddingLeft: 16 }}>
            <Box style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: k.color,
            }} />
            <S.StoryBody style={{ width: 90 }}>{k.label}</S.StoryBody>
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
          </S.RowCenterG8>
        ))}
      </S.SurfaceR6>
      <S.StoryCap>
        {'generate \u2192 store \u2192 rotate \u2192 revoke \u2192 close/reopen'}
      </S.StoryCap>
    </S.GrowCenterAlign>
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
    <S.GrowCenterAlign style={{ gap: 4, flexBasis: 0 }}>
      <S.RowCenterG6 style={{ paddingBottom: 4 }}>
        <S.StoryCap>{'handle: opaque int'}</S.StoryCap>
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
        <S.StoryCap>{'(TS never sees raw bytes)'}</S.StoryCap>
      </S.RowCenterG6>

      {stages.map((s, i) => (
        <S.RowCenterG8 key={s.label} style={{ paddingLeft: 4 }}>
          <Text style={{ fontSize: 10, color: s.color }}>{s.icon}</Text>
          <Text style={{ fontSize: 10, color: s.color, width: 50 }}>{s.label}</Text>
          <S.StoryCap>{s.desc}</S.StoryCap>
          {i < stages.length - 1 && (
            <Text style={{ fontSize: 8, color: c.border }}>{''}</Text>
          )}
        </S.RowCenterG8>
      ))}
    </S.GrowCenterAlign>
  );
}

function StegDemo() {
  const c = useThemeColors();
  const carrier = 'This looks normal.';
  const secret = 'TOP SECRET';
  // First N letters carry hidden bits (1 bit per letter)
  const bitCount = secret.length * 8;

  return (
    <S.StoryHalf>
      {/* Carrier text — looks innocent */}
      <S.StoryCap>{'carrier text (visible):'}</S.StoryCap>
      <S.SurfaceR6 style={{ padding: 10 }}>
        <Text style={{ fontSize: 12, color: c.text }}>{carrier}</Text>
      </S.SurfaceR6>

      {/* Reveal: show which letters carry bits */}
      <S.StoryCap>{'what is actually there:'}</S.StoryCap>
      <S.SurfaceR6 style={{ padding: 10, gap: 6 }}>
        <S.RowWrap>
          {carrier.split('').map((ch, i) => (
            <Text key={i} style={{
              fontSize: 12,
              color: i < bitCount ? C.mauve : c.text,
              backgroundColor: i < bitCount ? 'rgba(203,166,247,0.12)' : 'transparent',
            }}>{ch}</Text>
          ))}
        </S.RowWrap>
        <S.RowCenterG4>
          <Box style={{ width: 8, height: 3, backgroundColor: C.mauve, borderRadius: 1 }} />
          <Text style={{ fontSize: 8, color: C.mauve }}>
            {'zero-width U+200B/U+200C injected between highlighted chars'}
          </Text>
        </S.RowCenterG4>
      </S.SurfaceR6>

      {/* Extracted */}
      <S.RowCenterG8>
        <S.StoryCap>{'extract \u2192'}</S.StoryCap>
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
      </S.RowCenterG8>
    </S.StoryHalf>
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
    <S.GrowCenterAlign style={{ gap: 4, flexBasis: 0 }}>
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
            <S.StoryCap style={{ flexGrow: 1 }}>{e.data}</S.StoryCap>
            <Text style={{ fontSize: 8, color: c.border }}>{`hmac: ${e.hash}`}</Text>
          </Box>
          {i < entries.length - 1 && (
            <Box style={{ paddingLeft: 20 }}>
              <Text style={{ fontSize: 8, color: c.border }}>{'\u2502 chain'}</Text>
            </Box>
          )}
        </Box>
      ))}
      <S.RowCenterG6 style={{ paddingTop: 4 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
        <Text style={{ fontSize: 9, color: C.green }}>{'verifyAudit() \u2192 chain intact'}</Text>
      </S.RowCenterG6>
    </S.GrowCenterAlign>
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
    <S.GrowCenterAlign style={{ gap: 4, flexBasis: 0 }}>
      {algos.map(a => (
        <S.RowCenterG8 key={a.name}>
          <Box style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: a.color,
          }} />
          <S.StoryBody style={{ width: 130 }}>{a.name}</S.StoryBody>
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
        </S.RowCenterG8>
      ))}
      <S.StoryTiny style={{ paddingTop: 4 }}>
        {'RECOMMENDED_DEFAULTS: xchacha20 / argon2id / blake3 / 32-byte keys'}
      </S.StoryTiny>
    </S.GrowCenterAlign>
  );
}

function EnvelopeDemo() {
  const c = useThemeColors();

  return (
    <S.StoryHalf>
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
        <S.RowCenterG6>
          <Image src="key" style={{ width: 9, height: 9 }} tintColor={C.peach} />
          <Text style={{ fontSize: 9, color: C.peach }}>{'KEK (your key)'}</Text>
        </S.RowCenterG6>

        <Box style={{
          backgroundColor: 'rgba(137,180,250,0.10)',
          borderRadius: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 6,
          paddingBottom: 8,
          gap: 4,
        }}>
          <S.RowCenterG6>
            <Image src="key" style={{ width: 8, height: 8 }} tintColor={C.blue} />
            <Text style={{ fontSize: 9, color: C.blue }}>{'DEK (random per-op)'}</Text>
          </S.RowCenterG6>

          <S.PadV6 style={{ backgroundColor: c.surface, borderRadius: 4, paddingLeft: 10, paddingRight: 10 }}>
            <S.StoryCap>{'your data \u2014 XChaCha20-Poly1305'}</S.StoryCap>
          </S.PadV6>
        </Box>
      </Box>

      <S.StoryTiny>
        {'fresh DEK per encrypt \u2014 same plaintext never produces same ciphertext'}
      </S.StoryTiny>
    </S.StoryHalf>
  );
}

// ── PrivacyStory ─────────────────────────────────────────

export function PrivacyStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="shield" tintColor={C.accent} />
        <S.StoryTitle>
          {'usePrivacy'}
        </S.StoryTitle>
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
        <S.StoryMuted>
          {'Encryption, PII, keys, channels'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
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
          <S.StoryHeadline>
            {'Privacy toolkit: PII detection, Shamir secret sharing, Noise-NK channels, encrypted keyrings, steganography.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Two tiers: Lua FFI for all crypto and string operations (PII regex, policy, audit — via libsodium, OpenSSL), and shell-out for battle-tested tools (GPG, exiftool). TypeScript is a one-liner hook.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Install: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'usePrivacy() returns all operations namespaced by domain. Individual functions can also be imported directly.'}
            </S.StoryBody>
          </Box>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── PII: demo | text ── */}
        <Box style={BAND_STYLE}>
          <PIIDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="eye">{'PII DETECTION'}</SectionLabel>
            <S.StoryBody>
              {'Lua pattern scanner. Finds emails, phone numbers, SSNs, IPv4/v6, and credit cards with match boundaries for surgical redaction. All logic in LuaJIT — zero JS compute.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PII_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Shamir: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="key">{'SHAMIR SECRET SHARING'}</SectionLabel>
            <S.StoryBody>
              {'Split a secret into N shares where any K can reconstruct it. Fewer than K shares reveal zero information. Bordered shares are the 3 used for recovery.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SHAMIR_CODE} />
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
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'All crypto runs in C via LuaJIT FFI. TypeScript never touches raw secret bytes \u2014 secure memory uses opaque integer handles.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Envelope: demo | text ── */}
        <Box style={BAND_STYLE}>
          <EnvelopeDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="lock">{'ENVELOPE ENCRYPTION'}</SectionLabel>
            <S.StoryBody>
              {'Two-layer encryption: a random DEK encrypts data, then the DEK itself is encrypted with your KEK. XChaCha20-Poly1305 AEAD throughout.'}
            </S.StoryBody>
          </Box>
        </Box>

        <Divider />

        {/* ── Noise: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="wifi">{'NOISE-NK CHANNELS'}</SectionLabel>
            <S.StoryBody>
              {'Noise-NK secure channel: ephemeral X25519 DH with HKDF-derived session keys. Bidirectional encrypted messaging with replay protection built in.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={NOISE_CODE} />
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
          <S.StoryInfoIcon src="info" tintColor={C.warnBorder} />
          <S.StoryBody>
            {'Secure memory uses sodium_malloc with guard pages. Raw secret bytes never enter the JS heap or GC.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Keyring: demo | text ── */}
        <Box style={BAND_STYLE}>
          <KeyringDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="database">{'ENCRYPTED KEYRING'}</SectionLabel>
            <S.StoryBody>
              {'Password-protected keyring files. Generate, store, rotate, and revoke Ed25519/X25519 keys. Persists across close/reopen.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={KEYRING_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Secure Memory: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="shield">{'SECURE MEMORY'}</SectionLabel>
            <S.StoryBody>
              {'Allocate secrets in sodium_malloc pages with guard-page overflow protection. Handle lifecycle is strictly enforced \u2014 read after free throws.'}
            </S.StoryBody>
          </Box>
          <SecureMemoryDemo />
        </Box>

        <Divider />

        {/* ── Steg: demo | text ── */}
        <Box style={BAND_STYLE}>
          <StegDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="eye">{'STEGANOGRAPHY'}</SectionLabel>
            <S.StoryBody>
              {'Hide data in plain sight. Whitespace steganography encodes binary as zero-width Unicode between visible carrier text. Image steganography uses LSB encoding via Love2D ImageData.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={STEG_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Audit: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="terminal">{'AUDIT LOG'}</SectionLabel>
            <S.StoryBody>
              {'Tamper-evident append-only log using HMAC-SHA256 hash chains. Each entry links to the previous. verifyAudit() walks the chain and detects any modification.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={AUDIT_CODE} />
          </Box>
          <AuditDemo />
        </Box>

        <Divider />

        {/* ── Safety: demo | text ── */}
        <Box style={BAND_STYLE}>
          <AlgoSafetyDemo />
          <Box style={TEXT_SIDE}>
            <SectionLabel icon="settings">{'ALGORITHM SAFETY'}</SectionLabel>
            <S.StoryBody>
              {'Lua strength checker. Rates algorithms as strong/acceptable/weak/broken with deprecation flags. RECOMMENDED_DEFAULTS live in Lua — xchacha20 / argon2id / blake3 / 32-byte keys.'}
            </S.StoryBody>
          </Box>
        </Box>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="shield" />
        <S.StoryBreadcrumbActive>{'Privacy'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
