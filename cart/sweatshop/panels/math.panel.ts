import { MathDemoPanel } from '../components/math/MathDemoPanel';
import { register } from '../panel-registry';

register({
  id: 'math',
  title: 'Math',
  defaultSlot: 'right',
  icon: 'keyboard',
  component: MathDemoPanel,
  userVisible: true,
  defaultOpen: false,
});
