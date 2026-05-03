import { Box, ScrollView, Text } from '@reactjit/runtime/primitives';

const COLORS = {
  bg: '#101114',
  panel: '#17191f',
  panel2: '#20232b',
  rule: '#333743',
  text: '#f1f3f7',
  dim: '#a8afbd',
  faint: '#747d8f',
  accent: '#7cc4ff',
  warn: '#ffd27a',
};

const FAMILIES = [
  { label: 'Runtime default', family: undefined },
  { label: 'sans-serif', family: 'sans-serif' },
  { label: 'serif', family: 'serif' },
  { label: 'monospace', family: 'monospace' },
  { label: 'DejaVu Sans', family: 'DejaVu Sans' },
  { label: 'Noto Sans', family: 'Noto Sans' },
  { label: 'Arial', family: 'Arial' },
  { label: 'Helvetica', family: 'Helvetica' },
  { label: 'Times New Roman', family: 'Times New Roman' },
  { label: 'Courier New', family: 'Courier New' },
  { label: 'Segoe UI', family: 'Segoe UI' },
  { label: 'Inter', family: 'Inter' },
  { label: 'SF Pro Text', family: 'SF Pro Text' },
];

const SIZES = [9, 11, 13, 16, 20, 28, 40];

const SPECIMENS = [
  'Sphinx of black quartz, judge my vow.',
  'Hamburgefonts ivylike: agile UI rhythm at small sizes.',
  '0123456789  1Il|  0OoQ  rn m  ce ae ffi',
  'The quick brown fox jumps over 13 lazy dogs.',
  '.,:;!?()[]{} /\\ +-*= #$%& @',
];

function typeStyle(family: string | undefined, size: number, extra: Record<string, any> = {}) {
  return {
    fontFamily: family,
    fontSize: size,
    color: COLORS.text,
    lineHeight: Math.round(size * 1.35),
    ...extra,
  };
}

function Label({ children }: { children: any }) {
  return (
    <Text style={{ fontSize: 11, color: COLORS.faint, fontWeight: 700, lineHeight: 15 }}>
      {children}
    </Text>
  );
}

function Header() {
  return (
    <Box style={{ flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      <Text style={{ fontSize: 34, lineHeight: 42, fontWeight: 700, color: COLORS.text }}>
        Font Lab
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 18, color: COLORS.dim, maxWidth: 880 }}>
        Common font-family names rendered at UI sizes. Rows include ambiguous glyphs,
        punctuation, numerals, lowercase rhythm, and headline scale.
      </Text>
      <Box style={{
        marginTop: 8,
        paddingLeft: 12, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
        backgroundColor: '#2a2418',
        borderWidth: 1,
        borderColor: '#6b5527',
      }}>
        <Text style={{ fontSize: 12, lineHeight: 17, color: COLORS.warn }}>
          If every row looks identical, the host is ignoring fontFamily. That is useful signal.
        </Text>
      </Box>
    </Box>
  );
}

function SizeStrip({ family }: { family: string | undefined }) {
  return (
    <Box style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
      {SIZES.map((size) => (
        <Box
          key={size}
          style={{
            width: size >= 28 ? 230 : 160,
            minHeight: size >= 28 ? 74 : 48,
            paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
            backgroundColor: COLORS.panel2,
            borderWidth: 1,
            borderColor: COLORS.rule,
          }}
        >
          <Label>{size}px</Label>
          <Text style={typeStyle(family, size)}>
            Ag 012
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function FamilyCard({ label, family }: { label: string; family: string | undefined }) {
  return (
    <Box style={{
      flexDirection: 'column',
      gap: 12,
      paddingLeft: 16, paddingRight: 16, paddingTop: 14, paddingBottom: 16,
      backgroundColor: COLORS.panel,
      borderWidth: 1,
      borderColor: COLORS.rule,
      borderRadius: 6,
    }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
        <Text style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>
          {label}
        </Text>
        <Text style={{ fontSize: 11, color: COLORS.faint, fontFamily: 'monospace' }}>
          {family ? `fontFamily: "${family}"` : 'no fontFamily prop'}
        </Text>
      </Box>

      <SizeStrip family={family} />

      <Box style={{ flexDirection: 'column', gap: 8 }}>
        {SPECIMENS.map((sample, index) => (
          <Box key={sample} style={{ flexDirection: 'row', gap: 12, alignItems: 'baseline' }}>
            <Box style={{ width: 52, flexShrink: 0 }}>
              <Label>{index === 0 ? 'body' : index === 1 ? 'ui' : index === 2 ? 'glyphs' : index === 3 ? 'pangram' : 'marks'}</Label>
            </Box>
            <Text style={typeStyle(family, index === 1 ? 12 : 14, { color: index === 1 ? COLORS.dim : COLORS.text })}>
              {sample}
            </Text>
          </Box>
        ))}
      </Box>

      <Box style={{ flexDirection: 'row', gap: 18, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Text style={typeStyle(family, 18, { fontWeight: 400 })}>Regular weight</Text>
        <Text style={typeStyle(family, 18, { fontWeight: 700 })}>Bold weight</Text>
        <Text style={typeStyle(family, 18, { letterSpacing: 1.5 })}>Tracked letters</Text>
      </Box>
    </Box>
  );
}

export default function FontLab() {
  return (
    <Box style={{ flexGrow: 1, backgroundColor: COLORS.bg, width: '100%', height: '100%' }}>
      <ScrollView showScrollbar style={{ width: '100%', height: '100%' }}>
        <Box style={{
          flexDirection: 'column',
          gap: 14,
          paddingLeft: 28, paddingRight: 28, paddingTop: 26, paddingBottom: 34,
        }}>
          <Header />
          {FAMILIES.map((entry) => (
            <FamilyCard key={entry.label} label={entry.label} family={entry.family} />
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}
