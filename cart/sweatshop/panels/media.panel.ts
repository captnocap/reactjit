import { MediaPanel } from '../components/media/MediaPanel';
import { register } from '../panel-registry';

register({
  id: 'media',
  title: 'Media',
  defaultSlot: 'right',
  icon: 'panel-bottom',
  component: MediaPanel,
  userVisible: true,
  defaultOpen: false,
});
