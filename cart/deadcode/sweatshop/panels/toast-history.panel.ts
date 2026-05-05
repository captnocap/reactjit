import { ToastHistoryPanel } from '../components/toast/ToastHistoryPanel';
import { register } from '../panel-registry';

register({
  id: 'toast-history',
  title: 'Notifications',
  defaultSlot: 'center',
  icon: 'clock',
  component: ToastHistoryPanel,
  userVisible: true,
  defaultOpen: false,
});
