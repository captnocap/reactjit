import { AutomationPanel } from '../components/automation/AutomationPanel';
import { register } from '../panel-registry';

register({
  id: 'automation',
  title: 'Automation',
  defaultSlot: 'center',
  icon: 'bot',
  component: AutomationPanel,
  userVisible: true,
  defaultOpen: false,
});
