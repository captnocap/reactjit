import { Box, Col, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { Message } from '../../lib/ai/types';
import { MessageBubble } from '../ai/MessageBubble';
import { StreamingMessage } from '../ai/StreamingMessage';

const ROW_HEIGHT = 96;
const OVERSCAN = 8;
const VIEWPORT_ESTIMATE = 540;

export function ConversationView(props: {
  messages: Message[];
  streamingText?: string;
  isStreaming?: boolean;
}) {
  const [scrollY, setScrollY] = useState(0);
  const count = props.messages.length;
  const virtualized = count > 200;
  const start = virtualized ? Math.max(0, Math.floor(scrollY / ROW_HEIGHT) - OVERSCAN) : 0;
  const end = virtualized ? Math.min(count, Math.ceil((scrollY + VIEWPORT_ESTIMATE) / ROW_HEIGHT) + OVERSCAN) : count;
  const visible = props.messages.slice(start, end);
  const topPad = virtualized ? start * ROW_HEIGHT : 0;
  const bottomPad = virtualized ? Math.max(0, (count - end) * ROW_HEIGHT) : 0;

  useEffect(() => {
    setScrollY(999999);
  }, [count, props.streamingText, props.isStreaming]);

  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, overflow: 'hidden' }}>
      <ScrollView
        showScrollbar={true}
        scrollY={scrollY}
        onScroll={(payload: any) => {
          const next = typeof payload?.scrollY === 'number' ? payload.scrollY : 0;
          if (Math.abs(next - scrollY) >= 12) setScrollY(next);
        }}
        style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}
      >
        <Col style={{ padding: 12, gap: 12 }}>
          {count === 0 ? (
            <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={TOKENS.fontSm} color={COLORS.textDim}>Select a session or start a new chat.</Text>
            </Box>
          ) : null}
          {topPad > 0 ? <Box style={{ height: topPad }} /> : null}
          {visible.map((message, index) => (
            <MessageBubble key={`${message.role}-${start + index}-${(typeof message.content === 'string' ? message.content : '').slice(0, 12)}`} message={message} />
          ))}
          {bottomPad > 0 ? <Box style={{ height: bottomPad }} /> : null}
          {props.isStreaming ? <StreamingMessage text={props.streamingText || ''} /> : null}
        </Col>
      </ScrollView>
    </Box>
  );
}

