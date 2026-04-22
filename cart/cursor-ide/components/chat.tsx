const React: any = require('react');
const { memo } = React;
import { AgentConsoleRoot } from './agent/AgentConsoleRoot';

function ChatSurfaceImpl(props: any) {
  return <AgentConsoleRoot {...props} />;
}

export const ChatSurface = memo(ChatSurfaceImpl);
