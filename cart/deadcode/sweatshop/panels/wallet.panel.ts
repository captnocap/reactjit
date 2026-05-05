import { register } from '../panel-registry';
import { WalletPanel } from '../components/wallet/WalletPanel';

register({
  id: 'wallet',
  title: 'Wallet',
  defaultSlot: 'center',
  icon: 'wallet',
  component: WalletPanel,
  userVisible: true,
  defaultOpen: false,
});

