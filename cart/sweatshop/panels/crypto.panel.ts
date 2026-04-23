import { register } from '../panel-registry';
import { CryptoPanel } from '../components/crypto/CryptoPanel';

register({
  id: 'crypto',
  title: 'Crypto',
  defaultSlot: 'center',
  icon: 'shield',
  component: CryptoPanel,
  userVisible: true,
  defaultOpen: false,
});
