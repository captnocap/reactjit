
import { Box, Canvas } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export type MaskKind =
  | 'blur'
  | 'glow'
  | 'distortion'
  | 'chromatic-aberration'
  | 'kaleidoscope'
  | 'glitch'
  | 'paper-burn'
  | 'film-grain'
  | 'pixelate'
  | 'scanlines'
  | 'vignette'
  | 'rgb-shift'
  | 'duotone-map'
  | 'halftone'
  | 'dither';

export type MaskRenderResult = { underlay: any[]; overlay: any[] };

export type MaskRenderProps = {
  width: number;
  height: number;
  time: number;
  children: any;
  [key: string]: any;
};

function mergeStyle(base: any, extra: any): any {
  const next = { ...(base || {}), ...(extra || {}) };
  if (base?.transform || extra?.transform) {
    next.transform = { ...(base?.transform || {}), ...(extra?.transform || {}) };
  }
  return next;
}

function layer(child: any, style: any, key?: string) {
  return cloneElement(child, { key, style: mergeStyle(child?.props?.style, style) });
}

function fillBox(x: number, y: number, w: number, h: number, backgroundColor: string, opacity = 1, extra: any = {}, key?: string) {
  return <Box key={key} style={{ position: 'absolute', left: x, top: y, width: w, height: h, backgroundColor, opacity, ...extra }} />;
}

function boxGrid(width: number, height: number, cols: number, rows: number, renderer: (col: number, row: number, x: number, y: number, w: number, h: number) => any) {
  const out: any[] = [];
  const cellW = width / Math.max(1, cols);
  const cellH = height / Math.max(1, rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = Math.floor(col * cellW);
      const y = Math.floor(row * cellH);
      out.push(renderer(col, row, x, y, Math.ceil(cellW), Math.ceil(cellH)));
    }
  }
  return out;
}

function resolveVariant(props: any): string {
  return String(props.variant || props.mode || props.type || '');
}

function renderBlur(props: MaskRenderProps, child: any): MaskRenderResult {
  const radius = Math.max(1, Number(props.radius ?? 5));
  const intensity = Math.max(0, Number(props.intensity ?? 0.6));
  const mode = resolveVariant(props);
  const underlay = [
    layer(child, { opacity: intensity * 0.18, transform: { translateX: -radius / 2, translateY: -radius / 3, scaleX: 1.02, scaleY: 1.02 } }, 'blur-a'),
    layer(child, { opacity: intensity * 0.18, transform: { translateX: radius / 2, translateY: -radius / 4, scaleX: 1.03, scaleY: 1.03 } }, 'blur-b'),
    layer(child, { opacity: intensity * 0.18, transform: { translateX: -radius / 3, translateY: radius / 3, scaleX: 1.01, scaleY: 1.01 } }, 'blur-c'),
    layer(child, { opacity: 0.95 }, 'blur-main'),
  ];
  const overlay = mode === 'gaussian'
    ? [fillBox(0, 0, props.width, props.height, COLORS.panelBg, 0.03, {}, 'blur-fog')]
    : mode === 'radial'
      ? [fillBox(0, 0, props.width, props.height, COLORS.panelBg, 0.04, { borderRadius: props.radius ?? 0 }, 'blur-fog')]
      : [];
  return { underlay, overlay };
}

function renderGlow(props: MaskRenderProps, child: any): MaskRenderResult {
  const radius = Math.max(2, Number(props.radius ?? 12));
  const intensity = Math.max(0, Number(props.intensity ?? 0.7));
  const color = String(props.color || props.tone || COLORS.blue);
  return {
    underlay: [
      fillBox(-radius, -radius, props.width + radius * 2, props.height + radius * 2, color, 0.08 * intensity, {
        borderRadius: radius,
        boxShadow: `0 0 ${Math.round(radius * 2)}px ${color}`,
      }, 'glow-bg'),
      layer(child, { opacity: 0.85, transform: { scaleX: 1.03, scaleY: 1.03 } }, 'glow-clone'),
    ],
    overlay: [
      fillBox(0, 0, props.width, props.height, color, 0.04 * intensity, { borderRadius: props.radius ?? 0 }, 'glow-haze'),
    ],
  };
}

