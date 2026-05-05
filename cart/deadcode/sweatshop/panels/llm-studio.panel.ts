import { LlmStudioPanel } from '../components/llm-studio/LlmStudioPanel';
import { register } from '../panel-registry';

register({
  id: 'llm-studio',
  title: 'LLM Studio',
  defaultSlot: 'center',
  icon: 'bot',
  component: LlmStudioPanel,
  userVisible: true,
  defaultOpen: false,
});
