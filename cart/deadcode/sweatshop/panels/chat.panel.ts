import { ChatSurface } from '../components/chat';
import { register } from '../panel-registry';

register({
  id: 'chat',
  title: 'Chat',
  defaultSlot: 'right',
  icon: 'chat',
  component: ChatSurface,
  userVisible: true,
  defaultOpen: true,
});
