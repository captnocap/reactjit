const React: any = require('react');

import { LineChart } from './LineChart';

export function AreaChart(props: any) {
  return <LineChart {...props} showArea={props.showArea !== false} areaOpacity={props.areaOpacity ?? 0.18} />;
}

export default AreaChart;
