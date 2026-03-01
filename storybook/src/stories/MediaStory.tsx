import React, { useMemo, useState } from 'react';
import { Box, Text, Pressable, ScrollView, ImageGallery, useRendererMode } from '../../../packages/core/src';
import { classifyFile, formatSize } from '../../../packages/media/src';
import type { MediaType } from '../../../packages/media/src';
import { useThemeColors } from '../../../packages/theme/src';

const WEB_PLACEHOLDER_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">' +
  '<rect width="960" height="640" fill="#0f172a"/>' +
  '<text x="480" y="330" text-anchor="middle" fill="#cbd5e1" font-family="sans-serif" font-size="56">media placeholder</text>' +
  '</svg>'
);
const NATIVE_PLACEHOLDER_SRC = 'lib/placeholder.png';

// ── Classifier Demo ────────────────────────────────────

function ClassifierDemo() {
  const c = useThemeColors();

  const TYPE_COLORS: Record<MediaType | string, string> = {
    video: c.info,
    audio: c.success,
    image: c.warning,
    subtitle: c.textSecondary,
    document: c.accent,
    archive: c.error,
    metadata: c.textDim,
    unknown: c.textDim,
  };

  const testFiles = [
    'movie.mkv', 'track.flac', 'photo.jpg', 'readme.pdf',
    'backup.rar', 'data.tar.gz', 'subtitle.srt', 'info.nfo',
    'song.mp3', 'clip.webm', 'image.heic', 'book.epub',
    'archive.7z', 'video.mp4', 'audio.ogg', 'doc.docx',
    'unknown.xyz', 'render.avi', 'podcast.m4a', 'shot.png',
  ];

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>File Classification</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>Instant local classification by extension — no RPC needed</Text>

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {testFiles.map(f => {
          const type = classifyFile(f);
          return (
            <Box key={f} style={{
              backgroundColor: c.bg, borderRadius: 4, padding: 4,
              paddingLeft: 6, paddingRight: 6, gap: 1,
            }}>
              <Text style={{ fontSize: 9, color: TYPE_COLORS[type] || c.textDim }}>{f}</Text>
              <Text style={{ fontSize: 7, color: c.textDim }}>{type}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Format Size Demo ───────────────────────────────────

function FormatSizeDemo() {
  const c = useThemeColors();
  const sizes = [
    0, 512, 1024, 10240, 1048576, 104857600,
    1073741824, 1099511627776, 4831838208,
  ];

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>Size Formatting</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>Human-readable byte formatting</Text>

      <Box style={{ gap: 3 }}>
        {sizes.map(s => (
          <Box key={s} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: c.textDim, width: 120 }}>{`${s.toLocaleString()} bytes`}</Text>
            <Text style={{ fontSize: 10, color: c.success, fontWeight: 'normal' }}>{formatSize(s)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Archive Support ────────────────────────────────────

function ArchiveFormats() {
  const c = useThemeColors();
  const formats = [
    { ext: 'RAR', desc: 'WinRAR archives (v2-v5)', color: c.error },
    { ext: 'ZIP', desc: 'Standard ZIP with deflate/store', color: c.info },
    { ext: '7z', desc: 'LZMA/LZMA2 compressed archives', color: c.success },
    { ext: 'TAR', desc: 'Tape archives (plain, gz, bz2, xz, zst)', color: c.warning },
    { ext: 'ISO', desc: 'Disc images (ISO 9660)', color: c.accent },
    { ext: 'CAB', desc: 'Windows cabinet archives', color: c.primaryHover },
  ];

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>Archive Formats (libarchive)</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>LuaJIT FFI bindings to libarchive — read any format</Text>

      <Box style={{ gap: 4 }}>
        {formats.map(f => (
          <Box key={f.ext} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{
              backgroundColor: f.color, borderRadius: 3,
              paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
              width: 40, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 9, color: c.bg, fontWeight: 'normal' }}>{f.ext}</Text>
            </Box>
            <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Code Examples ──────────────────────────────────────

function MediaCodeBlock({ label, code, color }: { label: string; code: string[]; color?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 10, gap: 3, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{label}</Text>
      {code.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: color || c.success }}>{line}</Text>
      ))}
    </Box>
  );
}

function UsageExamples() {
  return (
    <Box style={{ gap: 8 }}>
      <MediaCodeBlock
        label="// List archive contents"
        code={[
          "import { useArchive } from '@reactjit/media';",
          "",
          "const { entries, loading } = useArchive('/path/to/file.rar');",
          "// entries: [{ path, size, type, mtime, encrypted }]",
        ]}
      />

      <MediaCodeBlock
        label="// Read a file from inside an archive"
        code={[
          "const readFile = useArchiveRead();",
          "const { content } = await readFile('/movie.rar', 'subs.srt');",
        ]}
      />

      <MediaCodeBlock
        label="// Scan a directory for media files"
        code={[
          "import { useMediaLibrary } from '@reactjit/media';",
          "",
          "const { files, stats } = useMediaLibrary('/home/user/Movies');",
          "// stats.byType: { video: 42, subtitle: 38, image: 5 }",
        ]}
      />

      <MediaCodeBlock
        label="// Deep index — looks inside archives"
        code={[
          "import { useMediaIndex } from '@reactjit/media';",
          "",
          "const { index } = useMediaIndex('/home/user/Downloads', {",
          "  indexArchives: true,",
          "  filter: ['video', 'audio'],",
          "});",
          "// Finds videos inside RAR/ZIP files too!",
        ]}
      />

      <MediaCodeBlock
        label="// Get quick directory stats"
        code={[
          "const { stats } = useMediaStats('/mnt/nas/media');",
          "// stats.total, stats.totalSize, stats.largestFile",
        ]}
      />

      <MediaCodeBlock
        label="// Classify + format — no RPC needed"
        code={[
          "import { classifyFile, formatSize } from '@reactjit/media';",
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
  const c = useThemeColors();
  const features = [
    { label: 'Archive Read', desc: 'List/extract RAR, ZIP, 7z, TAR, ISO via libarchive FFI', color: c.error },
    { label: 'Dir Scanner', desc: 'Recursive directory scanning with media classification', color: c.success },
    { label: 'Deep Index', desc: 'Archive-aware indexing — looks inside compressed files', color: c.info },
    { label: 'Type Detection', desc: '40+ extensions: video, audio, image, subtitle, document, archive', color: c.warning },
    { label: 'Search', desc: 'Pattern-based search inside archives', color: c.accent },
    { label: 'Stats', desc: 'Quick directory stats: counts by type, total size, largest file', color: c.primaryHover },
    { label: 'Format Size', desc: 'Human-readable byte formatting (B/KB/MB/GB/TB)', color: c.primaryPressed },
    { label: 'Graceful', desc: 'Archive features degrade gracefully if libarchive not installed', color: c.textDim },
  ];

  return (
    <Box style={{ gap: 4 }}>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 100 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Gallery Demo ────────────────────────────────────────

function GalleryDemo() {
  const c = useThemeColors();
  const mode = useRendererMode();
  const placeholderSrc = mode === 'native' ? NATIVE_PLACEHOLDER_SRC : WEB_PLACEHOLDER_SRC;
  const images = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => ({
      id: idx,
      src: placeholderSrc,
      title: `Gallery ${idx + 1}`,
      subtitle: `Placeholder media tile`,
      description: `Click to open a non-invasive modal viewer.`,
    }));
  }, [placeholderSrc]);

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>Modal Image Gallery</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>
        Opens images in an overlay so page layout stays intact.
      </Text>
      <ImageGallery images={images} columns={3} gap={8} thumbnailHeight={88} />
    </Box>
  );
}

// ── Main Story ─────────────────────────────────────────

export function MediaStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<'classify' | 'formats' | 'gallery' | 'code' | 'features'>('classify');

  const tabs = [
    { key: 'classify' as const, label: 'Classify' },
    { key: 'formats' as const, label: 'Archives' },
    { key: 'gallery' as const, label: 'Gallery' },
    { key: 'code' as const, label: 'Usage' },
    { key: 'features' as const, label: 'All' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 12 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>@reactjit/media</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>Media library scanner, archive walker, and file indexer.</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)}>
            <Box style={{
              backgroundColor: tab === t.key ? c.info : c.bgElevated,
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 10, color: tab === t.key ? c.bg : c.textSecondary, fontWeight: 'normal' }}>
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
          {tab === 'gallery' && <GalleryDemo />}
          {tab === 'code' && <UsageExamples />}
          {tab === 'features' && <FeatureList />}
        </Box>
      </ScrollView>
    </Box>
  );
}
