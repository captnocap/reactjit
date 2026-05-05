import { useMemo } from 'react';
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import { MediaRange } from './MediaControls';
import type { MediaItem } from './useMediaStore';

const Video: any = (props: any) => React.createElement('Video', props, props.children);

function TimeLabel(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins + ':' + String(secs).padStart(2, '0');
}

function ToggleChip(props: { active?: boolean; label: string; onPress: () => void }) {
  const active = props.active === true;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: active ? COLORS.blue : COLORS.border,
        backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Text fontSize={10} color={active ? COLORS.blue : COLORS.text}>{props.label}</Text>
    </Pressable>
  );
}

export function VideoSurface(props: { item: MediaItem; onUpdate: (patch: Partial<MediaItem>) => void }) {
  const item = props.item;
  const playLabel = item.video.playing ? 'pause' : 'play';
  const progress = item.video.duration > 0 ? Math.max(0, Math.min(1, item.video.time / item.video.duration)) : 0;
  const timeLabel = useMemo(() => TimeLabel(item.video.time), [item.video.time]);
  const durationLabel = useMemo(() => TimeLabel(item.video.duration), [item.video.duration]);

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 10, padding: 12 }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.title}</Text>
          <Text fontSize={10} color={COLORS.textDim}>{item.source}</Text>
        </Col>
        <Row style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ToggleChip active={item.video.playing} label={item.video.playing ? 'playing' : 'paused'} onPress={() => props.onUpdate({ video: { playing: !item.video.playing } })} />
          <ToggleChip active={item.video.loop} label={item.video.loop ? 'loop on' : 'loop off'} onPress={() => props.onUpdate({ video: { loop: !item.video.loop } })} />
        </Row>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
        <Box style={{ width: '100%', maxWidth: 880, gap: 10 }}>
          <Box style={{ borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS[item.bgToken], boxShadow: item.shadow ? TOKENS.shadow3 : TOKENS.shadow0, overflow: 'hidden' }}>
            <Video
              source={item.source}
              video_src={item.source}
              paused={!item.video.playing}
              loop={item.video.loop}
              volume={item.video.volume}
              rate={item.video.rate}
              time={item.video.time}
              style={{ width: '100%', height: 280, backgroundColor: COLORS.panelBg }}
            />
          </Box>

          <Col style={{ gap: 8, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Row style={{ gap: 8, alignItems: 'center' }}>
                <Icon name={item.video.playing ? 'pause' : 'play'} size={12} color={COLORS.blue} />
                <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{playLabel}</Text>
                <Text fontSize={10} color={COLORS.textDim}>{timeLabel + ' / ' + durationLabel}</Text>
              </Row>
              <Text fontSize={10} color={COLORS.textDim}>{Math.round(item.video.volume * 100) + '%'}</Text>
            </Row>

            <MediaRange
              label="Scrub"
              value={item.video.time}
              min={0}
              max={Math.max(item.video.duration, 1)}
              onChange={(next) => props.onUpdate({ video: { time: Math.max(0, Math.min(item.video.duration, next)) } })}
              formatValue={(next) => TimeLabel(next)}
            />

            <MediaRange
              label="Volume"
              value={item.video.volume}
              min={0}
              max={1}
              onChange={(next) => props.onUpdate({ video: { volume: Math.max(0, Math.min(1, next)) } })}
              formatValue={(next) => Math.round(next * 100) + '%'}
            />

            <MediaRange
              label="Rate"
              value={item.video.rate}
              min={0.25}
              max={4}
              onChange={(next) => props.onUpdate({ video: { rate: Math.max(0.25, Math.min(4, Math.round(next * 4) / 4)) } })}
              formatValue={(next) => next.toFixed(2) + 'x'}
            />
          </Col>
        </Box>
      </Row>
    </Col>
  );
}
