import { Sidebar } from '../components/sidebar';
import { register } from '../panel-registry';

register({
  id: 'files',
  title: 'Files',
  defaultSlot: 'left',
  icon: 'folder',
  component: Sidebar,
  userVisible: true,
  defaultOpen: true,
});
