
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return dateStr;
}

interface GitCommitRowProps {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  isHead?: boolean;
  onPick?: () => void;
  onRevert?: () => void;
}

export function GitCommitRow(props: GitCommitRowProps) {
  return (
    <Row
      style={{
        alignItems: 'center',
        gap: 8,
        padding: 6,
        borderRadius: 6,
        backgroundColor: props.isHead ? COLORS.panelHover : COLORS.panelRaised,
      }}
    >
      <Text fontSize={9} color={COLORS.blue} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
        {props.shortHash}
      </Text>
      <Text fontSize={10} color={COLORS.textBright} style={{ flexShrink: 1, flexBasis: 0 }}>
        {props.message}
      </Text>
      <Box style={{ flexGrow: 1 }} />
      <Text fontSize={9} color={COLORS.textDim}>{props.author}</Text>
      <Text fontSize={9} color={COLORS.textMuted}>{relativeTime(props.date)}</Text>
      {props.onPick ? (
        <Pressable onPress={props.onPick}>
          <Pill label="pick" color={COLORS.green} tiny={true} />
        </Pressable>
      ) : null}
      {props.onRevert ? (
        <Pressable onPress={props.onRevert}>
          <Pill label="revert" color={COLORS.orange} tiny={true} />
        </Pressable>
      ) : null}
    </Row>
  );
}
