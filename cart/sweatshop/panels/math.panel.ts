import { MathPanel } from '../components/math/MathPanel';
import { register } from '../panel-registry';

register({
  id: 'math',
  title: 'Math',
  defaultSlot: 'right',
  icon: 'keyboard',
  component: MathPanel,
  userVisible: true,
  defaultOpen: false,
});
