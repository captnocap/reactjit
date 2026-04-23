
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import type { MediaBgToken, MediaRadiusKey } from './useMediaStore';

const host: any = globalThis as any;

function getBgOptions(): Array<{ key: MediaBgToken; label: string; color: string }> {
  return [
    { key: 'appBg', label: 'app', color: COLORS.appBg },
    { key: 'panelBg', label: 'panel', color: COLORS.panelBg },
    { key: 'panelRaised', label: 'raised', color: COLORS.panelRaised },
    { key: 'panelAlt', label: 'alt', color: COLORS.panelAlt },
    { key: 'panelHover', label: 'hover', color: COLORS.panelHover },
    { key: 'grayChip', label: 'chip', color: COLORS.grayChip },
    { key: 'grayDeep', label: 'deep', color: COLORS.grayDeep },
    { key: 'blueDeep', label: 'blue', color: COLORS.blueDeep },
    { key: 'greenDeep', label: 'green', color: COLORS.greenDeep },
    { key: 'yellowDeep', label: 'yellow', color: COLORS.yellowDeep },
    { key: 'orangeDeep', label: 'orange', color: COLORS.orangeDeep },
    { key: 'redDeep', label: 'red', color: COLORS.redDeep },
    { key: 'purpleDeep', label: 'purple', color: COLORS.purpleDeep },
  ];
}

function getRadiusOptions(): Array<{ key: MediaRadiusKey; label: string; value: number }> {
  return [
    { key: 'none', label: '0', value: TOKENS.radiusNone },
    { key: 'xs', label: 'xs', value: TOKENS.radiusXs },
    { key: 'sm', label: 'sm', value: TOKENS.radiusSm },
    { key: 'md', label: 'md', value: TOKENS.radiusMd },
    { key: 'lg', label: 'lg', value: TOKENS.radiusLg },
    { key: 'pill', label: 'pill', value: TOKENS.radiusPill },
  ];
}

function useLinearSlider(value: number, min: number, max: number, onChange: (next: number) => void) {
  const [dragging, setDragging] = useState(false);
  const rectRef = useRef<{ left: number; width: number } | null>(null);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
    if (cancel) cancel(frameRef.current);
    else clearTimeout(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    const rect = rectRef.current;
    if (!rect || rect.width <= 0) return;
    const mouseX = typeof host.getMouseX === 'function' ? Number(host.getMouseX()) : 0;
    const ratio = Math.max(0, Math.min(1, (mouseX - rect.left) / rect.width));
    onChange(min + (max - min) * ratio);
  }, [max, min, onChange]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (typeof host.getMouseDown === 'function' && !host.getMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback(() => {
    if (!rectRef.current) return;
    activeRef.current = true;
    setDragging(true);
    setFromMouse();
    stopLoop();
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [setFromMouse, stopLoop, tick]);

  useEffect(() => () => {
    activeRef.current = false;
    stopLoop();
  }, [stopLoop]);

  const onLayout = useCallback((rect: any) => {
    if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.width)) {
      rectRef.current = { left: rect.left, width: rect.width };
    }
  }, []);

  const fill = max <= min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));

  return { dragging, fill, begin, onLayout };
}

function SectionLabel(props: { icon: string; label: string; value?: string }) {
  return (
    <Row style={{ gap: 6, alignItems: 'center', minWidth: 0 }}>
      <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>{props.icon}</Text>
      <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text>
      {props.value ? <Text fontSize={10} color={COLORS.textDim}>{props.value}</Text> : null}
    </Row>
  );
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (next: number) => void;
  formatValue?: (next: number) => string;
}) {
  const slider = useLinearSlider(props.value, props.min, props.max, props.onChange);
  return (
    <Box style={{ gap: 6, minWidth: 220, flexGrow: 1, flexBasis: 0 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionLabel icon="·" label={props.label} value={props.formatValue ? props.formatValue(props.value) : String(Math.round(props.value * 100) / 100)} />
      </Row>
      <Pressable onMouseDown={slider.begin} onLayout={slider.onLayout} style={{ width: '100%', height: 20, justifyContent: 'center' }}>
        <Box style={{ height: 4, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.borderSoft, overflow: 'hidden' }}>
          <Box style={{ width: `${slider.fill * 100}%`, height: 4, backgroundColor: COLORS.blue }} />
        </Box>
        <Box
          style={{
            position: 'absolute',
            left: `${slider.fill * 100}%`,
            top: 2,
            width: 14,
            height: 14,
            marginLeft: -7,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: COLORS.blue,
            backgroundColor: slider.dragging ? COLORS.blue : COLORS.panelBg,
          }}
        />
      </Pressable>
    </Box>
  );
}

function RadiusPicker(props: { radiusKey: MediaRadiusKey; onChange: (next: MediaRadiusKey) => void }) {
  const options = getRadiusOptions();
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {options.map((option) => {
        const active = option.key === props.radiusKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => props.onChange(option.key)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: TOKENS.radiusMd,
              borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
            }}
          >
            <Text fontSize={10} color={active ? COLORS.blue : COLORS.text}>{option.label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function MediaControls(props: {
  title: string;
  bgToken: MediaBgToken;
  radiusKey: MediaRadiusKey;
  shadow: boolean;
  onOpenImport?: () => void;
  onBgTokenChange: (next: MediaBgToken) => void;
  onRadiusKeyChange: (next: MediaRadiusKey) => void;
  onShadowChange: (next: boolean) => void;
}) {
  const bgOptions = getBgOptions();
  return (
    <Box style={{ padding: 10, gap: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <SectionLabel icon="◎" label={props.title} value="theme-aware" />
        <Row style={{ gap: 8, alignItems: 'center' }}>
          {props.onOpenImport ? (
            <Pressable onPress={props.onOpenImport} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Row style={{ gap: 6, alignItems: 'center' }}>
                <Icon name="upload" size={12} color={COLORS.textDim} />
                <Text fontSize={10} color={COLORS.textDim}>Import</Text>
              </Row>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => props.onShadowChange(!props.shadow)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: TOKENS.radiusMd,
              borderWidth: 1,
              borderColor: props.shadow ? COLORS.blue : COLORS.border,
              backgroundColor: props.shadow ? COLORS.blueDeep : COLORS.panelAlt,
            }}
          >
            <Text fontSize={10} color={props.shadow ? COLORS.blue : COLORS.text}>{props.shadow ? 'shadow on' : 'shadow off'}</Text>
          </Pressable>
        </Row>
      </Row>

      <Box style={{ gap: 8 }}>
        <SectionLabel icon="▣" label="Background" value={props.bgToken} />
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {bgOptions.map((option) => {
            const active = option.key === props.bgToken;
            return (
              <Pressable
                key={option.key}
                onPress={() => props.onBgTokenChange(option.key)}
                style={{
                  minWidth: 56,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: TOKENS.radiusMd,
                  borderWidth: 1,
                  borderColor: active ? COLORS.blue : COLORS.border,
                  backgroundColor: option.color,
                }}
              >
                <Text fontSize={9} color={active ? COLORS.blue : COLORS.textBright}>{option.label}</Text>
              </Pressable>
            );
          })}
        </Row>
      </Box>

      <Box style={{ gap: 8 }}>
        <SectionLabel icon="◔" label="Corners" value={props.radiusKey} />
        <RadiusPicker radiusKey={props.radiusKey} onChange={props.onRadiusKeyChange} />
      </Box>
    </Box>
  );
}

export function MediaRange(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  formatValue?: (next: number) => string;
}) {
  return <Slider label={props.label} value={props.value} min={props.min} max={props.max} onChange={props.onChange} formatValue={props.formatValue} />;
}
