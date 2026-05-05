import { register } from '../panel-registry';
import { EmulatorPanel } from '../components/emulator/EmulatorPanel';

register({
  id: 'emulator.panel',
  title: 'NES Emulator',
  defaultSlot: 'center',
  icon: 'GM',
  component: EmulatorPanel,
  userVisible: true,
  defaultOpen: false,
});
