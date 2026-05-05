import { DocsPanel } from '../components/docs/DocsPanel';
import { register } from '../panel-registry';

register({
  id: 'docs',
  title: 'Docs',
  defaultSlot: 'right',
  icon: 'file',
  component: DocsPanel,
  userVisible: true,
  defaultOpen: false,
});
