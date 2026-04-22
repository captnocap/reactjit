const React: any = require('react');
import { Box, Col, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { FadeIn } from '../../anim';
import { MessageBubble } from './MessageBubble';
import { GeneratingIndicator } from './GeneratingIndicator';
import { ScrollToBottomFab } from './ScrollToBottomFab';
import { useDragToScroll } from '../../hooks/useDragToScroll';

export function MessageList(props: {
  messages: any[];
  workspaceName: string;
  gitBranch: string;
  gitRemote: string;
  changedCount: number;
  compactBand: boolean;
  minimumBand: boolean;
  isGenerating: boolean;
  toolExecutions: any[];
  showScrollButton: boolean;
  onScrollToBottom: () => void;
}) {
  const scrollRef = React.useRef(null);
  const scroll = useDragToScroll(scrollRef, {
    axis: 'y',
    inertia: false,
    grabCursor: true,
    surfaceKey: 'scrolling.chatDragToScroll',
  });
  return (
    <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, position: 'relative' }}>
      <ScrollView
        ref={scrollRef}
        showScrollbar={true}
        onScroll={scroll.onScroll}
        onMouseDown={scroll.onMouseDown}
        onMouseUp={scroll.onMouseUp}
        scrollY={scroll.scrollY}
        style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, padding: 12, cursor: scroll.cursor }}
      >
        <Col style={{ gap: 10 }}>
          {!props.minimumBand ? (
            <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
                {props.workspaceName + ' agent session'}
              </Text>
              <Text fontSize={10} color={COLORS.textDim}>
                {props.gitBranch + ' / ' + props.gitRemote + ' / ' + props.changedCount + ' dirty paths'}
              </Text>
            </Box>
          ) : null}

          {props.messages.map((msg: any, idx: number) => (
            <FadeIn key={msg.role + '_' + idx + '_' + (msg.text || '').slice(0, 16)} delay={Math.min(idx * 18, 140)}>
              <MessageBubble
                message={msg}
                index={idx}
                isLast={idx === props.messages.length - 1}
                compact={props.compactBand}
                isStreaming={idx === props.messages.length - 1 && props.isGenerating && msg.role === 'assistant'}
              />
            </FadeIn>
          ))}

          {props.isGenerating ? (
            <GeneratingIndicator toolExecutions={props.toolExecutions} />
          ) : null}
        </Col>
      </ScrollView>

      <ScrollToBottomFab visible={props.showScrollButton} onPress={props.onScrollToBottom} />
    </Box>
  );
}