function renderDistortion(props: MaskRenderProps, child: any): MaskRenderResult {
  const bands = Math.max(4, Math.round(Number(props.bands ?? 10)));
  const amount = Math.max(0, Number(props.amount ?? 8));
  const vertical = !!props.vertical;
  const underlay: any[] = [];
  const overlay: any[] = boxGrid(props.width, props.height, vertical ? bands : 1, vertical ? 1 : bands, (_c, row, x, y, w, h) => {
    const offset = ((row * 17 + props.time / 80) % 9) - 4;
    return (
      <Canvas.Node key={`dist-${row}-${x}-${y}`} gx={x} gy={y} gw={w} gh={h}>
        <Box style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {layer(child, {
            position: 'absolute',
            left: vertical ? -offset * amount * 0.6 : 0,
            top: vertical ? 0 : -offset * amount * 0.6,
            opacity: 0.95,
          }, `dist-layer-${row}`)}
        </Box>
      </Canvas.Node>
    );
  });
  return { underlay, overlay };
}

function renderChromaticAberration(props: MaskRenderProps, child: any): MaskRenderResult {
  const offset = Math.max(0, Number(props.offset ?? 3));
  const intensity = Math.max(0, Number(props.intensity ?? 0.75));
  return {
    underlay: [
      layer(child, { opacity: 0.4, transform: { translateX: -offset, translateY: 0 } }, 'ca-r'),
      layer(child, { opacity: 0.38, transform: { translateX: offset, translateY: 0 } }, 'ca-b'),
      layer(child, { opacity: 0.44, transform: { translateX: 0, translateY: -offset / 2 } }, 'ca-g'),
    ],
    overlay: [
      fillBox(0, 0, props.width, props.height, '#ff4d4d', 0.03 * intensity, {}, 'ca-wash-1'),
      fillBox(0, 0, props.width, props.height, '#4dd2ff', 0.03 * intensity, {}, 'ca-wash-2'),
    ],
  };
}

function renderKaleidoscope(props: MaskRenderProps, child: any): MaskRenderResult {
  const folds = Math.max(3, Math.round(Number(props.folds ?? 6)));
  const rotation = Number(props.rotation ?? 0);
  const zoom = Math.max(0.8, Number(props.zoom ?? 1));
  const underlay: any[] = [];
  for (let i = 0; i < folds; i += 1) {
    const angle = (360 / folds) * i + rotation;
    underlay.push(
      layer(child, {
        opacity: i === 0 ? 1 : 0.33,
        transform: { rotate: angle, scaleX: zoom, scaleY: zoom },
      }, `kal-${i}`),
    );
  }
  return { underlay, overlay: [] };
}

function renderGlitch(props: MaskRenderProps, child: any): MaskRenderResult {
  const bands = Math.max(4, Math.round(Number(props.bands ?? 10)));
  const shift = Math.max(0, Number(props.shift ?? 8));
  const corruption = Math.max(0, Number(props.corruption ?? 0.5));
  const colorCorruption = Math.max(0, Number(props.colorCorruption ?? 0.4));
  const underlay: any[] = [];
  const overlay: any[] = [];
  for (let i = 0; i < bands; i += 1) {
    const bandY = Math.floor((i / bands) * props.height);
    const bandH = Math.max(4, Math.floor(props.height / bands) - 1);
    const dx = (((i * 19 + props.time / 120) % 7) - 3) * shift * corruption;
    overlay.push(
      <Canvas.Node key={`glitch-band-${i}`} gx={0} gy={bandY} gw={props.width} gh={bandH}>
        <Box style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {layer(child, { position: 'absolute', left: dx, top: 0, opacity: 0.92 }, `glitch-band-layer-${i}`)}
        </Box>
      </Canvas.Node>,
    );
  }
  overlay.push(fillBox(0, 0, props.width, props.height, '#ff3d3d', 0.04 * colorCorruption, {}, 'glitch-corrupt-r'));
  overlay.push(fillBox(0, 0, props.width, props.height, '#44a3ff', 0.04 * colorCorruption, {}, 'glitch-corrupt-b'));
  return { underlay, overlay };
}

