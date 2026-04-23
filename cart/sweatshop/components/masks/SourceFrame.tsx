const React: any = require('react');

import { Box, Image } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { MediaItem } from '../media/useMediaStore';

const Video: any = (props: any) => React.createElement('Video', props, props.children);

export function SourceFrame(props: { item: MediaItem; style?: any }) {
  const item = props.item;
  if (item.kind === 'video') {
    return <Video source={item.source} video_src={item.source} paused={!item.video.playing} loop={item.video.loop} volume={item.video.volume} rate={item.video.rate} time={item.video.time} style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg, ...(props.style || {}) }} />;
  }
  return <Image source={item.source} style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg, objectFit: 'cover', ...(props.style || {}) }} />;
}
