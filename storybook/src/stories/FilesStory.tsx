/**
 * Files — file drop, media scanning, archive walking, classification.
 *
 * Everything file-related in one place: drag-and-drop from the OS,
 * directory scanning via Lua, archive reading via libarchive FFI,
 * instant local file classification, and format utilities.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, ImageGallery, classifiers as S} from '../../../packages/core/src';
import type { LoveEvent } from '../../../packages/core/src';
import { classifyFile, formatSize } from '../../../packages/media/src';
import type { MediaType } from '../../../packages/media/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#f59e0b',
  accentDim: 'rgba(245, 158, 11, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#ec4899',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { classifyFile, formatSize } from '@reactjit/media'
import { useMediaLibrary, useMediaStats } from '@reactjit/media'
import { useArchive, useArchiveRead } from '@reactjit/media'`;

const FILE_DROP_CODE = `<Box
  onFileDrop={(e) => {
    console.log(e.filePath)      // "/home/user/photo.jpg"
    console.log(e.fileName)      // "photo.jpg"
    console.log(e.fileExtension) // "jpg"
    console.log(e.fileSize)      // 2048000
  }}
>
  Drop files here
</Box>`;

const FILE_DROP_PREVIEW_CODE = `<Box
  fileDropMode="preview"
  onFileDrop={(e) => {
    // Text files get their content read automatically
    console.log(e.filePreviewText)       // file contents
    console.log(e.filePreviewTruncated)  // true if > 128KB
    console.log(e.filePreviewEncoding)   // "utf-8"
    console.log(e.filePreviewError)      // null or error code
  }}
>
  Drop text files to preview
</Box>`;

const DIR_DROP_CODE = `<Box
  onDirectoryDrop={(e) => {
    console.log(e.filePath)  // "/home/user/Photos"
  }}
>
  Drop a folder here
</Box>`;

const DRAG_EVENTS_CODE = `<Box
  onFileDragEnter={(e) => setDragOver(true)}
  onFileDragLeave={(e) => setDragOver(false)}
  onFileDrop={(e) => {
    setDragOver(false)
    handleFile(e)
  }}
  style={{
    borderColor: dragOver ? '#4ade80' : '#334155',
  }}
/>`;

const MEDIA_LIB_CODE = `const { files, stats, loading, rescan }
  = useMediaLibrary('/home/user/Movies')

// stats.total          = 142
// stats.byType.video   = 42
// stats.totalSize      = 48318382080
// stats.largestFile    = { name: 'movie.mkv', ... }`;

const MEDIA_INDEX_CODE = `const { index, loading } = useMediaIndex(
  '/home/user/Downloads',
  { indexArchives: true, filter: ['video', 'audio'] }
)
// Finds videos INSIDE RAR/ZIP files too!`;

const ARCHIVE_CODE = `const { entries, loading } = useArchive('/path/to/file.rar')
// entries: [{ path, size, type, mtime, encrypted }]

const read = useArchiveRead()
const { content } = await read('/movie.rar', 'subs.srt')

const { matches } = useArchiveSearch('/f.rar', '%.mp4$')`;

const CLASSIFY_CODE = `import { classifyFile, formatSize } from '@reactjit/media'

classifyFile('movie.mkv')     // 'video'
classifyFile('song.flac')     // 'audio'
classifyFile('readme.pdf')    // 'document'
classifyFile('backup.rar')    // 'archive'
formatSize(4831838208)        // '4.5 GB'`;

const GALLERY_CODE = `import { ImageGallery } from '@reactjit/core'

<ImageGallery
  images={images}
  columns={3}
  gap={8}
  thumbnailHeight={88}
/>`;

// ── Hoisted data arrays ─────────────────────────────────

const DROP_EVENT_FIELDS = [
  { label: 'filePath', desc: 'Absolute path to dropped file', color: C.blue },
  { label: 'fileName', desc: 'Extracted filename (e.g. "photo.jpg")', color: C.teal },
  { label: 'fileExtension', desc: 'Lowercase extension (e.g. "jpg")', color: C.green },
  { label: 'fileSize', desc: 'File size in bytes', color: C.yellow },
  { label: 'fileDropMode', desc: '"upload" (default) or "preview"', color: C.mauve },
  { label: 'filePreviewText', desc: 'First 128KB as UTF-8 (preview mode)', color: C.peach },
  { label: 'filePreviewTruncated', desc: 'Whether preview was truncated', color: C.pink },
  { label: 'filePreviewError', desc: 'Error code if preview failed', color: C.red },
  { label: 'x / y', desc: 'Mouse position at drop time (SDL)', color: C.blue },
];

const FEATURES = [
  { label: 'File Drop', desc: 'OS drag-and-drop with hit testing + event bubbling', color: C.blue },
  { label: 'Directory Drop', desc: 'Drop folders — onDirectoryDrop handler', color: C.teal },
  { label: 'Drag Enter/Leave', desc: 'Visual feedback during drag hover', color: C.green },
  { label: 'Preview Mode', desc: 'Auto-read text files on drop (128KB, 88+ extensions)', color: C.yellow },
  { label: 'Binary Detection', desc: 'Skips preview for binary files (null bytes, control chars)', color: C.mauve },
  { label: 'Dir Scanner', desc: 'Recursive directory scanning with media classification', color: C.peach },
  { label: 'Deep Index', desc: 'Archive-aware indexing — looks inside compressed files', color: C.pink },
  { label: 'Archive Read', desc: 'List/extract RAR, ZIP, 7z, TAR, ISO via libarchive FFI', color: C.red },
  { label: 'Classification', desc: '40+ extensions: video, audio, image, subtitle, document, archive', color: C.blue },
  { label: 'Image Gallery', desc: 'Grid layout with modal viewer overlay', color: C.teal },
];

const ARCHIVE_FORMATS = [
  { ext: 'RAR', desc: 'WinRAR archives (v2-v5)', color: C.red },
  { ext: 'ZIP', desc: 'Standard ZIP with deflate/store', color: C.blue },
  { ext: '7z', desc: 'LZMA/LZMA2 compressed archives', color: C.green },
  { ext: 'TAR', desc: 'Tape archives (plain, gz, bz2, xz, zst)', color: C.yellow },
  { ext: 'ISO', desc: 'Disc images (ISO 9660)', color: C.mauve },
  { ext: 'CAB', desc: 'Windows cabinet archives', color: C.peach },
];

const GALLERY_STEMS = [
  'lib/placeholders/gallery_1.png',
  'lib/placeholders/gallery_2.png',
  'lib/placeholders/gallery_3.png',
  'lib/placeholders/gallery_4.png',
];

// ── Live Demo: File Drop Zone ────────────────────────────

function FileDropDemo() {
  const c = useThemeColors();
  const [lastDrop, setLastDrop] = useState<{
    name: string;
    ext: string;
    size: number;
    type: string;
    mode: string;
    preview?: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: LoveEvent) => {
    setDragOver(false);
    setLastDrop({
      name: e.fileName || 'unknown',
      ext: e.fileExtension || '?',
      size: e.fileSize || 0,
      type: classifyFile(e.fileName || ''),
      mode: e.fileDropMode || 'upload',
      preview: e.filePreviewText ? e.filePreviewText.slice(0, 200) : undefined,
    });
  }, []);

  const handleDragEnter = useCallback(() => setDragOver(true), []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);

  return (
    <S.StackG6W100>
      <Box
        fileDropMode="preview"
        onFileDrop={handleDrop}
        onFileDragEnter={handleDragEnter}
        onFileDragLeave={handleDragLeave}
        style={{
          width: '100%',
          height: 80,
          backgroundColor: dragOver ? 'rgba(245, 158, 11, 0.08)' : c.surface1,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: dragOver ? C.accent : c.border,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 11, color: dragOver ? C.accent : c.muted }}>
          {dragOver ? 'Release to drop' : 'Drag a file here from your OS'}
        </Text>
        <S.StoryTiny>
          {'preview mode — text files get their content read'}
        </S.StoryTiny>
      </Box>

      {lastDrop && (
        <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
          <S.RowCenterG8>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
            <S.StoryBody style={{ fontWeight: 'normal' }}>{lastDrop.name}</S.StoryBody>
          </S.RowCenterG8>

          <S.RowG12>
            <Box style={{ gap: 1 }}>
              <S.StoryTiny>{'type'}</S.StoryTiny>
              <Text style={{ fontSize: 9, color: C.blue }}>{lastDrop.type}</Text>
            </Box>
            <Box style={{ gap: 1 }}>
              <S.StoryTiny>{'extension'}</S.StoryTiny>
              <Text style={{ fontSize: 9, color: C.teal }}>{`.${lastDrop.ext}`}</Text>
            </Box>
            <Box style={{ gap: 1 }}>
              <S.StoryTiny>{'size'}</S.StoryTiny>
              <Text style={{ fontSize: 9, color: C.yellow }}>{formatSize(lastDrop.size)}</Text>
            </Box>
            <Box style={{ gap: 1 }}>
              <S.StoryTiny>{'mode'}</S.StoryTiny>
              <Text style={{ fontSize: 9, color: C.mauve }}>{lastDrop.mode}</Text>
            </Box>
          </S.RowG12>

          {lastDrop.preview && (
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 8, color: C.green }}>{'Preview (first 200 chars):'}</Text>
              <Box style={{ backgroundColor: c.bg, borderRadius: 4, padding: 6 }}>
                <S.StoryTiny>{lastDrop.preview}</S.StoryTiny>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </S.StackG6W100>
  );
}

// ── Live Demo: Classifier ────────────────────────────────

function ClassifierDemo() {
  const c = useThemeColors();

  const TYPE_COLORS: Record<MediaType | string, string> = {
    video: C.blue,
    audio: C.green,
    image: C.yellow,
    subtitle: C.mauve,
    document: C.peach,
    archive: C.red,
    metadata: C.teal,
    unknown: c.muted,
  };

  const testFiles = [
    'movie.mkv', 'track.flac', 'photo.jpg', 'readme.pdf',
    'backup.rar', 'data.tar.gz', 'subtitle.srt', 'info.nfo',
    'song.mp3', 'clip.webm', 'image.heic', 'book.epub',
    'archive.7z', 'video.mp4', 'audio.ogg', 'unknown.xyz',
  ];

  return (
    <S.StackG6W100>
      <S.StoryCap>Instant local classification by extension — no RPC needed</S.StoryCap>
      <S.RowWrap style={{ gap: 4 }}>
        {testFiles.map(f => {
          const type = classifyFile(f);
          return (
            <Box key={f} style={{
              backgroundColor: c.surface1, borderRadius: 4, padding: 4,
              paddingLeft: 6, paddingRight: 6, gap: 1,
            }}>
              <Text style={{ fontSize: 9, color: TYPE_COLORS[type] || c.muted }}>{f}</Text>
              <S.DimMicro>{type}</S.DimMicro>
            </Box>
          );
        })}
      </S.RowWrap>
    </S.StackG6W100>
  );
}

// ── Live Demo: Format Size ───────────────────────────────

function FormatSizeDemo() {
  const c = useThemeColors();
  const sizes = [0, 512, 1024, 10240, 1048576, 104857600, 1073741824, 1099511627776];

  return (
    <S.StackG4W100>
      <S.StoryCap>Human-readable byte formatting</S.StoryCap>
      <Box style={{ gap: 2 }}>
        {sizes.map(s => (
          <S.RowG8 key={s}>
            <S.StoryCap style={{ width: 120 }}>{`${s.toLocaleString()} B`}</S.StoryCap>
            <Text style={{ fontSize: 9, color: C.green }}>{formatSize(s)}</Text>
          </S.RowG8>
        ))}
      </Box>
    </S.StackG4W100>
  );
}

// ── Event Fields Catalog ─────────────────────────────────

function EventFieldsCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {DROP_EVENT_FIELDS.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 130, flexShrink: 0 }}>{f.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Archive Formats Catalog ──────────────────────────────

function ArchiveFormatsCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG4W100>
      {ARCHIVE_FORMATS.map(f => (
        <S.RowCenterG8 key={f.ext}>
          <Box style={{
            backgroundColor: f.color, borderRadius: 3,
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            width: 40, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e', fontWeight: 'normal' }}>{f.ext}</Text>
          </Box>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG4W100>
  );
}

// ── Feature Catalog ──────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {FEATURES.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 110, flexShrink: 0 }}>{f.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Gallery Demo ─────────────────────────────────────────

function GalleryDemo() {
  const images = useMemo(() => {
    return Array.from({ length: 8 }, (_, idx) => ({
      id: idx,
      src: GALLERY_STEMS[idx % GALLERY_STEMS.length],
      title: `Photo ${idx + 1}`,
      subtitle: `Gallery tile ${idx + 1}`,
      description: 'Click to open modal viewer.',
    }));
  }, []);

  return (
    <S.StackG4W100>
      <ImageGallery images={images} columns={3} gap={8} thumbnailHeight={80} />
    </S.StackG4W100>
  );
}

// ── FilesStory ───────────────────────────────────────────

export function FilesStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="upload" tintColor={C.accent} />
        <S.StoryTitle>
          {'Files'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/media + core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'No filesystem, no problem'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'OS-native file handling in React props.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Drag files from your desktop onto any Box. Get the path, name, size, and extension in the event. Enable preview mode to auto-read text files on drop. Scan directories, peek inside archives, classify 40+ file types — all through Lua with zero JS file I/O.'}
          </S.StoryMuted>
        </HeroBand>

        <Divider />

        {/* ── Band 1: demo | text — FILE DROP ── */}
        <Band>
          <Half>
            <FileDropDemo />
          </Half>
          <Half>
            <SectionLabel icon="upload">{'FILE DROP'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Drop it like it\'s hot'}</Text>
            <S.StoryBody>
              {'Add onFileDrop to any Box. Lua hit-tests the drop position via SDL, resolves the target through the instance tree, and dispatches the event with full metadata. Events bubble up — a drop zone can be a parent container.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Mouse position uses SDL_GetGlobalMouseState for accuracy during OS drag operations, not love.mouse.getPosition() which is stale during drags.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={FILE_DROP_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 2: text + code | text + code — PREVIEW + DIR ── */}
        <Band>
          <Half>
            <SectionLabel icon="eye">{'PREVIEW MODE'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Read it before you need it'}</Text>
            <S.StoryBody>
              {'Set fileDropMode="preview" on a Box or any ancestor. When a text file is dropped, Lua reads up to 128KB, strips UTF-8 BOM, detects binary content, and includes the text in the event. 88+ text extensions supported.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Preview mode walks up the node tree — set it once on a parent and all children inherit it. Binary files get filePreviewError="preview_binary_file" instead of garbage text.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={FILE_DROP_PREVIEW_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="folder">{'DIRECTORY DROP'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'The whole thing. Yes, really.'}</Text>
            <S.StoryBody>
              {'Drop entire folders with onDirectoryDrop. The event contains the directory path — combine with useMediaLibrary to scan its contents.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={DIR_DROP_CODE} />
            <SectionLabel icon="move">{'DRAG ENTER / LEAVE'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Hover with intent'}</Text>
            <S.StoryBody>
              {'Visual feedback during drag hover. onFileDragEnter fires when a file enters the node bounds, onFileDragLeave when it exits.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={DRAG_EVENTS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: SDL mouse ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'File drops use SDL_GetGlobalMouseState for mouse position — not Love2D\'s stale coordinates. Lua modules (like the NES emulator) get first crack at drops before React sees them.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 3: demo | text — EVENT FIELDS ── */}
        <Band>
          <Half>
            <EventFieldsCatalog />
          </Half>
          <Half>
            <SectionLabel icon="list">{'DROP EVENT FIELDS'}</SectionLabel>
            <S.StoryBody>
              {'Every file drop event (LoveEvent) carries these fields. Upload mode gives metadata only. Preview mode attempts to read text content for supported extensions.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Preview errors: preview_open_failed (can\'t open file), preview_binary_file (detected binary), preview_unsupported_extension (not in the 88-extension allowlist), preview_read_failed (I/O error).'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Band 4: text + code | demo — CLASSIFICATION ── */}
        <Band>
          <Half>
            <SectionLabel icon="tag">{'FILE CLASSIFICATION'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Judge a file by its extension'}</Text>
            <S.StoryBody>
              {'classifyFile() runs locally in JS — no RPC, no bridge latency. Returns one of 8 types: video, audio, image, subtitle, document, archive, metadata, or unknown. Supports 40+ extensions.'}
            </S.StoryBody>
            <S.StoryCap>
              {'formatSize() converts raw bytes to human-readable strings (B, KB, MB, GB, TB). Both are pure utility functions — no hooks, no state, no side effects.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={CLASSIFY_CODE} />
          </Half>
          <Half>
            <ClassifierDemo />
            <FormatSizeDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: demo | text + code — MEDIA LIBRARY ── */}
        <Band>
          <Half>
            <SectionLabel icon="hard-drive">{'MEDIA LIBRARY'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'One hook to find them all'}</Text>
            <S.StoryBody>
              {'useMediaLibrary() scans directories recursively via Lua\'s io.popen + find. Returns classified files with stats (counts by type, total size, largest file). Filter by media type, control recursion depth.'}
            </S.StoryBody>
            <S.StoryCap>
              {'useMediaStats() returns just the counts without loading all file objects. useMediaIndex() goes deeper — it peeks inside archive files via libarchive to find media buried in RAR/ZIP/7z.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MEDIA_LIB_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="search">{'DEEP INDEX'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Nowhere to hide'}</Text>
            <S.StoryBody>
              {'useMediaIndex() is the archive walker. It scans a directory AND looks inside every archive file it finds. The result is a flat list where each item has a source field: "filesystem" or "archive".'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MEDIA_INDEX_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 6: text + code | catalog — ARCHIVES ── */}
        <Band>
          <Half>
            <SectionLabel icon="package">{'ARCHIVE HOOKS'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Unzip your potential'}</Text>
            <S.StoryBody>
              {'Four hooks for archive operations: useArchive (list contents), useArchiveInfo (summary), useArchiveRead (extract a file), useArchiveSearch (pattern match). All powered by libarchive via LuaJIT FFI.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Archive features degrade gracefully — if libarchive is not installed, hooks return empty results instead of crashing.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ARCHIVE_CODE} />
          </Half>
          <Half>
            <ArchiveFormatsCatalog />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 7: demo | text + code — IMAGE GALLERY ── */}
        <Band>
          <Half>
            <GalleryDemo />
          </Half>
          <Half>
            <SectionLabel icon="grid">{'IMAGE GALLERY'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Worth a thousand props'}</Text>
            <S.StoryBody>
              {'ImageGallery renders a grid of thumbnails. Click any image to open it in a non-invasive modal overlay — page layout stays intact. Configure columns, gap, and thumbnail height.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={GALLERY_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width feature catalog ── */}
        <S.StoryFullBand>
          <SectionLabel icon="list">{'FEATURE CATALOG'}</SectionLabel>
          <S.StoryCap>{'Everything file-related in ReactJIT:'}</S.StoryCap>
          <FeatureCatalog />
        </S.StoryFullBand>

        <Divider />

        {/* ── Callout: one-liner philosophy ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'File drops are a Box prop. Directory scanning is a hook call. Archive reading is a hook call. Classification is a utility function. No file APIs to learn, no streams to manage, no permissions to request.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Callout: Plex ── */}
        <CalloutBand borderColor={C.accent} bgColor={C.accentDim}>
          <S.StoryInfoIcon src="zap" tintColor={C.accent} />
          <S.StoryBody>
            {'Plex raised $180M to scan directories and classify media files. useMediaLibrary() does it in one line.'}
          </S.StoryBody>
        </CalloutBand>

      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="upload" />
        <S.StoryBreadcrumbActive>{'Files'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
