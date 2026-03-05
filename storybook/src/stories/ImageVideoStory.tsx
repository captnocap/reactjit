/**
 * ImageVideoStory — Layout1 documentation for Image & Video.
 *
 * Surface primitives for displaying images and playing video.
 * Both share objectFit, surface fallback sizing, and the same
 * leaf-node contract (no children).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, Image, Video, VideoPlayer, TextEditor, CodeBlock, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

// ── Syntax colors ────────────────────────────────────────

const SYN = {
  tag: '#f38ba8',
  component: '#89b4fa',
  prop: '#cba6f7',
  value: '#f9e2af',
};

// ── Helpers ──────────────────────────────────────────────

function styleTooltip(style: Record<string, any>): { content: string; layout: string; type: string } | undefined {
  const STRUCTURAL = new Set([
    'flexGrow', 'flexShrink', 'flexBasis', 'flexDirection', 'flexWrap',
    'alignItems', 'alignSelf', 'justifyContent', 'overflow',
    'position', 'zIndex', 'display',
  ]);
  const entries = Object.entries(style).filter(([k, v]) => !STRUCTURAL.has(k) && v !== undefined);
  if (entries.length === 0) return undefined;
  const content = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { content, layout: 'table', type: 'cursor' };
}

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── Static data (hoisted — never recreated) ──────────────

const USAGE_CODE = `import { Image, Video, VideoPlayer } from '@reactjit/core';

// Fixed-size image
<Image src="assets/logo.png" style={{ width: 128, height: 128 }} />

// Image with objectFit
<Image
  src="assets/banner.png"
  style={{ width: '100%', height: 200, objectFit: 'contain' }}
/>

// Video with playback events
<Video
  src="assets/demo.mp4"
  loop
  style={{ width: 640, height: 360, objectFit: 'contain' }}
  onTimeUpdate={(e) => console.log(e.currentTime)}
/>

// VideoPlayer with built-in controls
<VideoPlayer src="video.mp4" w={640} h={360} radius={8} />`;

const STARTER_CODE = `<Box style={{ gap: 12, alignItems: 'center' }}>
  <Image
    src="lib/placeholders/landscape.png"
    style={{
      width: 280,
      height: 160,
      objectFit: 'cover',
      borderRadius: 8,
    }}
  />
  <Text style={{ color: '#cdd6f4', fontSize: 12 }}>
    Edit this code to see live changes
  </Text>
</Box>`;

// ── Image props — [name, type, icon] ──

const IMAGE_PROPS: [string, string, string][] = [
  ['src', 'string (required)', 'image'],
  ['style', 'Style', 'layout'],
];

const IMAGE_STYLE_PROPS: [string, string, string][] = [
  ['objectFit', "'fill' | 'contain' | 'cover' | 'none'", 'scaling'],
  ['width / height', 'number | string', 'ruler'],
  ['borderRadius', 'number', 'circle'],
];

const IMAGE_CALLBACKS: [string, string, string][] = [
  ['onClick', '(e: LoveEvent) => void', 'mouse-pointer'],
  ['onWheel', '(e: LoveEvent) => void', 'chevrons-up-down'],
];

// ── Video props — [name, type, icon] ──

const VIDEO_PROPS: [string, string, string][] = [
  ['src', 'string (required)', 'film'],
  ['paused', 'boolean', 'pause'],
  ['volume', 'number (0-1)', 'volume-2'],
  ['muted', 'boolean', 'volume-x'],
  ['loop', 'boolean', 'repeat'],
  ['w / h', 'number | string', 'ruler'],
  ['radius', 'number', 'circle'],
  ['style', 'Style', 'layout'],
];

const VIDEO_CALLBACKS: [string, string, string][] = [
  ['onPlay', '() => void', 'play'],
  ['onPause', '() => void', 'pause'],
  ['onTimeUpdate', '(e: {currentTime, duration}) => void', 'clock'],
  ['onEnded', '() => void', 'square'],
  ['onReady', '() => void', 'check'],
  ['onError', '(e: {message}) => void', 'alert-triangle'],
  ['onClick', '(e: LoveEvent) => void', 'mouse-pointer'],
];

// ── VideoPlayer extras ──

const PLAYER_PROPS: [string, string, string][] = [
  ['controls', 'boolean (default: true)', 'sliders-horizontal'],
  ['...Video props', 'all Video props apply', 'copy'],
];

// ── Box video props ──

const BOX_VIDEO_PROPS: [string, string, string][] = [
  ['backgroundVideo', 'string', 'monitor-play'],
  ['backgroundVideoFit', "'fill' | 'contain' | 'cover'", 'scaling'],
  ['hoverVideo', 'string', 'mouse-pointer'],
  ['hoverVideoFit', "'fill' | 'contain' | 'cover'", 'scaling'],
];

const BEHAVIOR_NOTES = [
  'Both are surface nodes — without explicit dimensions, they fall back to 1/4 of parent (proportional fallback).',
  'Both are leaf elements with no children. src is required on both.',
  'Paths are relative to the project root (where main.lua lives). HTTP/HTTPS URLs work for Video.',
  'objectFit works the same on both: fill (stretch), contain (letterbox), cover (crop), none (native size).',
  'Video uses libmpv for hardware-accelerated decoding. onTimeUpdate fires ~4x/sec.',
  'VideoPlayer adds Lua-native controls (seek, volume, fullscreen). Controls auto-hide after 3s.',
  'Box supports backgroundVideo (loops muted) and hoverVideo (plays on hover) props.',
];

// ── Preview constants ──

const DEMO_VIDEO_SRC = 'docs/experiments/test.mp4';
const P = {
  frame: '#1e1e2e',
  accent: '#89b4fa',
};

// ── Component ────────────────────────────────────────────

export function ImageVideoStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const processCode = useCallback((src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  }, []);

  useEffect(() => {
    if (playground && code && !UserComponent) {
      processCode(code);
    }
  }, [playground]);

  const handleCodeChange = useCallback((src: string) => {
    setCode(src);
    processCode(src);
  }, [processCode]);

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
        <Image src="image" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Image & Video'}
        </Text>

        <Box style={{
          flexDirection: 'row',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Image'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'src'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'='}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'"..."'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'/>'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Pics or it didn\'t happen'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {playground ? (
          <>
            <Box style={{ flexGrow: 1, flexBasis: 0 }}>
              <TextEditor
                initialValue={code}
                onChange={handleCodeChange}
                onBlur={handleCodeChange}
                onSubmit={handleCodeChange}
                changeDelay={3}
                syntaxHighlight
                placeholder="Write JSX here..."
                style={{ flexGrow: 1, width: '100%' }}
                textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
              />
            </Box>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ── Left: Preview ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 20, gap: 14 }}>

                {/* Image objectFit comparison */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'IMAGE — OBJECTFIT'}</Text>
                <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {(['fill', 'contain', 'cover'] as const).map((fit) => {
                    const frame = { width: 120, height: 80, borderRadius: 6, overflow: 'hidden' as const, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame };
                    return (
                      <Box key={fit} style={{ alignItems: 'center', gap: 4 }}>
                        <Box style={frame} tooltip={styleTooltip({ objectFit: fit })}>
                          <Image
                            src="lib/placeholders/landscape.png"
                            style={{ width: '100%', height: '100%', objectFit: fit }}
                          />
                        </Box>
                        <Text style={{ color: c.muted, fontSize: 8 }}>{fit}</Text>
                      </Box>
                    );
                  })}
                </Box>

                {/* Rounded avatar */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'IMAGE — SHAPES'}</Text>
                <Box style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
                  <Box style={{ alignItems: 'center', gap: 4 }}>
                    <Image
                      src="lib/placeholders/avatar.png"
                      style={{ width: 64, height: 64, borderRadius: 32, objectFit: 'cover', borderWidth: 2, borderColor: P.accent }}
                    />
                    <Text style={{ color: c.muted, fontSize: 8 }}>{'avatar'}</Text>
                  </Box>
                  <Box style={{ alignItems: 'center', gap: 4 }}>
                    <Box style={{ width: 120, height: 64, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
                      <Image
                        src="lib/placeholders/poster.png"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 8 }}>{'card cover'}</Text>
                  </Box>
                </Box>

                {/* Video player */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'VIDEO — PLAYER'}</Text>
                <Box style={{ alignItems: 'center' }}>
                  <VideoPlayer src={DEMO_VIDEO_SRC} w={280} h={158} radius={6} />
                </Box>

                {/* Video objectFit — idle mockups */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'VIDEO — OBJECTFIT'}</Text>
                <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {/* fill: stretches to fill, distorts aspect ratio */}
                  <Box style={{ alignItems: 'center', gap: 4 }}>
                    <Box style={{ width: 100, height: 56, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame, justifyContent: 'center', alignItems: 'center' }}>
                      <Box style={{ width: 100, height: 56, backgroundColor: P.accent, opacity: 0.25, borderRadius: 3 }} />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 8 }}>{'fill'}</Text>
                    <Text style={{ color: c.muted, fontSize: 7 }}>{'stretches to fit'}</Text>
                  </Box>
                  {/* contain: fits inside, letterboxed */}
                  <Box style={{ alignItems: 'center', gap: 4 }}>
                    <Box style={{ width: 100, height: 56, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame, justifyContent: 'center', alignItems: 'center' }}>
                      <Box style={{ width: 74, height: 42, backgroundColor: P.accent, opacity: 0.25, borderRadius: 3 }} />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 8 }}>{'contain'}</Text>
                    <Text style={{ color: c.muted, fontSize: 7 }}>{'fits inside, letterbox'}</Text>
                  </Box>
                  {/* cover: fills container, crops overflow */}
                  <Box style={{ alignItems: 'center', gap: 4 }}>
                    <Box style={{ width: 100, height: 56, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                      <Box style={{ width: 100, height: 75, backgroundColor: P.accent, opacity: 0.25, borderRadius: 3 }} />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 8 }}>{'cover'}</Text>
                    <Text style={{ color: c.muted, fontSize: 7 }}>{'fills, crops overflow'}</Text>
                  </Box>
                </Box>

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* Overview */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'OVERVIEW'}</Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'Image displays files/URLs with sizing and objectFit control. Video plays any libmpv-supported format (MP4, MKV, WebM, etc.) with hardware-accelerated decoding. VideoPlayer wraps Video with Lua-native controls. All three are surface nodes — without explicit dimensions they fall back to 1/4 of parent.'}
                </Text>

                <HorizontalDivider />

                {/* Usage */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'USAGE'}</Text>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* Behavior */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'BEHAVIOR'}</Text>
                <Box style={{ gap: 4 }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Image props */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'IMAGE PROPS'}</Text>
                <Box style={{ gap: 3 }}>
                  {IMAGE_PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>

                {/* Image style props */}
                <Box style={{ gap: 3 }}>
                  {IMAGE_STYLE_PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.value} />
                      <Text style={{ color: SYN.value, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>

                {/* Image callbacks */}
                <Box style={{ gap: 3 }}>
                  {IMAGE_CALLBACKS.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Video props */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'VIDEO PROPS'}</Text>
                <Box style={{ gap: 3 }}>
                  {VIDEO_PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>

                {/* Video callbacks */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'CALLBACKS'}</Text>
                <Box style={{ gap: 3 }}>
                  {VIDEO_CALLBACKS.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* VideoPlayer */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'VIDEOPLAYER'}</Text>
                <Box style={{ gap: 3 }}>
                  {PLAYER_PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>
                <Text style={{ color: c.text, fontSize: 9 }}>
                  {'Lua-native controls: play/pause, seek bar, volume, loop, fullscreen. Auto-hide after 3s.'}
                </Text>

                <HorizontalDivider />

                {/* Box video props */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'BOX VIDEO PROPS'}</Text>
                <Box style={{ gap: 3 }}>
                  {BOX_VIDEO_PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>
                <Text style={{ color: c.text, fontSize: 9 }}>
                  {'backgroundVideo loops muted. hoverVideo plays on hover, pauses on leave.'}
                </Text>

              </Box>
            </ScrollView>
          </>
        )}
      </Box>

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
        <Image src="image" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Image & Video'}</Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable
          onPress={() => setPlayground(p => !p)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: playground ? c.primary : (state.hovered ? c.surface : c.border),
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
          })}
        >
          <Image
            src={playground ? 'book-open' : 'play'}
            style={{ width: 10, height: 10 }}
            tintColor={playground ? 'white' : c.text}
          />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
