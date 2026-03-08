/**
 * Capture — Screenshot, GIF, and Video recording.
 *
 * Unified story for all capture capabilities: single-frame PNG,
 * animated GIF, and MP4/WebM video recording via ffmpeg pipe.
 *
 * PERF: No timers except polling during active recording (500ms).
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, ScrollView, Pressable, CodeBlock, useGifRecorder, useRecorder, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#f38ba8',
  accentDim: 'rgba(243, 139, 168, 0.12)',
  callout: 'rgba(243, 139, 168, 0.06)',
  calloutBorder: 'rgba(243, 139, 168, 0.30)',
  screenshot: '#89b4fa',
  gif: '#a6e3a1',
  video: '#cba6f7',
  perf: '#f9e2af',
};

// ── Static code blocks ───────────────────────────────────

const SCREENSHOT_CODE = `-- Lua: single-frame capture
love.graphics.captureScreenshot(function(imageData)
  local fileData = imageData:encode("png")
  local f = io.open("capture.png", "wb")
  f:write(fileData:getString())
  f:close()
end)

-- CLI: headless screenshot
-- rjit screenshot --output preview.png`;

const GIF_HOOK_CODE = `import { useGifRecorder } from '@reactjit/core'

const { recording, frames, gifPath, start, stop }
  = useGifRecorder()

// Start: 15fps animated GIF
start({ fps: 15, output: '/tmp/demo.gif' })

// Stop: assembles via ffmpeg 2-pass palette
const path = await stop()`;

const VIDEO_HOOK_CODE = `import { useRecorder } from '@reactjit/core'

const { recording, frames, duration, filePath,
        start, stop } = useRecorder()

// MP4 at 30fps (default)
start({ fps: 30, output: '/tmp/demo.mp4' })

// WebM at 24fps
start({ fps: 24, format: 'webm' })

// Stop: ffmpeg finalizes the file
const path = await stop()`;

const RPC_CODE = `-- Start video recording via RPC
bridge.rpc('recorder:start', {
  fps = 30,
  format = 'mp4',
  output = '/tmp/recording.mp4',
})

-- Poll status
bridge.rpc('recorder:status')
-- { recording, frames, fps, format,
--   duration, output, width, height }

-- Stop and get result
bridge.rpc('recorder:stop')
-- { path, frames, duration }`;

const PERF_NOTES = `Recording approach        | Overhead per frame
--------------------------+--------------------
Screenshot (PNG)          | ~2ms (encode + write)
GIF (PNG per frame)       | ~2ms (encode + FS write)
Video (raw RGBA pipe)     | ~0.3ms (memcpy to pipe)

Video piping is ~6x faster than GIF because:
  - No PNG encoding (skip zlib compression)
  - No filesystem I/O (pipe to ffmpeg stdin)
  - ffmpeg encodes in parallel (separate process)

Recommended: 30fps for demos, 15fps if CPU-bound.
ultrafast preset keeps H.264 encode under 1ms/frame.`;

// ── Styles (hoisted) ─────────────────────────────────────

const styles = {
  badge: {
    paddingLeft: 8, paddingRight: 8,
    paddingTop: 3, paddingBottom: 3,
    borderRadius: 4,
  } as const,
  btn: {
    paddingLeft: 14, paddingRight: 14,
    paddingTop: 8, paddingBottom: 8,
    borderRadius: 6,
  } as const,
  btnSmall: {
    paddingLeft: 10, paddingRight: 10,
    paddingTop: 5, paddingBottom: 5,
    borderRadius: 4,
  } as const,
  row: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  statRow: {
    flexDirection: 'row' as const,
    gap: 16,
    flexWrap: 'wrap' as const,
  },
};

// ── Sub-components ───────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{ ...styles.badge, backgroundColor: color + '22' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </Box>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 2 }}>
      <S.StoryMuted>{label}</S.StoryMuted>
      <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </Box>
  );
}

// ── GIF Demo ─────────────────────────────────────────────

function GifDemo() {
  const c = useThemeColors();
  const { recording, frames, gifPath, start, stop } = useGifRecorder();

  const toggle = useCallback(() => {
    if (recording) { stop(); } else { start({ fps: 15 }); }
  }, [recording, start, stop]);

  return (
    <Box style={{ gap: 10, width: '100%' }}>
      <Box style={styles.row}>
        <Pressable onPress={toggle} style={{ ...styles.btn, backgroundColor: recording ? C.accent : C.gif }}>
          <Text style={{ color: '#1e1e2e', fontSize: 12, fontWeight: '700' }}>
            {recording ? 'Stop GIF' : 'Record GIF'}
          </Text>
        </Pressable>
        {recording && <Badge label={`${frames} frames`} color={C.gif} />}
        {gifPath && !recording && <Badge label="Saved" color={C.gif} />}
      </Box>
      {gifPath && !recording && (
        <Text style={{ color: c.muted, fontSize: 11 }}>{gifPath}</Text>
      )}
    </Box>
  );
}

// ── Video Demo ───────────────────────────────────────────

function VideoDemo() {
  const c = useThemeColors();
  const { recording, frames, duration, filePath, format, start, stop } = useRecorder();
  const [selectedFormat, setSelectedFormat] = useState<'mp4' | 'webm'>('mp4');
  const [selectedFps, setSelectedFps] = useState(30);

  const toggle = useCallback(() => {
    if (recording) {
      stop();
    } else {
      start({ fps: selectedFps, format: selectedFormat });
    }
  }, [recording, start, stop, selectedFps, selectedFormat]);

  const cycleFps = useCallback(() => {
    setSelectedFps(f => f === 15 ? 24 : f === 24 ? 30 : 15);
  }, []);

  const cycleFormat = useCallback(() => {
    setSelectedFormat(f => f === 'mp4' ? 'webm' : 'mp4');
  }, []);

  return (
    <Box style={{ gap: 10, width: '100%' }}>
      <Box style={styles.row}>
        {!recording && (
          <>
            <Pressable onPress={cycleFormat} style={{ ...styles.btnSmall, backgroundColor: c.surface }}>
              <Text style={{ color: c.text, fontSize: 11 }}>{selectedFormat.toUpperCase()}</Text>
            </Pressable>
            <Pressable onPress={cycleFps} style={{ ...styles.btnSmall, backgroundColor: c.surface }}>
              <Text style={{ color: c.text, fontSize: 11 }}>{`${selectedFps}fps`}</Text>
            </Pressable>
          </>
        )}
        <Pressable onPress={toggle} style={{ ...styles.btn, backgroundColor: recording ? C.accent : C.video }}>
          <Text style={{ color: '#1e1e2e', fontSize: 12, fontWeight: '700' }}>
            {recording ? 'Stop Recording' : 'Record Video'}
          </Text>
        </Pressable>
      </Box>
      {recording && (
        <Box style={styles.statRow}>
          <StatBox label="Format" value={(format ?? 'mp4').toUpperCase()} />
          <StatBox label="Frames" value={`${frames}`} />
          <StatBox label="Duration" value={`${duration.toFixed(1)}s`} />
        </Box>
      )}
      {filePath && !recording && (
        <Box style={{ gap: 2 }}>
          <Badge label="Saved" color={C.video} />
          <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>{filePath}</Text>
        </Box>
      )}
    </Box>
  );
}

// ── CaptureStory ─────────────────────────────────────────

export function CaptureStory() {
  const c = useThemeColors();

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ width: '100%' }}>

        {/* Hero */}
        <HeroBand accentColor={C.accent}>
          <Box style={{ gap: 4 }}>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <S.StoryTitle>{'Capture'}</S.StoryTitle>
              <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
                <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
              </Box>
            </Box>
            <Text style={{ color: c.muted, fontSize: 11 }}>
              {'Screenshot, GIF, and video recording. PNG snapshots, animated GIFs with palette optimization, and MP4/WebM video via raw RGBA pipe to ffmpeg.'}
            </Text>
          </Box>
        </HeroBand>

        <Divider />

        {/* Overview: three modes */}
        <Band>
          <Half>
            <SectionLabel icon="camera" accentColor={C.accent}>{'CAPTURE MODES'}</SectionLabel>
            <Box style={{ gap: 6 }}>
              <Box style={styles.row}>
                <Badge label="Screenshot" color={C.screenshot} />
                <Text style={{ color: c.muted, fontSize: 12 }}>{'Single-frame PNG via F2 or CLI'}</Text>
              </Box>
              <Box style={styles.row}>
                <Badge label="GIF" color={C.gif} />
                <Text style={{ color: c.muted, fontSize: 12 }}>{'Animated GIF with ffmpeg 2-pass palette'}</Text>
              </Box>
              <Box style={styles.row}>
                <Badge label="Video" color={C.video} />
                <Text style={{ color: c.muted, fontSize: 12 }}>{'MP4/WebM via raw RGBA pipe to ffmpeg'}</Text>
              </Box>
            </Box>
          </Half>
          <CodeBlock language="lua" style={{ flexGrow: 1, flexBasis: 0 }}>{SCREENSHOT_CODE}</CodeBlock>
        </Band>

        <Divider />

        {/* GIF Recording */}
        <Band>
          <Half>
            <SectionLabel icon="film" accentColor={C.gif}>{'GIF RECORDING'}</SectionLabel>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {'Captures frames at configurable FPS, saves numbered PNGs, then assembles via ffmpeg with a two-pass palette for high-quality 128-color GIFs with Bayer dithering.'}
            </Text>
            <GifDemo />
          </Half>
          <CodeBlock language="typescript" style={{ flexGrow: 1, flexBasis: 0 }}>{GIF_HOOK_CODE}</CodeBlock>
        </Band>

        <Divider />

        {/* Video Recording */}
        <Band>
          <CodeBlock language="typescript" style={{ flexGrow: 1, flexBasis: 0 }}>{VIDEO_HOOK_CODE}</CodeBlock>
          <Half>
            <SectionLabel icon="video" accentColor={C.video}>{'VIDEO RECORDING'}</SectionLabel>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {'Pipes raw RGBA pixels directly to ffmpeg stdin. No temp files, no PNG encoding. ffmpeg runs in a separate process and encodes in parallel with Love2D rendering. H.264 ultrafast preset by default.'}
            </Text>
            <VideoDemo />
          </Half>
        </Band>

        <Divider />

        {/* RPC API */}
        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.accent}>{'RPC API'}</SectionLabel>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {'All capture methods are available as Lua RPCs for direct control from any context. The React hooks are thin wrappers over these.'}
            </Text>
            <Box style={{ gap: 4 }}>
              <Box style={styles.row}>
                <Badge label="recorder:start" color={C.video} />
                <Badge label="recorder:stop" color={C.video} />
                <Badge label="recorder:status" color={C.video} />
              </Box>
              <Box style={styles.row}>
                <Badge label="gif:start" color={C.gif} />
                <Badge label="gif:stop" color={C.gif} />
                <Badge label="gif:status" color={C.gif} />
              </Box>
            </Box>
          </Half>
          <CodeBlock language="lua" style={{ flexGrow: 1, flexBasis: 0 }}>{RPC_CODE}</CodeBlock>
        </Band>

        <Divider />

        {/* Performance callout */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Text style={{ color: C.perf, fontSize: 11, fontWeight: '600' }}>{'Performance characteristics'}</Text>
          <CodeBlock language="text" style={{ flexGrow: 1, flexBasis: 0 }}>{PERF_NOTES}</CodeBlock>
        </CalloutBand>

      </Box>
    </ScrollView>
  );
}
