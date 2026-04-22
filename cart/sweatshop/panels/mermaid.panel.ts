import { MermaidPanel } from '../components/mermaidpanel';
import { register } from '../panel-registry';

register({
  id: 'mermaid',
  title: 'Mermaid',
  defaultSlot: 'center',
  icon: 'panel-left',
  component: MermaidPanel,
  userVisible: true,
  defaultOpen: false,
});
