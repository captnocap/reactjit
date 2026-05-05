
import { MasksPanel } from '../components/masks/MasksPanel';
import { register } from '../panel-registry';

register({
  id: 'masks',
  title: 'Masks',
  defaultSlot: 'right',
  icon: 'layers',
  component: MasksPanel,
  userVisible: true,
  defaultOpen: false,
});

