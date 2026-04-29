
import { Box, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

const host: any = globalThis as any;

export type ImportTypeFilter = 'all' | 'images' | 'videos' | 'gifs';

function useSlider(value: number, min: number, max: number, onChange: (n: number) => void) {
  const [dragging, setDragging] = useState(false);
  const rectRef = useRef<{ left: number; width: number } | null>(null);
  const activeRef = useRef(false);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    if (typeof host.getMouseDown === 'function' && !host.getMouseDown()) { activeRef.current = false; setDragging(false); return; }
    const rect = rectRef.current;
    if (!rect || rect.width <= 0) return;
    const mouseX = typeof host.getMouseX === 'function' ? Number(host.getMouseX()) : 0;
    const ratio = Math.max(0, Math.min(1, (mouseX - rect.left) / rect.width));
    onChange(min + (max - min) * ratio);
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    (raf ? raf(tick) : setTimeout(tick, 16));
  }, [max, min, onChange]);

  const begin = useCallback(() => { activeRef.current = true; setDragging(true); tick(); }, [tick]);
  const onLayout = useCallback((rect: any) => { if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.width)) rectRef.current = { left: rect.left, width: rect.width }; }, []);
  const fill = max <= min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  useEffect(() => () => { activeRef.current = false; }, []);
  return { dragging, fill, begin, onLayout };
}

function Chip(props: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={props.onPress} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: props.active ? COLORS.blue : COLORS.border, backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={10} color={props.active ? COLORS.blue : COLORS.text}>{props.label}</Text></Pressable>;
}

export function ImportFilters(props: {
  typeFilter: ImportTypeFilter;
  onTypeFilterChange: (next: ImportTypeFilter) => void;
  sizeCapMb: number;
  onSizeCapMbChange: (next: number) => void;
  nameFilter: string;
  onNameFilterChange: (next: string) => void;
}) {
  const slider = useSlider(props.sizeCapMb, 16, 1024, props.onSizeCapMbChange);
  return (
    <Box style={{ gap: 8, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'images', 'videos', 'gifs'] as ImportTypeFilter[]).map((type) => <Chip key={type} label={type} active={props.typeFilter === type} onPress={() => props.onTypeFilterChange(type)} />)}
      </Row>
      <Box style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Size cap</Text>
          <Text fontSize={10} color={COLORS.textBright}>{Math.round(props.sizeCapMb)} MB</Text>
        </Row>
        <Pressable onMouseDown={slider.begin} onLayout={slider.onLayout} style={{ width: '100%', height: 18, justifyContent: 'center' }}>
          <Box style={{ height: 4, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.borderSoft, overflow: 'hidden' }}><Box style={{ width: `${slider.fill * 100}%`, height: 4, backgroundColor: COLORS.blue }} /></Box>
          <Box style={{ position: 'absolute', left: `${slider.fill * 100}%`, top: 1, width: 12, height: 12, marginLeft: -6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: slider.dragging ? COLORS.blue : COLORS.panelBg }} />
        </Pressable>
      </Box>
      <Box style={{ gap: 4 }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Name contains</Text>
        <TextInput value={props.nameFilter} onChangeText={props.onNameFilterChange} placeholder="filter filenames" fontSize={10} color={COLORS.textBright} style={{ padding: 8, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }} />
      </Box>
    </Box>
  );
}
