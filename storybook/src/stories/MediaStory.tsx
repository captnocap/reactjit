import React, { useState, useEffect } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import { classifyFile, formatSize } from '../../../packages/media/src';
import type { MediaType } from '../../../packages/media/src';

const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';
const ACCENT = '#60a5fa';
const GREEN = '#22c55e';
const RED = '#ef4444';
const DIM = '#64748b';
const BRIGHT = '#e2e8f0';
const MUTED = '#94a3b8';
const ORANGE = '#f59e0b';
const PURPLE = '#8b5cf6';
const PINK = '#ec4899';
const TEAL = '#14b8a6';

// ── Type Colors ────────────────────────────────────────

const TYPE_COLORS: Record<MediaType | string, string> = {
  video: ACCENT,
  audio: GREEN,
  image: ORANGE,
  subtitle: MUTED,
  document: PURPLE,
  archive: RED,
  metadata: DIM,
  unknown: '#475569',
};

// ── Classifier Demo ────────────────────────────────────

function ClassifierDemo() {
  const testFiles = [
    'movie.mkv', 'track.flac', 'photo.jpg', 'readme.pdf',
    'backup.rar', 'data.tar.gz', 'subtitle.srt', 'info.nfo',
    'song.mp3', 'clip.webm', 'image.heic', 'book.epub',
    'archive.7z', 'video.mp4', 'audio.ogg', 'doc.docx',
    'unknown.xyz', 'render.avi', 'podcast.m4a', 'shot.png',
  ];

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>File Classification</Text>
      <Text style={{ fontSize: 9, color: DIM }}>Instant local classification by extension — no RPC needed</Text>

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {testFiles.map(f => {
          const type = classifyFile(f);
          return (
            <Box key={f} style={{
              backgroundColor: '#0f172a', borderRadius: 4, padding: 4,
              paddingLeft: 6, paddingRight: 6, gap: 1,
            }}>
              <Text style={{ fontSize: 9, color: TYPE_COLORS[type] || DIM }}>{f}</Text>
              <Text style={{ fontSize: 7, color: DIM }}>{type}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Format Size Demo ───────────────────────────────────

function FormatSizeDemo() {
  const sizes = [
    0, 512, 1024, 10240, 1048576, 104857600,
    1073741824, 1099511627776, 4831838208,
  ];

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>Size Formatting</Text>
      <Text style={{ fontSize: 9, color: DIM }}>Human-readable byte formatting</Text>

      <Box style={{ gap: 3 }}>
        {sizes.map(s => (
          <Box key={s} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: DIM, width: 120 }}>{s.toLocaleString()} bytes</Text>
            <Text style={{ fontSize: 10, color: GREEN, fontWeight: '700' }}>{formatSize(s)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Archive Support ────────────────────────────────────

function ArchiveFormats() {
  const formats = [
    { ext: 'RAR', desc: 'WinRAR archives (v2-v5)', color: RED },
    { ext: 'ZIP', desc: 'Standard ZIP with deflate/store', color: ACCENT },
    { ext: '7z', desc: 'LZMA/LZMA2 compressed archives', color: GREEN },
    { ext: 'TAR', desc: 'Tape archives (plain, gz, bz2, xz, zst)', color: ORANGE },
    { ext: 'ISO', desc: 'Disc images (ISO 9660)', color: PURPLE },
    { ext: 'CAB', desc: 'Windows cabinet archives', color: TEAL },
  ];

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>Archive Formats (libarchive)</Text>
      <Text style={{ fontSize: 9, color: DIM }}>LuaJIT FFI bindings to libarchive — read any format</Text>

      <Box style={{ gap: 4 }}>
        {formats.map(f => (
          <Box key={f.ext} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{
              backgroundColor: f.color, borderRadius: 3,
              paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
              width: 40, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 9, color: '#000', fontWeight: '700' }}>{f.ext}</Text>
            </Box>
            <Text style={{ fontSize: 10, color: MUTED }}>{f.desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Code Examples ──────────────────────────────────────

function CodeBlock({ label, code, color }: { label: string; code: string[]; color?: string }) {
  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 6, padding: 10, gap: 3, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 9, color: DIM }}>{label}</Text>
      {code.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: color || GREEN }}>{line}</Text>
      ))}
    </Box>
  );
}

function UsageExamples() {
  return (
    <Box style={{ gap: 8 }}>
      <CodeBlock
        label="// List archive contents"
        code={[
          "import { useArchive } from '@ilovereact/media';",
          "",
          "const { entries, loading } = useArchive('/path/to/file.rar');",
          "// entries: [{ path, size, type, mtime, encrypted }]",
        ]}
      />

      <CodeBlock
        label="// Read a file from inside an archive"
        code={[
          "const readFile = useArchiveRead();",
          "const { content } = await readFile('/movie.rar', 'subs.srt');",
        ]}
      />

      <CodeBlock
        label="// Scan a directory for media files"
        code={[
          "import { useMediaLibrary } from '@ilovereact/media';",
          "",
          "const { files, stats } = useMediaLibrary('/home/user/Movies');",
          "// stats.byType: { video: 42, subtitle: 38, image: 5 }",
        ]}
      />

      <CodeBlock
        label="// Deep index — looks inside archives"
        code={[
          "import { useMediaIndex } from '@ilovereact/media';",
          "",
          "const { index } = useMediaIndex('/home/user/Downloads', {",
          "  indexArchives: true,",
          "  filter: ['video', 'audio'],",
          "});",
          "// Finds videos inside RAR/ZIP files too!",
        ]}
      />

      <CodeBlock
        label="// Get quick directory stats"
        code={[
          "const { stats } = useMediaStats('/mnt/nas/media');",
          "// stats.total, stats.totalSize, stats.largestFile",
        ]}
      />

      <CodeBlock
        label="// Classify + format — no RPC needed"
        code={[
          "import { classifyFile, formatSize } from '@ilovereact/media';",
          "",
          "classifyFile('movie.mkv')    // 'video'",
          "classifyFile('song.flac')    // 'audio'",
          "formatSize(4831838208)       // '4.5 GB'",
        ]}
      />
    </Box>
  );
}

// ── Feature List ───────────────────────────────────────

function FeatureList() {
  const features = [
    { label: 'Archive Read', desc: 'List/extract RAR, ZIP, 7z, TAR, ISO via libarchive FFI', color: RED },
    { label: 'Dir Scanner', desc: 'Recursive directory scanning with media classification', color: GREEN },
    { label: 'Deep Index', desc: 'Archive-aware indexing — looks inside compressed files', color: ACCENT },
    { label: 'Type Detection', desc: '40+ extensions: video, audio, image, subtitle, document, archive', color: ORANGE },
    { label: 'Search', desc: 'Pattern-based search inside archives', color: PURPLE },
    { label: 'Stats', desc: 'Quick directory stats: counts by type, total size, largest file', color: TEAL },
    { label: 'Format Size', desc: 'Human-readable byte formatting (B/KB/MB/GB/TB)', color: PINK },
    { label: 'Graceful', desc: 'Archive features degrade gracefully if libarchive not installed', color: DIM },
  ];

  return (
    <Box style={{ gap: 4 }}>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: BRIGHT, fontWeight: '700', width: 100 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: MUTED }}>{f.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Main Story ─────────────────────────────────────────

export function MediaStory() {
  const [tab, setTab] = useState<'classify' | 'formats' | 'code' | 'features'>('classify');

  const tabs = [
    { key: 'classify' as const, label: 'Classify' },
    { key: 'formats' as const, label: 'Archives' },
    { key: 'code' as const, label: 'Usage' },
    { key: 'features' as const, label: 'All' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 16, gap: 12 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: BRIGHT, fontWeight: '700' }}>@ilovereact/media</Text>
        <Text style={{ fontSize: 11, color: DIM }}>Media library scanner, archive walker, and file indexer.</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)}>
            <Box style={{
              backgroundColor: tab === t.key ? ACCENT : CARD,
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 10, color: tab === t.key ? '#000' : MUTED, fontWeight: '700' }}>
                {t.label}
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 12, paddingRight: 4 }}>
          {tab === 'classify' && (
            <>
              <ClassifierDemo />
              <FormatSizeDemo />
            </>
          )}
          {tab === 'formats' && <ArchiveFormats />}
          {tab === 'code' && <UsageExamples />}
          {tab === 'features' && <FeatureList />}
        </Box>
      </ScrollView>
    </Box>
  );
}
