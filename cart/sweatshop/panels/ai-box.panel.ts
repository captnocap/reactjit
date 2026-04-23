import { register } from '../panel-registry';
import { AiBoxPanel } from '../components/ai-box/AiBoxPanel';

register({
  id: 'ai-box',
  title: 'AI Box',
  defaultSlot: 'center',
  icon: 'chat',
  component: AiBoxPanel,
  userVisible: true,
  defaultOpen: false,
});

