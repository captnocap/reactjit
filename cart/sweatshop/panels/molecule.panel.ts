import { register } from '../panel-registry';
import { MoleculePanel } from '../components/chemistry/MoleculePanel';

register({
  id: 'molecules',
  title: 'Molecules',
  defaultSlot: 'right',
  icon: 'flask',
  component: MoleculePanel,
  userVisible: true,
  defaultOpen: false,
});

