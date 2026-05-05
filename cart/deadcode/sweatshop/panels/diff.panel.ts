import { DiffPanel } from '../components/diffpanel';
import { register } from '../panel-registry';

register({
  id: 'diff',
  title: 'Diff',
  defaultSlot: 'right',
  icon: 'git-commit',
  component: DiffPanel,
  userVisible: true,
  defaultOpen: false,
});
