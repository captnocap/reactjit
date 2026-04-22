const React: any = require('react');

import { ChartsDemoPanel } from '../components/charts/ChartsDemoPanel';
import { register } from '../panel-registry';

register({
  id: 'charts',
  title: 'Charts',
  defaultSlot: 'center',
  icon: 'graph',
  component: ChartsDemoPanel,
  userVisible: true,
  defaultOpen: false,
});
