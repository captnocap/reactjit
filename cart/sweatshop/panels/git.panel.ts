import { GitPanel } from '../components/git/GitPanel';
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
