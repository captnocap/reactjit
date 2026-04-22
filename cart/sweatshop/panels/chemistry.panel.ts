import { PeriodicTablePanel } from '../components/chemistry/PeriodicTablePanel';
import { register } from '../panel-registry';

register({
  id: 'chemistry',
  title: 'Chemistry',
  defaultSlot: 'right',
  icon: 'flask',
  component: PeriodicTablePanel,
  userVisible: true,
  defaultOpen: false,
});
