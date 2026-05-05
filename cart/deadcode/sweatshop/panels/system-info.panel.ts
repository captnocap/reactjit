import { SystemInfoPanel } from '../components/system-info/SystemInfoPanel';
import { register } from '../panel-registry';

register({
  id: 'system-info',
  title: 'System Info',
  defaultSlot: 'right',
  icon: 'terminal',
  component: SystemInfoPanel,
  userVisible: true,
  defaultOpen: false,
});
