const React: any = require('react');

import { ChartsPanel } from '../components/charts/ChartsPanel';
import { register } from '../panel-registry';

register({
  id: 'charts',
  title: 'Charts',
  defaultSlot: 'center',
  icon: 'graph',
  component: ChartsPanel,
  userVisible: true,
  defaultOpen: false,
});
