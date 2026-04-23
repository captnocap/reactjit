
import { GraphPanelSurface } from '../components/graphpanel';
import { register } from '../panel-registry';

register({
  id: 'graph',
  title: 'Graph',
  defaultSlot: 'right',
  icon: 'panel-bottom',
  component: GraphPanelSurface,
  userVisible: true,
  defaultOpen: false,
});
