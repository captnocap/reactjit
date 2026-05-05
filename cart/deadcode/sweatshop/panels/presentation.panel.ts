import { PresentationPanel } from '../components/presentation/PresentationPanel';
import { register } from '../panel-registry';

register({
  id: 'presentation',
  title: 'Presentation',
  defaultSlot: 'center',
  icon: 'presentation',
  component: PresentationPanel,
  userVisible: true,
  defaultOpen: false,
});
