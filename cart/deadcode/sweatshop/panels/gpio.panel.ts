import { GPIOPanel } from '../components/gpio/GPIOPanel';
import { register } from '../panel-registry';

register({
  id: 'gpio',
  title: 'GPIO',
  defaultSlot: 'center',
  icon: 'cpu',
  component: GPIOPanel,
  userVisible: true,
  defaultOpen: false,
});
