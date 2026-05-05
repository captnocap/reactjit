import { WorkerCanvas } from '../components/cockpit/WorkerCanvas';
import { register } from '../panel-registry';

register({
  id: 'cockpit',
  title: 'Cockpit',
  defaultSlot: 'center',
  icon: 'panel-right',
  component: WorkerCanvas,
  userVisible: true,
  defaultOpen: false,
});
