// /chat route — full-shape live chat as the activity page.
//
// Renders the same module-store-backed transcript the side rail
// renders, just sized to fill the activity content area. The bottom
// InputStrip sends through askAssistant; route-level shouldn't have
// its own InputStrip — the shell's strip is the only one.

import { Box } from '@reactjit/runtime/primitives';
import { useHudInsets } from '../shell';
import { AssistantChat } from './AssistantChat';

export default function ChatPage() {
  const insets = useHudInsets();
  return (
    <Box style={{
      width: '100%',
      flexGrow: 1,
      flexDirection: 'column',
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      // The shell publishes the bottom InputStrip's reserved height
      // here — apply it as our own paddingBottom so the chat panel
      // doesn't extend behind the strip.
      paddingBottom: 16 + insets.bottom,
    }}>
      <AssistantChat shape="activity" />
    </Box>
  );
}
