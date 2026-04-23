import { ApisSettingsPanel } from '../components/apis/ApisSettingsPanel';
import { register } from '../panel-registry';

register({
  id: 'apis',
  title: 'APIs',
  defaultSlot: 'center',
  icon: 'globe',
  component: ApisSettingsPanel,
  userVisible: true,
  defaultOpen: false,
});
