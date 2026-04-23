import { BrowserPanel } from '../components/browser/BrowserPanel';
import { register } from '../panel-registry';

register({
  id: 'browser',
  title: 'Browser',
  defaultSlot: 'center',
  icon: 'globe',
  component: BrowserPanel,
  userVisible: true,
  defaultOpen: false,
});
