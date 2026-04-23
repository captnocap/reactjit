import { register } from '../panel-registry';
import { KeybindPanel } from '../components/keybinds/KeybindPanel';

register({
  id: 'keybinds',
  title: 'Keybinds',
  defaultSlot: 'center',
  icon: 'command',
  component: KeybindPanel,
  userVisible: true,
  defaultOpen: false,
});