function renderPaperBurn(props: MaskRenderProps, child: any): MaskRenderResult {
  const edge = Math.max(2, Number(props.edge ?? 16));
  const intensity = Math.max(0, Number(props.intensity ?? 0.7));
  const tone = String(props.tone || props.color || '#9f5b2d');
  return {
    underlay: [],
    overlay: [
      fillBox(0, 0, props.width, edge, tone, 0.12 * intensity, {}, 'burn-top'),
      fillBox(0, props.height - edge, props.width, edge, tone, 0.12 * intensity, {}, 'burn-bottom'),
      fillBox(0, 0, edge, props.height, tone, 0.12 * intensity, {}, 'burn-left'),
      fillBox(props.width - edge, 0, edge, props.height, tone, 0.12 * intensity, {}, 'burn-right'),
      fillBox(edge * 0.6, edge * 0.6, props.width - edge * 1.2, props.height - edge * 1.2, '#1a120e', 0.06 * intensity, { borderRadius: 999 }, 'burn-center'),
    ],
  };
}

function renderFilmGrain(props: MaskRenderProps): MaskRenderResult {
  const grain = Math.max(0, Number(props.grain ?? 0.25));
  const rows = Math.max(10, Math.round(props.height / 8));
  const cols = Math.max(12, Math.round(props.width / 8));
  const overlay = boxGrid(props.width, props.height, cols, rows, (col, row, x, y, w, h) => {
    const n = ((col * 17 + row * 31 + Math.floor(props.time / 60)) % 9) / 9;
    const alpha = (n * 0.45 + 0.05) * grain;
    return <Box key={`grain-${col}-${row}`} style={{ position: 'absolute', left: x, top: y, width: Math.max(1, Math.floor(w / 3)), height: Math.max(1, Math.floor(h / 3)), backgroundColor: '#fff', opacity: alpha }} />;
  });
  return { underlay: [], overlay };
}

function renderPixelate(props: MaskRenderProps, child: any): MaskRenderResult {
  const size = Math.max(2, Math.round(Number(props.size ?? 8)));
  const strength = Math.max(0, Number(props.strength ?? 0.8));
  const cols = Math.max(4, Math.round(props.width / size));
  const rows = Math.max(4, Math.round(props.height / size));
  const overlay = boxGrid(props.width, props.height, cols, rows, (_c, _r, x, y, w, h) => (
    <Box key={`pixel-${x}-${y}`} style={{ position: 'absolute', left: x, top: y, width: w, height: h, backgroundColor: COLORS.panelBg, opacity: 0.1 * strength, borderWidth: 1, borderColor: COLORS.borderSoft }} />
  ));
  return {
    underlay: [
      layer(child, { transform: { scaleX: 1 / (1 + strength * 0.06), scaleY: 1 / (1 + strength * 0.06) }, opacity: 0.96 }, 'pixel-base'),
    ],
    overlay,
  };
}

function renderScanlines(props: MaskRenderProps): MaskRenderResult {
  const spacing = Math.max(1, Math.round(Number(props.spacing ?? 3)));
  const tint = String(props.tint || props.color || COLORS.textBright);
  const overlay: any[] = [];
  for (let y = 0; y < props.height; y += spacing) {
    overlay.push(<Canvas.Node key={`scan-${y}`} gx={0} gy={y} gw={props.width} gh={1}><Box style={{ width: '100%', height: '100%', backgroundColor: tint, opacity: 0.08 }} /></Canvas.Node>);
  }
  return { underlay: [], overlay };
}

function renderVignette(props: MaskRenderProps): MaskRenderResult {
  const strength = Math.max(0, Number(props.strength ?? 0.55));
  const color = String(props.color || props.tone || '#000');
  const w = props.width;
  const h = props.height;
  const overlay = [
    fillBox(0, 0, w, h * 0.2, color, 0.12 * strength, {}, 'vig-top'),
    fillBox(0, h * 0.8, w, h * 0.2, color, 0.14 * strength, {}, 'vig-bottom'),
    fillBox(0, 0, w * 0.15, h, color, 0.12 * strength, {}, 'vig-left'),
    fillBox(w * 0.85, 0, w * 0.15, h, color, 0.12 * strength, {}, 'vig-right'),
    fillBox(0, 0, w, h, '#000', 0.05 * strength, { borderRadius: 0 }, 'vig-center'),
  ];
  return { underlay: [], overlay };
}

