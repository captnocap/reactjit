import { register } from '../panel-registry';
import { AudioCapturePanel } from '../components/audio-capture/AudioCapturePanel';

register({
  id: 'audio-capture.panel',
  title: 'Audio Capture',
  defaultSlot: 'center',
  icon: 'AU',
  component: AudioCapturePanel,
  userVisible: true,
  defaultOpen: false,
});
