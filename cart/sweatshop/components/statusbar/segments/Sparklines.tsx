
import { Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';
import {
  Sparkline,
  useSparklineSampler,
  useDeltaSampler,
  useFPSSampler,
} from '../../sparkline';

export function SparklinesSegment(props: any) {
  const fpsSamples = useFPSSampler(60);
  const memSamples = useSparklineSampler(() => {
    const h = globalThis as any;
    return h.__heapSize || 0;
  }, 1000, 60);
  const bridgeSamples = useDeltaSampler(() => {
    const h = globalThis as any;
    return h.__cmdCount || 0;
  }, 1000, 60);

  return (
    <>
      <StatusSegment tooltip="FPS (last 60s)">
        <Sparkline data={fpsSamples} color={COLORS.green} width={20} height={12} gap={0} />
        <Text fontSize={9} color={COLORS.green}>
          {fpsSamples.length > 0 ? fpsSamples[fpsSamples.length - 1] : '—'}
        </Text>
      </StatusSegment>

      <StatusSegment tooltip="Heap size (last 60s)">
        <Sparkline data={memSamples} color={COLORS.orange} width={20} height={12} gap={0} />
        <Text fontSize={9} color={COLORS.orange}>
          {memSamples.length > 0 ? `${Math.round(memSamples[memSamples.length - 1] / 1024 / 1024)}M` : '—'}
        </Text>
      </StatusSegment>

      <StatusSegment tooltip="Bridge commands/sec (last 60s)">
        <Sparkline data={bridgeSamples} color={COLORS.blue} width={20} height={12} gap={0} />
        <Text fontSize={9} color={COLORS.blue}>
          {bridgeSamples.length > 0 ? bridgeSamples[bridgeSamples.length - 1] : '—'}
        </Text>
      </StatusSegment>
    </>
  );
}

registerSegment({
  id: 'sparklines',
  label: 'Sparklines (FPS / Memory / Bridge)',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 20,
  component: SparklinesSegment,
});
