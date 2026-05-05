import { TerminalPanel } from '../components/terminal';
import { register } from '../panel-registry';

register({
  id: 'terminal',
  title: 'Terminal',
  defaultSlot: 'bottom',
  icon: 'terminal',
  component: TerminalPanel,
  userVisible: true,
  defaultOpen: false,
});
