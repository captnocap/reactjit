/**
 * ImageVideoStory — Layout1 documentation for Image & Video.
 *
 * Surface primitives for displaying images and playing video.
 * Both share objectFit, surface fallback sizing, and the same
 * leaf-node contract (no children).
 */

import React, { useState } from 'react';
import { Box, Text, Image, Video, VideoPlayer, TextEditor, CodeBlock, Pressable, ScrollView, useMount, classifiers as S} from '../../../packages/core/src';
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
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
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

  const processCode = (src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  };

  useMount(() => {
    if (code) processCode(code);
  });

  const handleCodeChange = (src: string) => {
    setCode(src);
    processCode(src);
  };

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.PrimaryIcon20 src="image" />

        <S.StoryTitle>
          {'Image & Video'}
        </S.StoryTitle>

        <S.StoryBtnSm style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Image'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'src'}</Text>
          <S.StoryMuted>{'='}</S.StoryMuted>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'"..."'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'/>'}</Text>
        </S.StoryBtnSm>

        <Box style={{ flexGrow: 1 }} />

        <S.StoryMuted>
          {'Pics or it didn\'t happen'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <S.RowGrow>
        {playground ? (
          <>
            <S.Half>
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
            </S.Half>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ── Left: Preview ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 20, gap: 14 }}>

                {/* Image objectFit comparison */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'IMAGE — OBJECTFIT'}</S.StoryTiny>
                <S.RowG8 style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                  {(['fill', 'contain', 'cover'] as const).map((fit) => {
                    const frame = { width: 120, height: 80, borderRadius: 6, overflow: 'hidden' as const, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame };
                    return (
                      <S.CenterG4 key={fit}>
                        <Box style={frame} tooltip={styleTooltip({ objectFit: fit })}>
                          <Image
                            src="lib/placeholders/landscape.png"
                            style={{ width: '100%', height: '100%', objectFit: fit }}
                          />
                        </Box>
                        <S.StoryTiny>{fit}</S.StoryTiny>
                      </S.CenterG4>
                    );
                  })}
                </S.RowG8>

                {/* Rounded avatar */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'IMAGE — SHAPES'}</S.StoryTiny>
                <S.RowCenterG12 style={{ justifyContent: 'center' }}>
                  <S.CenterG4>
                    <Image
                      src="lib/placeholders/avatar.png"
                      style={{ width: 64, height: 64, borderRadius: 32, objectFit: 'cover', borderWidth: 2, borderColor: P.accent }}
                    />
                    <S.StoryTiny>{'avatar'}</S.StoryTiny>
                  </S.CenterG4>
                  <S.CenterG4>
                    <S.Bordered style={{ width: 120, height: 64, borderRadius: 8, overflow: 'hidden' }}>
                      <Image
                        src="lib/placeholders/poster.png"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </S.Bordered>
                    <S.StoryTiny>{'card cover'}</S.StoryTiny>
                  </S.CenterG4>
                </S.RowCenterG12>

                {/* Video player */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'VIDEO — PLAYER'}</S.StoryTiny>
                <Box style={{ alignItems: 'center' }}>
                  <VideoPlayer src={DEMO_VIDEO_SRC} w={280} h={158} radius={6} />
                </Box>

                {/* Video objectFit — idle mockups */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'VIDEO — OBJECTFIT'}</S.StoryTiny>
                <S.RowG8 style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                  {/* fill: stretches to fill, distorts aspect ratio */}
                  <S.CenterG4>
                    <Box style={{ width: 100, height: 56, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame, justifyContent: 'center', alignItems: 'center' }}>
                      <Box style={{ width: 100, height: 56, backgroundColor: P.accent, opacity: 0.25, borderRadius: 3 }} />
                    </Box>
                    <S.StoryTiny>{'fill'}</S.StoryTiny>
                    <Text style={{ color: c.muted, fontSize: 7 }}>{'stretches to fit'}</Text>
                  </S.CenterG4>
                  {/* contain: fits inside, letterboxed */}
                  <S.CenterG4>
                    <Box style={{ width: 100, height: 56, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame, justifyContent: 'center', alignItems: 'center' }}>
                      <Box style={{ width: 74, height: 42, backgroundColor: P.accent, opacity: 0.25, borderRadius: 3 }} />
                    </Box>
                    <S.StoryTiny>{'contain'}</S.StoryTiny>
                    <Text style={{ color: c.muted, fontSize: 7 }}>{'fits inside, letterbox'}</Text>
                  </S.CenterG4>
                  {/* cover: fills container, crops overflow */}
                  <S.CenterG4>
                    <Box style={{ width: 100, height: 56, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: P.frame, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                      <Box style={{ width: 100, height: 75, backgroundColor: P.accent, opacity: 0.25, borderRadius: 3 }} />
                    </Box>
                    <S.StoryTiny>{'cover'}</S.StoryTiny>
                    <Text style={{ color: c.muted, fontSize: 7 }}>{'fills, crops overflow'}</Text>
                  </S.CenterG4>
                </S.RowG8>

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <S.StackG10W100 style={{ padding: 14 }}>

                {/* Overview */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'OVERVIEW'}</S.StoryTiny>
                <S.StoryBody>
                  {'Image displays files/URLs with sizing and objectFit control. Video plays any libmpv-supported format (MP4, MKV, WebM, etc.) with hardware-accelerated decoding. VideoPlayer wraps Video with Lua-native controls. All three are surface nodes — without explicit dimensions they fall back to 1/4 of parent.'}
                </S.StoryBody>

                <HorizontalDivider />

                {/* Usage */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'USAGE'}</S.StoryTiny>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* Behavior */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'BEHAVIOR'}</S.StoryTiny>
                <Box style={{ gap: 4, width: '100%' }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <S.RowG6 key={i} style={{ alignItems: 'flex-start', width: '100%' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8, flexShrink: 0, marginTop: 2 }} tintColor={c.muted} />
                      <S.StoryBody style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>{note}</S.StoryBody>
                    </S.RowG6>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Image props */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'IMAGE PROPS'}</S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {IMAGE_PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{type}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                {/* Image style props */}
                <Box style={{ gap: 3 }}>
                  {IMAGE_STYLE_PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.value} />
                      <Text style={{ color: SYN.value, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{type}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                {/* Image callbacks */}
                <Box style={{ gap: 3 }}>
                  {IMAGE_CALLBACKS.map(([name, sig, icon]) => (
                    <S.RowCenterG5 key={name}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <S.StoryCap>{sig}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Video props */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'VIDEO PROPS'}</S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {VIDEO_PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{type}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                {/* Video callbacks */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'CALLBACKS'}</S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {VIDEO_CALLBACKS.map(([name, sig, icon]) => (
                    <S.RowCenterG5 key={name}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <S.StoryCap>{sig}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* VideoPlayer */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'VIDEOPLAYER'}</S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {PLAYER_PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{type}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>
                <S.StoryBreadcrumbActive>
                  {'Lua-native controls: play/pause, seek bar, volume, loop, fullscreen. Auto-hide after 3s.'}
                </S.StoryBreadcrumbActive>

                <HorizontalDivider />

                {/* Box video props */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'BOX VIDEO PROPS'}</S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {BOX_VIDEO_PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{type}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>
                <S.StoryBreadcrumbActive>
                  {'backgroundVideo loops muted. hoverVideo plays on hover, pauses on leave.'}
                </S.StoryBreadcrumbActive>

              </S.StackG10W100>
            </ScrollView>
          </>
        )}
      </S.RowGrow>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Core'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="image" />
        <S.StoryBreadcrumbActive>{'Image & Video'}</S.StoryBreadcrumbActive>

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
          <S.StorySectionIcon src={playground ? 'book-open' : 'play'} tintColor={playground ? 'white' : c.text} />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
