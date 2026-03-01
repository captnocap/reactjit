import React, { useState } from 'react';
import { Box, Text, TextInput, Video, VideoPlayer } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

const DEMO_VIDEO_SRC = 'docs/experiments/test.mp4';
const DEMO_VIDEO_FITS: Array<'contain' | 'cover' | 'fill'> = ['contain', 'cover', 'fill'];

function StatusPill({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 4,
      paddingBottom: 4,
      borderRadius: 6,
      backgroundColor: c.surface,
    }}>
      <Text style={{ color: c.textDim, fontSize: 9 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 9, fontWeight: 'normal' }}>{value}</Text>
    </Box>
  );
}

function FitPreview({ fit }: { fit: 'contain' | 'cover' | 'fill' }) {
  const c = useThemeColors();
  return (
    <Box style={{ width: 156, gap: 4, alignItems: 'center' }}>
      <Text style={{ color: c.textSecondary, fontSize: 9, textAlign: 'center' }}>{fit}</Text>
      <Box
        style={{
          width: 150,
          height: 84,
          borderRadius: 6,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Video
          src={DEMO_VIDEO_SRC}
          w={150}
          h={84}
          paused
          style={{ objectFit: fit }}
        />
      </Box>
    </Box>
  );
}

function PlayIcon() {
  const c = useThemeColors();
  return (
    <Box style={{
      width: 0, height: 0,
      borderLeftWidth: 14, borderLeftColor: c.textDim,
      borderTopWidth: 8, borderTopColor: 'transparent',
      borderBottomWidth: 8, borderBottomColor: 'transparent',
    }} />
  );
}

function StreamLoader() {
  const c = useThemeColors();
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string>('Paste an HLS URL and submit');

  return (
    <Box style={{ gap: 8, width: '100%', maxWidth: 520, alignItems: 'center' }}>
      <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
        mpv streams HTTP/HTTPS URLs directly. Paste an `.m3u8` URL and press Ctrl+Enter.
      </Text>
      <TextInput
        onSubmit={(text) => {
          const next = text.trim();
          if (!next) return;
          setLoadedUrl(next);
          setStreamStatus('Loading...');
        }}
        placeholder="https://example.com/stream.m3u8"
        keyboardType="url"
        style={{
          width: '100%',
          height: 34,
          backgroundColor: c.bg,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: c.border,
          paddingLeft: 10,
          paddingRight: 10,
        }}
        textStyle={{ fontSize: 10, color: c.text }}
      />

      {loadedUrl ? (
        <Box style={{ gap: 8, width: '100%', alignItems: 'center' }}>
          <VideoPlayer
            src={loadedUrl}
            w="100%"
            h={260}
            radius={6}
            onReady={() => setStreamStatus('Ready')}
            onPlay={() => setStreamStatus('Playing')}
            onPause={() => setStreamStatus('Paused')}
            onError={() => setStreamStatus('Error')}
          />
          <StatusPill label="Stream" value={streamStatus} />
        </Box>
      ) : (
        <Box style={{
          width: '100%',
          height: 120,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
        }}>
          <PlayIcon />
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>
            No stream loaded yet
          </Text>
        </Box>
      )}
    </Box>
  );
}

export function VideoStory() {
  const c = useThemeColors();
  const [status, setStatus] = useState('Idle');
  const [time, setTime] = useState('0:00');

  return (
    <StoryPage>
      <StorySection index={1} title="Video primitive (`Video`)">
        <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
          The Love2D runtime renders through libmpv. Formats like MP4, WebM, MKV, and OGV
          are loaded directly without a Theora conversion pass.
        </Text>
        <Box style={{ width: '100%', maxWidth: 520, gap: 8, alignItems: 'center' }}>
          <Video
            src={DEMO_VIDEO_SRC}
            style={{
              width: '100%',
              aspectRatio: 16 / 9,
              borderRadius: 6,
              objectFit: 'contain',
              backgroundColor: c.surface,
            }}
            loop
            onReady={() => setStatus('Ready')}
            onPlay={() => setStatus('Playing')}
            onPause={() => setStatus('Paused')}
            onEnded={() => setStatus('Ended')}
            onError={() => setStatus('Error')}
            onTimeUpdate={(e) => {
              const m = Math.floor(e.currentTime / 60);
              const s = Math.floor(e.currentTime % 60);
              setTime(`${m}:${s < 10 ? '0' : ''}${s}`);
            }}
          />
          <Box style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
            <StatusPill label="Status" value={status} />
            <StatusPill label="Time" value={time} />
          </Box>
        </Box>
      </StorySection>

      <StorySection index={2} title="Player controls (`VideoPlayer`)">
        <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
          `VideoPlayer` is Lua-owned UI over the same mpv backend: play/pause, seek, volume,
          loop, and fullscreen.
        </Text>
        <Box style={{ width: '100%', maxWidth: 520, gap: 8, alignItems: 'center' }}>
          <VideoPlayer src={DEMO_VIDEO_SRC} w="100%" h={292} radius={6} />
          <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
            objectFit preview (contain / cover / fill)
          </Text>
          <Box
            style={{
              width: '100%',
              flexDirection: 'row',
              gap: 8,
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {DEMO_VIDEO_FITS.map((fit) => (
              <FitPreview key={fit} fit={fit} />
            ))}
          </Box>
        </Box>
      </StorySection>

      <StorySection index={3} title="M3U8 / HLS stream URL">
        <StreamLoader />
      </StorySection>

      <StorySection index={4} title="Runtime notes">
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          Love2D: mpv renders into a private OpenGL framebuffer, then blits into a Canvas each frame.
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          Web: falls back to native HTML5 video behavior.
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          Grid targets (terminal/cc/nvim/awesome): video is not rendered.
        </Text>
      </StorySection>
    </StoryPage>
  );
}
