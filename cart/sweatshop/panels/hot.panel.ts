import { HotPanel } from '../components/hotpanel';
import { register } from '../panel-registry';

register({
  id: 'hot',
  title: 'Hot',
  defaultSlot: 'right',
  icon: 'play',
  component: HotPanel,
  userVisible: true,
  defaultOpen: false,
});
