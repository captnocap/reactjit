
import { LineChart } from './LineChart';

// AreaChart is LineChart with showArea=true by default. The `interactions`
// prop is forwarded through {...props}, so AreaChart picks up zoom / pan /
// crosshair / brush for free via LineChart's integration.
export function AreaChart(props: any) {
  return <LineChart {...props} showArea={props.showArea !== false} areaOpacity={props.areaOpacity ?? 0.18} />;
}

export default AreaChart;
