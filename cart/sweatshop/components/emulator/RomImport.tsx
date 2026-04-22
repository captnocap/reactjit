import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { parseInesHeader, lookupKnownByCrc } from './useRomMetadata';
import { findRomByCrc, saveRom, type RomEntry } from './useRomLibrary';

// Add a ROM to the library from an on-disk file. Two entry paths:
//   1. Paste an absolute path → Import.
//   2. Click "Browse…" → __exec runs `zenity --file-selection` (KDE/GTK
//      fallback via kdialog). Returns a path the user picked.
// Either way: `base64 "$path"` via __exec gets the bytes, header is
// parsed, and an entry is saved. We don't keep the bytes around — the
// library stores path + metadata and re-reads the file on play.

function sh(cmd: string): string | null {
  const h: any = globalThis as any;
  if (typeof h.__exec !== 'function') return null;
  try { const out = h.__exec(cmd); return typeof out === 'string' ? out : String(out ?? ''); } catch { return null; }
}

function pickFileViaDialog(): string | null {
  // Try zenity first (most GTK/Wayland desktops have it), then kdialog.
  const z = sh(`zenity --file-selection --file-filter='NES ROM | *.nes' --title='Select NES ROM' 2>/dev/null`);
  if (z && z.trim()) return z.trim();
  const k = sh(`kdialog --getopenfilename "$HOME" "NES ROM (*.nes)" 2>/dev/null`);
  if (k && k.trim()) return k.trim();
  return null;
}

function base64Decode(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map: Record<string, number> = {};
  for (let i = 0; i < chars.length; i++) map[chars[i]] = i;
  let len = clean.length;
  let bytes = new Uint8Array(len * 0.75);
  if (clean[len - 1] === '=') bytes = bytes.slice(0, bytes.length - 1);
  if (clean[len - 2] === '=') bytes = bytes.slice(0, bytes.length - 1);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = map[clean[i]], e2 = map[clean[i + 1]], e3 = map[clean[i + 2]], e4 = map[clean[i + 3]];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 !== undefined) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (e4 !== undefined) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

function readROM(path: string): Uint8Array | null {
  const out = sh(`base64 -w 0 "${path.replace(/"/g, '\\"')}"`);
  if (!out) return null;
  const trimmed = out.trim();
  if (!trimmed) return null;
  return base64Decode(trimmed);
}

function baseName(p: string): string {
  const slash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  const base = slash >= 0 ? p.slice(slash + 1) : p;
  return base.replace(/\.nes$/i, '');
}

export function RomImport(props: { onImported?: (entry: RomEntry) => void }) {
  const [pathInput, setPathInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const importFromPath = (path: string) => {
    setError(null);
    setWorking(true);
    const bytes = readROM(path);
    setWorking(false);
    if (!bytes || bytes.length < 16) { setError('Could not read file: ' + path); return; }
    const meta = parseInesHeader(bytes);
    if (!meta.valid) { setError('Not a valid iNES ROM: ' + path); return; }
    const existing = findRomByCrc(meta.crc32);
    if (existing) {
      // Update path in case the user moved the file; otherwise leave stats.
      const updated: RomEntry = { ...existing, path };
      saveRom(updated);
      props.onImported?.(updated);
      setPathInput('');
      return;
    }
    const known = lookupKnownByCrc(meta.crc32);
    const entry: RomEntry = {
      id: meta.crc32 + ':' + Date.now().toString(36),
      path,
      displayName: known?.title || baseName(path),
      crc32: meta.crc32,
      format: meta.format === 'invalid' ? 'iNES' : meta.format,
      mapperId: meta.mapperId,
      prgSize: meta.prgSize,
      chrSize: meta.chrSize,
      hasBattery: meta.hasBattery,
      importedAt: Date.now(),
      lastPlayedAt: null,
      playCountSec: 0,
      launchCount: 0,
      favorite: false,
      region: known?.region,
      year: known?.year,
    };
    saveRom(entry);
    props.onImported?.(entry);
    setPathInput('');
  };

  return (
    <Col style={{
      gap: 8, padding: TOKENS.padLoose,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>ADD ROM</Text>
      <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextInput
          value={pathInput}
          onChangeText={setPathInput}
          placeholder="/absolute/path/to/game.nes"
          style={{
            flexGrow: 1, flexBasis: 280, minWidth: 220, height: 26,
            paddingLeft: 8, paddingRight: 8,
            borderWidth: 1, borderColor: COLORS.border,
            borderRadius: TOKENS.radiusXs,
            backgroundColor: COLORS.panelBg,
            fontFamily: TOKENS.fontMono, fontSize: TOKENS.fontXs,
            color: COLORS.text,
          }}
        />
        <Pressable onPress={() => { const p = pickFileViaDialog(); if (p) importFromPath(p); else setError('No system file dialog available (zenity/kdialog).'); }}>
          <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>Browse…</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => { const p = pathInput.trim(); if (p) importFromPath(p); else setError('Enter a path first.'); }}>
          <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{working ? 'Reading…' : 'Import'}</Text>
          </Box>
        </Pressable>
      </Row>
      {error ? (
        <Text fontSize={TOKENS.fontXs} color={COLORS.red}>{error}</Text>
      ) : (
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>
          Library stores the path + header metadata only. Bytes stay on disk and are re-read on every play.
        </Text>
      )}
    </Col>
  );
}
