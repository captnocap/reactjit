import { GitPanel } from '../components/gitpanel';
import { register } from '../panel-registry';

register({
  id: 'source-control',
  title: 'Git',
  defaultSlot: 'left',
  icon: 'git-branch',
  component: GitPanel,
  userVisible: true,
  defaultOpen: true,
});
