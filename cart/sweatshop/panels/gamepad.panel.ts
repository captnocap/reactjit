import { GamepadPanel } from '../components/gamepad/GamepadPanel';
import { register } from '../panel-registry';

register({
  id: 'gamepad',
  title: 'Gamepad',
  defaultSlot: 'center',
  icon: 'command',
  component: GamepadPanel,
  userVisible: true,
  defaultOpen: false,
});
