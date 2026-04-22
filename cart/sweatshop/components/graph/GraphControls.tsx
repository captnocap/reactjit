
import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';

export type GraphLayoutMode = 'force' | 'tree' | 'radial';

const host: any = globalThis as any;

function readMouseX(): number {
  try {
    const fn = host.getMouseX;
    if (typeof fn !== 'function') return 0;
    const value = Number(fn());
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function readMouseDown(): boolean {
  try {
    const fn = host.getMouseDown;
    if (typeof fn !== 'function') return false;
    return !!fn();
  } catch {
    return false;
  }
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.4, Math.min(2.5, Math.round(value * 100) / 100));
}

function useZoomDrag(zoom: number, onZoomChange: (zoom: number) => void) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const startXRef = useRef(0);
  const startZoomRef = useRef(zoom);
  const frameRef = useRef<any>(null);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
    if (cancel) cancel(frameRef.current);
    else clearTimeout(frameRef.current);
    frameRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    stopLoop();
    setDragging(false);
  }, [stopLoop]);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    if (!readMouseDown()) {
      finish();
      return;
    }
    const delta = (readMouseX() - startXRef.current) / 180;
    onZoomChange(clampZoom(startZoomRef.current + delta));
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [finish, onZoomChange]);

  const begin = useCallback(() => {
    activeRef.current = true;
    startXRef.current = readMouseX();
    startZoomRef.current = zoom;
    setDragging(true);
    stopLoop();
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [stopLoop, tick, zoom]);

  useEffect(() => () => {
    activeRef.current = false;
    stopLoop();
  }, [stopLoop]);

  return { begin, dragging };
}

function ToggleChip(props: { active?: boolean; icon: string; label: string; onPress: () => void }) {
  const active = props.active === true;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderColor: active ? COLORS.blue : COLORS.border,
        backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Icon name={props.icon} size={12} color={active ? COLORS.blue : COLORS.textMuted} />
      <Text fontSize={10} color={active ? COLORS.blue : COLORS.text}>{props.label}</Text>
    </Pressable>
  );
}

export function GraphControls(props: {
  zoom: number;
  layout: GraphLayoutMode;
  filterExt: string;
  extOptions: string[];
  onZoomChange: (zoom: number) => void;
  onLayoutChange: (layout: GraphLayoutMode) => void;
  onFilterChange: (ext: string) => void;
  onReset: () => void;
}) {
  const zoomDrag = useZoomDrag(props.zoom, props.onZoomChange);
  const extValue = props.filterExt === 'all' ? '' : props.filterExt;

  return (
    <Col style={{ gap: 10, padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Icon name="search" size={12} color={COLORS.textDim} />
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Extension</Text>
        </Row>
        <TextInput
          value={extValue}
          onChangeText={(value: string) => props.onFilterChange(value.trim() ? value.trim().replace(/^\./, '') : 'all')}
          placeholder="all"
          style={{ width: 90, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10 }}
        />
        <Pressable onPress={props.onReset} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={10} color={COLORS.textDim}>Reset</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Icon name="refresh" size={12} color={COLORS.textDim} />
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Layout</Text>
        </Row>
        <ToggleChip icon="git-branch" label="Tree" active={props.layout === 'tree'} onPress={() => props.onLayoutChange('tree')} />
        <ToggleChip icon="clock" label="Radial" active={props.layout === 'radial'} onPress={() => props.onLayoutChange('radial')} />
        <ToggleChip icon="refresh" label="Force" active={props.layout === 'force'} onPress={() => props.onLayoutChange('force')} />
      </Row>

      <Col style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <Icon name="search" size={12} color={COLORS.textDim} />
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Zoom</Text>
          </Row>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{Math.round(props.zoom * 100)}%</Text>
        </Row>
        <Pressable onMouseDown={zoomDrag.begin} style={{ height: 18, justifyContent: 'center' }}>
          <Box style={{ height: 4, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.borderSoft, overflow: 'hidden' }}>
            <Box style={{ width: `${((props.zoom - 0.4) / 2.1) * 100}%`, height: 4, backgroundColor: COLORS.blue }} />
          </Box>
          <Box style={{ position: 'absolute', left: `${((props.zoom - 0.4) / 2.1) * 100}%`, width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: zoomDrag.dragging ? COLORS.blue : COLORS.panelBg, borderWidth: 1, borderColor: COLORS.blue, top: 2 }} />
        </Pressable>
      </Col>

      {props.extOptions.length > 0 ? (
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <ToggleChip icon="file" label="all" active={props.filterExt === 'all'} onPress={() => props.onFilterChange('all')} />
          {props.extOptions.map((ext) => (
            <ToggleChip key={ext} icon="file" label={ext} active={props.filterExt === ext} onPress={() => props.onFilterChange(ext)} />
          ))}
        </Row>
      ) : null}
    </Col>
  );
}
