import { register } from '../panel-registry';
import { MapPanel } from '../components/osm/MapPanel';

register({
  id: 'osm',
  title: 'OpenStreetMap',
  defaultSlot: 'center',
  icon: 'map',
  component: MapPanel,
  userVisible: true,
  defaultOpen: false,
});
