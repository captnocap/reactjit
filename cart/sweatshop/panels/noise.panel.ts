import { NoisePanel } from '../components/noise/NoisePanel';
import { register } from '../panel-registry';

register({
  id: 'noise',
  title: 'Noise',
  defaultSlot: 'center',
  icon: 'palette',
  component: NoisePanel,
  userVisible: true,
  defaultOpen: false,
});
