import { PlanPanelWrapper } from '../components/planwrapper';
import { register } from '../panel-registry';

register({
  id: 'plan',
  title: 'Plan',
  defaultSlot: 'right',
  icon: 'menu',
  component: PlanPanelWrapper,
  userVisible: true,
  defaultOpen: false,
});