function renderRGBShift(props: MaskRenderProps, child: any): MaskRenderResult {
  const offset = Math.max(0, Number(props.offset ?? 4));
  const spread = Math.max(0, Number(props.spread ?? 1));
  return {
    underlay: [
      layer(child, { opacity: 0.55, transform: { translateX: -offset, translateY: 0 } }, 'rgb-r'),
      layer(child, { opacity: 0.55, transform: { translateX: offset, translateY: 0 } }, 'rgb-b'),
      layer(child, { opacity: 0.7, transform: { translateY: spread } }, 'rgb-g'),
    ],
    overlay: [],
  };
}

function renderDuotoneMap(props: MaskRenderProps): MaskRenderResult {
  const light = String(props.lightColor || props.light || COLORS.blue);
  const dark = String(props.darkColor || props.dark || COLORS.panelBg);
  const mix = Math.max(0, Math.min(1, Number(props.mix ?? 0.55)));
  return {
    underlay: [],
    overlay: [
      fillBox(0, 0, props.width, props.height / 2, dark, 0.18 + mix * 0.18, {}, 'duo-dark'),
      fillBox(0, props.height / 2, props.width, props.height / 2, light, 0.08 + mix * 0.14, {}, 'duo-light'),
    ],
  };
}

function renderHalftone(props: MaskRenderProps): MaskRenderResult {
  const cell = Math.max(4, Math.round(Number(props.cellSize ?? 10)));
  const dot = Math.max(1, Number(props.dotSize ?? 4));
  const tint = String(props.tint || props.color || COLORS.textBright);
  const cols = Math.max(2, Math.floor(props.width / cell));
  const rows = Math.max(2, Math.floor(props.height / cell));
  const overlay = boxGrid(props.width, props.height, cols, rows, (col, row, x, y, w, h) => {
    const wobble = ((col * 13 + row * 7 + Math.floor(props.time / 100)) % 100) / 100;
    const size = dot + wobble * dot * 1.6;
    return (
      <Canvas.Node key={`dot-${col}-${row}`} gx={x + w / 2 - size / 2} gy={y + h / 2 - size / 2} gw={size} gh={size}>
        <Box style={{ width: '100%', height: '100%', borderRadius: 999, backgroundColor: tint, opacity: 0.15 + wobble * 0.45 }} />
      </Canvas.Node>
    );
  });
  return { underlay: [], overlay };
}

function renderDither(props: MaskRenderProps): MaskRenderResult {
  const levels = Math.max(2, Math.round(Number(props.levels ?? 4)));
  const scale = Math.max(1, Math.round(Number(props.scale ?? 2)));
  const cols = Math.max(4, Math.round(props.width / (scale * 4)));
  const rows = Math.max(4, Math.round(props.height / (scale * 4)));
  // 4x4 Bayer matrix
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const overlay = boxGrid(props.width, props.height, cols, rows, (col, row, x, y, w, h) => {
    const threshold = bayer[row % 4][col % 4] / 16;
    const alpha = (0.04 + threshold * 0.18) * (1 - 0.06 * levels);
    return (
      <Box
        key={`dither-${col}-${row}`}
        style={{ position: 'absolute', left: x, top: y, width: Math.max(1, w - 1), height: Math.max(1, h - 1), backgroundColor: COLORS.textBright, opacity: alpha }}
      />
    );
  });
  return { underlay: [], overlay };
}

export function renderMaskEffect(kind: MaskKind, props: MaskRenderProps, child: any): MaskRenderResult {
  switch (kind) {
    case 'blur': return renderBlur(props, child);
    case 'glow': return renderGlow(props, child);
    case 'distortion': return renderDistortion(props, child);
    case 'chromatic-aberration': return renderChromaticAberration(props, child);
    case 'kaleidoscope': return renderKaleidoscope(props, child);
    case 'glitch': return renderGlitch(props, child);
    case 'paper-burn': return renderPaperBurn(props, child);
    case 'film-grain': return renderFilmGrain(props, child);
    case 'pixelate': return renderPixelate(props, child);
    case 'scanlines': return renderScanlines(props);
    case 'vignette': return renderVignette(props);
    case 'rgb-shift': return renderRGBShift(props, child);
    case 'duotone-map': return renderDuotoneMap(props);
    case 'halftone': return renderHalftone(props);
    case 'dither': return renderDither(props);
    default: return { underlay: [], overlay: [] };
  }
}

