
import { Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function ClockSegment(props: any) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      setTime(`${h}:${m}`);
    };
    fmt();
    const id = setInterval(fmt, 30_000);
    return () => clearInterval(id);
  }, []);

  if (props.compactBand || !time) return null;
  return (
    <StatusSegment tooltip="Local time">
      <Text fontSize={10} color={COLORS.textDim}>{time}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'clock',
  label: 'Clock',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 200,
  component: ClockSegment,
});
