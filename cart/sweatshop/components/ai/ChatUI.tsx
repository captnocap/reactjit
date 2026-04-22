
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { Message } from '../../lib/ai/types';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { ToolCallCard } from './ToolCallCard';

// Composed chat surface. Stateless w.r.t. the chat loop — caller passes
// a `useChat()` result. We own the input state and the streaming tail
// text only.

export function ChatUI(props: {
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  streamingText: string;
  onSend: (text: string) => void;
  onStop: () => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    // Rely on the primitive's auto-scroll — best effort only.
  }, [props.messages.length, props.streamingText]);

  const submit = () => {
    const text = input.trim();
    if (!text || props.isLoading) return;
    setInput('');
    props.onSend(text);
  };

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: TOKENS.spaceSm }}>
      <ScrollView style={{
        flexGrow: 1, flexBasis: 0,
        borderWidth: 1, borderColor: COLORS.borderSoft,
        borderRadius: TOKENS.radiusSm,
        backgroundColor: COLORS.panelBg,
      }}>
        <Col style={{ padding: TOKENS.padNormal, gap: TOKENS.spaceMd }}>
          {props.messages.length === 0 && !props.isStreaming ? (
            <Text fontSize={TOKENS.fontSm} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontUI, padding: TOKENS.padNormal }}>
              Start a conversation. Shift+Enter for newline; Enter to send.
            </Text>
          ) : null}
          {props.messages.map((m, i) => (
            <Col key={i} style={{ gap: TOKENS.spaceXs }}>
              {m.role === 'tool' ? (
                <ToolCallCard call={{ id: m.toolCallId || '', name: 'result', arguments: '{}' }} result={typeof m.content === 'string' ? m.content : JSON.stringify(m.content)} />
              ) : (
                <MessageBubble message={m} />
              )}
              {m.toolCalls?.map((tc) => (
                <ToolCallCard key={tc.id} call={tc} pending={true} />
              ))}
            </Col>
          ))}
          {props.isStreaming ? <StreamingMessage text={props.streamingText} /> : null}
        </Col>
      </ScrollView>

      <Row style={{ gap: 6, alignItems: 'flex-end' }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          multiline={true}
          placeholder={props.placeholder || 'Message…'}
          style={{
            flexGrow: 1, flexBasis: 0, minHeight: 32, maxHeight: 140,
            paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
            borderWidth: 1, borderColor: COLORS.border,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: COLORS.panelBg,
            fontFamily: TOKENS.fontUI, fontSize: TOKENS.fontSm,
            color: COLORS.text,
          }}
        />
        {props.isLoading ? (
          <Pressable onPress={props.onStop}>
            <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
              <Text fontSize={TOKENS.fontXs} color={COLORS.red} style={{ fontWeight: 'bold' }}>stop</Text>
            </Box>
          </Pressable>
        ) : (
          <Pressable onPress={submit}>
            <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
              <Text fontSize={TOKENS.fontXs} color={COLORS.blue} style={{ fontWeight: 'bold' }}>send</Text>
            </Box>
          </Pressable>
        )}
      </Row>
    </Col>
  );
}
