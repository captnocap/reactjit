import { SettingsSurface } from '../components/settings';
import { register } from '../panel-registry';

register({
  id: 'settings',
  title: 'Settings',
  defaultSlot: 'center',
  icon: 'settings',
  component: SettingsSurface,
  userVisible: true,
  defaultOpen: false,
});
