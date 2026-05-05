import { register } from '../panel-registry';
import { WeatherPanel } from '../components/weather/WeatherPanel';

register({
  id: 'weather',
  title: 'Weather',
  defaultSlot: 'center',
  icon: 'cloud-rain',
  component: WeatherPanel,
  userVisible: true,
  defaultOpen: false,
});
