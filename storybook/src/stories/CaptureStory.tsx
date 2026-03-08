/**
 * Capture — Screenshot, GIF, and Video recording.
 *
 * Screenshot, animated GIF, and MP4/WebM video recording.
 * All capture runs in Lua — React hooks poll status and surface results.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, useGifRecorder, useRecorder, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, Divider, SectionLabel } from './_shared/StoryScaffold';

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

const ST_BTN = {
  paddingLeft: 14, paddingRight: 14,
  paddingTop: 8, paddingBottom: 8,
  borderRadius: 6,
} as const;

const ST_BTN_SM = {
  paddingLeft: 10, paddingRight: 10,
  paddingTop: 5, paddingBottom: 5,
  borderRadius: 4,
} as const;

const ST_ROW = {
  flexDirection: 'row' as const,
  gap: 8,
  alignItems: 'center' as const,
};

const ST_STAT_ROW = {
  flexDirection: 'row' as const,
  gap: 16,
  flexWrap: 'wrap' as const,
};

const ST_BADGE = {
  paddingLeft: 8, paddingRight: 8,
  paddingTop: 3, paddingBottom: 3,
  borderRadius: 4,
} as const;

// ── Sub-components ───────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{ ...ST_BADGE, backgroundColor: color + '22' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </Box>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 2 }}>
      <S.StoryCap>{label}</S.StoryCap>
      <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </Box>
  );
}

// ── GIF Demo ─────────────────────────────────────────────

function GifDemo() {
  const { recording, frames, gifPath, start, stop } = useGifRecorder();

  const toggle = useCallback(() => {
    if (recording) { stop(); } else { start({ fps: 15 }); }
  }, [recording, start, stop]);

  return (
    <Box style={{ gap: 10, width: '100%' }}>
      <Box style={ST_ROW}>
        <Pressable onPress={toggle}>
          <Box style={{ ...ST_BTN, backgroundColor: recording ? C.accent : C.gif }}>
            <Text style={{ color: '#1e1e2e', fontSize: 12, fontWeight: '700' }}>
              {recording ? 'Stop GIF' : 'Record GIF'}
            </Text>
          </Box>
        </Pressable>
        {recording && <Badge label={`${frames} frames`} color={C.gif} />}
        {gifPath && !recording && <Badge label="Saved" color={C.gif} />}
      </Box>
      {gifPath && !recording && (
        <S.StoryCap>{gifPath}</S.StoryCap>
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
      <Box style={ST_ROW}>
        {!recording && (
          <>
            <Pressable onPress={cycleFormat}>
              <Box style={{ ...ST_BTN_SM, backgroundColor: c.surface }}>
                <Text style={{ color: c.text, fontSize: 11 }}>{selectedFormat.toUpperCase()}</Text>
              </Box>
            </Pressable>
            <Pressable onPress={cycleFps}>
              <Box style={{ ...ST_BTN_SM, backgroundColor: c.surface }}>
                <Text style={{ color: c.text, fontSize: 11 }}>{`${selectedFps}fps`}</Text>
              </Box>
            </Pressable>
          </>
        )}
        <Pressable onPress={toggle}>
          <Box style={{ ...ST_BTN, backgroundColor: recording ? C.accent : C.video }}>
            <Text style={{ color: '#1e1e2e', fontSize: 12, fontWeight: '700' }}>
              {recording ? 'Stop Recording' : 'Record Video'}
            </Text>
          </Box>
        </Pressable>
      </Box>
      {recording && (
        <Box style={ST_STAT_ROW}>
          <StatBox label="Format" value={(format ?? 'mp4').toUpperCase()} />
          <StatBox label="Frames" value={`${frames}`} />
          <StatBox label="Duration" value={`${duration.toFixed(1)}s`} />
        </Box>
      )}
      {filePath && !recording && (
        <Box style={{ gap: 4 }}>
          <Badge label="Saved" color={C.video} />
          <Text style={{ color: C.video, fontSize: 9, marginTop: 4 }}>{filePath}</Text>
        </Box>
      )}
    </Box>
  );
}

// ── CaptureStory ─────────────────────────────────────────

export function CaptureStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

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
        <Image src="camera" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <S.StoryTitle>{'Capture'}</S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'Screenshot · GIF · Video'}</S.StoryCap>
      </Box>

      {/* ── Content ── */}
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
            {'Screenshot, GIF, and video recording from one pipeline.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'PNG snapshots via F2 or headless CLI, animated GIFs with ffmpeg 2-pass palette optimization, and MP4/WebM video via raw RGBA pixel pipe. All three share the same Love2D captureScreenshot callback — React declares what to capture, Lua executes it.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — CAPTURE MODES ── */}
        <Band>
          <Half>
            <SectionLabel icon="camera" accentColor={C.accent}>{'CAPTURE MODES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Three output formats sharing one capture pipeline. Each mode is a toggle — start and stop. No file management, no format negotiation.'}
            </Text>
            <Box style={{ gap: 6, width: '100%' }}>
              <Box style={ST_ROW}>
                <Badge label="Screenshot" color={C.screenshot} />
                <S.StoryCap>{'Single-frame PNG via F2 or CLI'}</S.StoryCap>
              </Box>
              <Box style={ST_ROW}>
                <Badge label="GIF" color={C.gif} />
                <S.StoryCap>{'Animated GIF with ffmpeg 2-pass palette'}</S.StoryCap>
              </Box>
              <Box style={ST_ROW}>
                <Badge label="Video" color={C.video} />
                <S.StoryCap>{'MP4/WebM via raw RGBA pipe to ffmpeg'}</S.StoryCap>
              </Box>
            </Box>
          </Half>
          <Half>
            <CodeBlock language="lua" fontSize={9} code={SCREENSHOT_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 2: demo + code — GIF RECORDING ── */}
        <Band>
          <Half>
            <SectionLabel icon="film" accentColor={C.gif}>{'GIF RECORDING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Captures frames at configurable FPS, saves numbered PNGs, then assembles via ffmpeg with a two-pass palette for high-quality 128-color GIFs with Bayer dithering.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'~2ms per frame (PNG encode + FS write). Use 15fps for CPU-bound apps.'}
            </Text>
            <GifDemo />
          </Half>
          <Half>
            <CodeBlock language="typescript" fontSize={9} code={GIF_HOOK_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: code | demo + text — VIDEO RECORDING ── */}
        <Band>
          <Half>
            <CodeBlock language="typescript" fontSize={9} code={VIDEO_HOOK_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="video" accentColor={C.video}>{'VIDEO RECORDING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Pipes raw RGBA pixels directly to ffmpeg stdin. No temp files, no PNG encoding. ffmpeg runs in a separate process and encodes in parallel with Love2D rendering.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'H.264 ultrafast preset by default. ~0.3ms per frame — just a memcpy to the pipe buffer.'}
            </Text>
            <VideoDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: zero JS ── */}
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
            {'All capture runs in Lua. React hooks poll status and surface the result path — no pixel data crosses the JS bridge. The RGBA pipe to ffmpeg is a direct memory write.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 4: text | code — RPC API ── */}
        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.accent}>{'RPC API'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'All capture methods are available as Lua RPCs for direct control from any context. The React hooks are thin wrappers over these RPCs.'}
            </Text>
            <Box style={{ gap: 4, width: '100%' }}>
              <Box style={ST_ROW}>
                <Badge label="recorder:start" color={C.video} />
                <Badge label="recorder:stop" color={C.video} />
              </Box>
              <Box style={ST_ROW}>
                <Badge label="recorder:status" color={C.video} />
                <Badge label="gif:start" color={C.gif} />
              </Box>
              <Box style={ST_ROW}>
                <Badge label="gif:stop" color={C.gif} />
                <Badge label="gif:status" color={C.gif} />
              </Box>
            </Box>
          </Half>
          <Half>
            <CodeBlock language="lua" fontSize={9} code={RPC_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: text | code — PERFORMANCE ── */}
        <Band>
          <Half>
            <SectionLabel icon="zap" accentColor={C.perf}>{'PERFORMANCE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Video piping is ~6x faster than GIF per frame. Raw RGBA goes straight to ffmpeg stdin — no PNG encoding, no filesystem I/O.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'ffmpeg encodes in a separate process in parallel with rendering, so the per-frame cost is nearly free.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="text" fontSize={9} code={PERF_NOTES} />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: one-liner philosophy ── */}
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
            {'One hook. Toggle start/stop. Format, fps, and output path are options — the defaults work. Check filePath or gifPath when stopped for the result.'}
          </Text>
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
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="camera" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Capture'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </S.StoryRoot>
  );
}
