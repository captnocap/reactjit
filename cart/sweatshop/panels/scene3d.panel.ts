import { Scene3DPanel } from '../components/scene3d/Scene3DPanel';
import { register } from '../panel-registry';

register({
  id: 'scene3d',
  title: '3D',
  defaultSlot: 'center',
  icon: 'palette',
  component: Scene3DPanel,
  userVisible: true,
  defaultOpen: false,
});
