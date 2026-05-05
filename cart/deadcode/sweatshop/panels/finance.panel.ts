import { FinancePanel } from '../components/finance/FinancePanel';
import { register } from '../panel-registry';

register({
  id: 'finance',
  title: 'Finance',
  defaultSlot: 'center',
  icon: 'trending-up',
  component: FinancePanel,
  userVisible: true,
  defaultOpen: false,
});
