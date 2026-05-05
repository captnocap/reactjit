import { AIPlaygroundPanel } from '../components/ai/AIPlaygroundPanel';
import { register } from '../panel-registry';

register({
  id: 'ai-playground',
  title: 'AI Playground',
  defaultSlot: 'center',
  icon: 'sparkles',
  component: AIPlaygroundPanel,
  userVisible: true,
  defaultOpen: false,
});
