import { register } from '../panel-registry';
import { GameServersPanel } from '../components/game-servers/GameServersPanel';

register({
  id: 'game-servers',
  title: 'Game Servers',
  defaultSlot: 'center',
  icon: 'globe',
  component: GameServersPanel,
  userVisible: true,
  defaultOpen: false,
});

