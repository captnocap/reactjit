import { VesperShowcase } from '../components/vesper';
import { register } from '../panel-registry';

register({
  id: 'vesper',
  title: 'Vesper',
  defaultSlot: 'center',
  icon: 'sparkles',
  component: VesperShowcase,
  userVisible: true,
  defaultOpen: false,
});
