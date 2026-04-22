
import { PhysicsPanel } from '../components/physics/PhysicsPanel';
import { register } from '../panel-registry';

register({
  id: 'physics',
  title: 'Physics',
  defaultSlot: 'center',
  icon: 'atom',
  component: PhysicsPanel,
  userVisible: true,
  defaultOpen: false,
});
