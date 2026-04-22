import { A11yPanel } from '../components/a11y/A11yPanel';
import { register } from '../panel-registry';

register({
  id: 'a11y',
  title: 'Accessibility',
  defaultSlot: 'center',
  icon: 'palette',
  component: A11yPanel,
  userVisible: true,
  defaultOpen: false,
});
