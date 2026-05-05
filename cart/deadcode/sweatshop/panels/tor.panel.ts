import { TorStatus } from '../components/tor/TorStatus';
import { register } from '../panel-registry';

register({
  id: 'tor-status',
  title: 'Tor Status',
  defaultSlot: 'center',
  icon: 'globe',
  component: TorStatus,
  userVisible: true,
  defaultOpen: false,
});
