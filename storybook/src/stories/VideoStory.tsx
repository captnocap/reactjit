import React, { useState, useRef } from 'react';
import { Box, Text, TextEditor } from '../../../../packages/shared/src';
import { Video } from '../../../../packages/shared/src/Video';
import { VideoPlayer } from '../../../../packages/shared/src/VideoPlayer';

function Card({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
      <Box style={{
        backgroundColor: '#0f1219',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: [1, 1, 1, 0.06],
        alignItems: 'center',
      }}>
        {children}
      </Box>
    </Box>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <Box style={{
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      backgroundColor: [1, 1, 1, 0.05],
      borderRadius: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 4,
      paddingBottom: 4,
    }}>
      <Text style={{ color: '#64748b', fontSize: 9 }}>{label}</Text>
      <Text style={{ color: '#e2e8f0', fontSize: 9, fontWeight: 'bold' }}>{value}</Text>
    </Box>
  );
}

export function VideoStory() {
  const [status, setStatus] = useState('Idle');
  const [time, setTime] = useState('0:00');

  return (
    <Box style={{ gap: 20, padding: 20 }}>
      {/* Header */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>Video</Text>
        <Text style={{ color: '#64748b', fontSize: 11 }}>
          Any format in, Theora out. Local files and M3U8/HLS streams via FFmpeg.
        </Text>
      </Box>

      {/* Two-column layout */}
      <Box style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
        {/* Left column */}
        <Box style={{ gap: 16, flexGrow: 1, width: 280 }}>
          {/* Bare primitive */}
          <Card label="VIDEO PRIMITIVE">
            <Box style={{ gap: 10, alignItems: 'center' }}>
              <Video
                src="sample.ogv"
                w={248}
                h={140}
                style={{ borderRadius: 6 }}
                loop
                onReady={() => setStatus('Ready')}
                onPlay={() => setStatus('Playing')}
                onPause={() => setStatus('Paused')}
                onEnded={() => setStatus('Ended')}
                onError={() => setStatus('No file')}
                onTimeUpdate={(e) => {
                  const m = Math.floor(e.currentTime / 60);
                  const s = Math.floor(e.currentTime % 60);
                  setTime(`${m}:${s < 10 ? '0' : ''}${s}`);
                }}
              />
              <Box style={{ flexDirection: 'row', gap: 6, width: 248, justifyContent: 'center' }}>
                <StatusPill label="Status" value={status} />
                <StatusPill label="Time" value={time} />
              </Box>
            </Box>
          </Card>

          {/* Compact variants */}
          <Card label="SIZES">
            <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'end', width: 248 }}>
              <Box style={{ gap: 4, alignItems: 'center', width: 90 }}>
                <Video src="sample.ogv" w={90} h={50} style={{ borderRadius: 4 }} />
                <Text style={{ color: '#475569', fontSize: 8 }}>90x50</Text>
              </Box>
              <Box style={{ gap: 4, alignItems: 'center', width: 60 }}>
                <Video src="sample.ogv" w={60} h={60} style={{ borderRadius: 30 }} />
                <Text style={{ color: '#475569', fontSize: 8 }}>Round</Text>
              </Box>
              <Box style={{ gap: 4, alignItems: 'center', width: 50 }}>
                <Video src="sample.ogv" w={50} h={70} style={{ borderRadius: 4 }} />
                <Text style={{ color: '#475569', fontSize: 8 }}>Portrait</Text>
              </Box>
            </Box>
          </Card>
        </Box>

        {/* Right column */}
        <Box style={{ gap: 16, flexGrow: 1, width: 280 }}>
          {/* VideoPlayer */}
          <Card label="VIDEO PLAYER">
            <Box style={{ gap: 6, alignItems: 'center' }}>
              <VideoPlayer
                src="sample.ogv"
                w={248}
                h={140}
                radius={6}
              />
              <Text style={{ color: '#475569', fontSize: 9 }}>
                Built-in play/pause, seek bar, and time display
              </Text>
            </Box>
          </Card>

          {/* Transcoding demo */}
          <Card label="FFMPEG TRANSCODING">
            <Box style={{ gap: 6, alignItems: 'center' }}>
              <Video
                src="sample.mp4"
                w={248}
                h={100}
                style={{ borderRadius: 6 }}
              />
              <Text style={{ color: '#475569', fontSize: 9 }}>
                Non-.ogv sources trigger async FFmpeg conversion
              </Text>
            </Box>
          </Card>
        </Box>
      </Box>

      {/* M3U8 / HLS Stream loader */}
      <StreamLoader />

      {/* Usage block */}
      <Box style={{
        backgroundColor: [1, 1, 1, 0.03],
        borderRadius: 6,
        padding: 12,
        borderWidth: 1,
        borderColor: [1, 1, 1, 0.04],
      }}>
        <Text style={{ color: '#64748b', fontSize: 9 }}>
          Supports local files (.ogv instant, others via FFmpeg) and HTTP URLs including M3U8/HLS
          streams. VOD streams are transcoded to Theora on the fly.
        </Text>
      </Box>
    </Box>
  );
}

function StreamLoader() {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string>('Paste a URL');
  const lastSubmit = useRef('');

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    lastSubmit.current = trimmed;
    setLoadedUrl(trimmed);
    setStreamStatus('Loading...');
  };

  return (
    <Card label="M3U8 / HLS STREAM">
      <Box style={{ gap: 10, width: '100%' }}>
        {/* URL input */}
        <Box style={{ gap: 4 }}>
          <TextEditor
            onSubmit={handleSubmit}
            placeholder="Paste an M3U8 URL, then Ctrl+Enter to load"
            lineNumbers={false}
            style={{
              backgroundColor: '#1a1f2e',
              borderRadius: 6,
              width: '100%',
              height: 32,
            }}
            textStyle={{ fontSize: 10, color: '#e2e8f0' }}
          />
          <Text style={{ color: '#334155', fontSize: 8 }}>
            Ctrl+V to paste, Ctrl+Enter to load
          </Text>
        </Box>

        {/* Video player or placeholder */}
        {loadedUrl ? (
          <Box style={{ gap: 6, alignItems: 'center' }}>
            <VideoPlayer
              src={loadedUrl}
              w={560}
              h={240}
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
            backgroundColor: '#0a0e17',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: [1, 1, 1, 0.06],
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}>
            <Text style={{ color: '#334155', fontSize: 24 }}>&#9655;</Text>
            <Text style={{ color: '#475569', fontSize: 10 }}>
              Paste an M3U8 URL above and hit Load
            </Text>
            <Text style={{ color: '#334155', fontSize: 8 }}>
              FFmpeg downloads + transcodes the stream to Theora
            </Text>
          </Box>
        )}
      </Box>
    </Card>
  );
}
