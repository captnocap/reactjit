import { Box, Col, Text } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { StepCardShell, TranscriptTurnShell } from '../components/generic-chat-card/TranscriptFlow';
import { CHAT_CARD } from '../components/generic-chat-card/tokens';

const CARD_STYLE = {
  padding: 10,
  gap: 6,
  borderWidth: 1,
  borderColor: CHAT_CARD.borderSoft,
  borderRadius: 4,
  backgroundColor: CHAT_CARD.panel,
};

export const transcriptFlowSection = defineGallerySection({
  id: 'transcript-flow',
  title: 'Transcript Flow',
  stories: [
    defineGalleryStory({
      id: 'transcript-flow/default',
      title: 'Transcript Flow',
      source: 'cart/app/gallery/components/generic-chat-card/TranscriptFlow.tsx',
      status: 'ready',
      summary: 'Rail and shell atoms for stacking turns and task steps inside the chat card.',
      tags: ['chat', 'console', 'rail', 'transcript'],
      variants: [
        {
          id: 'turn-shell',
          name: 'Turn Shell',
          summary: 'Two stacked turns sharing the same rail spine.',
          render: () => (
            <Col style={{ width: 420, gap: 0 }}>
              <TranscriptTurnShell tone="agent" showConnector={true}>
                <Box style={CARD_STYLE}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>
                    AGENT
                  </Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 9, color: CHAT_CARD.text }}>
                    Understood. I am splitting the console into stable atoms before composing the page.
                  </Text>
                </Box>
              </TranscriptTurnShell>
              <TranscriptTurnShell tone="tool" connectTop={true} showConnector={false}>
                <Box style={{ ...CARD_STYLE, backgroundColor: CHAT_CARD.panelDeep }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>
                    TOOL
                  </Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.mint }}>
                    rg -n "ConsoleHeader" cart/app/gallery/components/generic-chat-card
                  </Text>
                </Box>
              </TranscriptTurnShell>
            </Col>
          ),
        },
        {
          id: 'step-shell',
          name: 'Step Shell',
          summary: 'Task-step layout with connected badges and a verification command.',
          render: () => (
            <Col style={{ width: 420, gap: 0 }}>
              <StepCardShell color={CHAT_CARD.green} showConnector={true} badgeName="target">
                <Box style={CARD_STYLE}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>
                    TARGET
                  </Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 9, color: CHAT_CARD.text }}>
                    Split the transcript into explicit reusable atoms.
                  </Text>
                </Box>
              </StepCardShell>
              <StepCardShell color={CHAT_CARD.green} connectTop={true} showConnector={false} badgeName="terminal">
                <Box style={{ ...CARD_STYLE, backgroundColor: CHAT_CARD.panelDeep }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>
                    verification command
                  </Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.mint }}>
                    grep -c "TranscriptTurnShell" cart/app/gallery/components/generic-chat-card/*.tsx
                  </Text>
                </Box>
              </StepCardShell>
            </Col>
          ),
        },
      ],
    }),
  ],
});
