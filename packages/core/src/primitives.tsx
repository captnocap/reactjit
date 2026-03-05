/**
 * Primitives: <Box>, <Text>, <Image>
 *
 * Render as string-typed host elements for react-reconciler.
 * The Lua layout engine handles all sizing, positioning, and painting.
 */

import React, { createContext, useContext } from 'react';
import { useThemeColorsOptional } from './context';
import { useScaledStyle } from './ScaleContext';
import type { BoxProps, ColProps, TextProps, ImageProps, RenderProps, FocusGroupProps, Style, Color } from './types';
import { lookupIcon } from './iconRegistry';
import { useBreakpoint, resolveSpan, spanToFlexBasis, RESPONSIVE_DEFAULTS } from './useBreakpoint';
import type { Breakpoint } from './useBreakpoint';

// Gap provided by a wrapping Row so Col can subtract its share from flexBasis
const GridGapContext = createContext(0);
import { tw } from './tw';

// ── Theme token resolution ──────────────────────────────

function resolveColor(
  value: Color | undefined,
  tokens: Record<string, string> | null,
): Color | undefined {
  if (value === undefined || tokens === null) return value;
  if (typeof value !== 'string') return value;
  if (value.startsWith('#') || value.startsWith('rgb') || value === 'transparent') return value;
  return (value in tokens) ? tokens[value] : value;
}

function resolveStyleColors(
  style: Style | undefined,
  tokens: Record<string, string> | null,
): Style | undefined {
  if (!style || !tokens) return style;

  const bg = resolveColor(style.backgroundColor, tokens);
  const bc = resolveColor(style.borderColor, tokens);
  const color = resolveColor(style.color, tokens);

  if (bg === style.backgroundColor && bc === style.borderColor && color === style.color) {
    return style;
  }

  return {
    ...style,
    ...(bg !== style.backgroundColor ? { backgroundColor: bg } : undefined),
    ...(bc !== style.borderColor ? { borderColor: bc } : undefined),
    ...(color !== style.color ? { color } : undefined),
  };
}

// ── Shorthand prop -> style merging ────────────────────

function resolveBoxStyle(props: BoxProps): Style | undefined {
  const {
    className,
    direction, gap, padding, px, py, margin,
    align, justify, xAlign, yAlign, fill, fit, grow, bg, radius,
    w, h, wrap, scroll, hidden, z, style,
  } = props;

  const hasShorthands = (
    direction !== undefined || gap !== undefined || padding !== undefined ||
    px !== undefined || py !== undefined || margin !== undefined ||
    align !== undefined || justify !== undefined ||
    xAlign !== undefined || yAlign !== undefined || fill || fit || grow ||
    bg !== undefined || radius !== undefined || w !== undefined ||
    h !== undefined || wrap || scroll || hidden || z !== undefined
  );

  if (!className && !hasShorthands) return style;

  const base: Style = className ? { ...tw(className) } : {};

  if (hasShorthands) {
    if (direction === 'row') base.flexDirection = 'row';
    if (direction === 'col') base.flexDirection = 'column';
    if (gap !== undefined) base.gap = gap;
    if (padding !== undefined) base.padding = padding;
    if (px !== undefined) { base.paddingLeft = px; base.paddingRight = px; }
    if (py !== undefined) { base.paddingTop = py; base.paddingBottom = py; }
    if (margin !== undefined) base.margin = margin;
    if (align) base.alignItems = align;
    if (justify) base.justifyContent = justify;
    // xAlign/yAlign: direction-aware — x always means horizontal, y always means vertical
    if (xAlign !== undefined || yAlign !== undefined) {
      const isRow = base.flexDirection === 'row' || direction === 'row';
      if (xAlign !== undefined) {
        if (isRow) base.justifyContent = xAlign; else base.alignItems = xAlign;
      }
      if (yAlign !== undefined) {
        if (isRow) base.alignItems = yAlign; else base.justifyContent = yAlign;
      }
    }
    if (fill) { base.width = '100%'; base.height = '100%'; }
    if (fit) { base.width = 'fit-content'; base.height = 'fit-content'; }
    if (grow) base.flexGrow = 1;
    if (bg !== undefined) base.backgroundColor = bg;
    if (radius !== undefined) base.borderRadius = radius;
    if (w !== undefined) base.width = w;
    if (h !== undefined) base.height = h;
    if (wrap) base.flexWrap = 'wrap';
    if (scroll) base.overflow = 'scroll';
    if (hidden) base.display = 'none';
    if (z !== undefined) base.zIndex = z;
  }

  return style ? { ...base, ...style } : base;
}

function resolveTextStyle(props: TextProps): Style | undefined {
  const { size, color, bold, italic, align, font, style } = props;

  if (
    size === undefined && color === undefined && !bold && !italic &&
    align === undefined && font === undefined
  ) {
    return style;
  }

  const base: Style = {};
  if (size !== undefined) base.fontSize = size;
  if (color !== undefined) base.color = color;
  if (bold) base.fontWeight = 'bold';
  if (italic) (base as any).fontStyle = 'italic';
  if (align) base.textAlign = align;
  if (font) base.fontFamily = font;

  return style ? { ...base, ...style } : base;
}

function resolveImageStyle(props: ImageProps): Style | undefined {
  const { w, h, radius, style } = props;

  if (w === undefined && h === undefined && radius === undefined) {
    return style;
  }

  const base: Style = {};
  if (w !== undefined) base.width = w;
  if (h !== undefined) base.height = h;
  if (radius !== undefined) base.borderRadius = radius;

  return style ? { ...base, ...style } : base;
}

// ── Primitives ─────────────────────────────────────────

export function Box(props: BoxProps) {
  const anyProps = props as any;
  const playgroundLine = anyProps.__rjitPlaygroundLine;
  const playgroundTag = anyProps.__rjitPlaygroundTag;
  const {
    backgroundVideo, backgroundVideoFit, hoverVideo, hoverVideoFit,
    hoverStyle, activeStyle, focusStyle,
    focusable, focusGroup, focusGroupController, focusGroupRingColor,
    onClick, onRelease, onPointerEnter, onPointerLeave,
    onKeyDown, onKeyUp, onTextInput, onWheel,
    onTouchStart, onTouchEnd, onTouchMove,
    onGamepadPress, onGamepadRelease, onGamepadAxis,
    onMidiNote, onMidiCC,
    onDragStart, onDrag, onDragEnd,
    fileDropMode,
    onFileDrop, onDirectoryDrop, onFileDragEnter, onFileDragLeave,
    onFocus, onBlur,
    onLayout,
    tooltip,
    children,
  } = props;

  const resolvedStyle = resolveBoxStyle(props);
  const tokens = useThemeColorsOptional();
  const scaledStyle = resolveStyleColors(useScaledStyle(resolvedStyle), tokens);
  const scaledHoverStyle = resolveStyleColors(useScaledStyle(hoverStyle), tokens);
  const scaledActiveStyle = resolveStyleColors(useScaledStyle(activeStyle), tokens);
  const scaledFocusStyle = resolveStyleColors(useScaledStyle(focusStyle), tokens);

  const hostProps: any = {
    style: scaledStyle,
    backgroundVideo,
    backgroundVideoFit,
    hoverVideo,
    hoverVideoFit,
    hoverStyle: scaledHoverStyle,
    activeStyle: scaledActiveStyle,
    focusStyle: scaledFocusStyle,
    focusable,
    focusGroup,
    focusGroupController,
    focusGroupRingColor,
    onClick,
    onRelease,
    onPointerEnter,
    onPointerLeave,
    onKeyDown,
    onKeyUp,
    onTextInput,
    onWheel,
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onGamepadPress,
    onGamepadRelease,
    onGamepadAxis,
    onMidiNote,
    onMidiCC,
    onDragStart,
    onDrag,
    onDragEnd,
    fileDropMode,
    onFileDrop,
    onDirectoryDrop,
    onFileDragEnter,
    onFileDragLeave,
    onFocus,
    onBlur,
    onLayout,
    tooltip,
  };
  if (playgroundLine !== undefined) hostProps.__rjitPlaygroundLine = playgroundLine;
  if (playgroundTag !== undefined) hostProps.__rjitPlaygroundTag = playgroundTag;
  if (anyProps.debugLayout) hostProps.debugLayout = true;

  return React.createElement(
    'View',
    hostProps,
    children
  );
}

/** Row -- shorthand for <Box direction="row"> */
export function Row({ gap, ...rest }: BoxProps) {
  const el = <Box direction="row" gap={gap} {...rest} />;
  if (gap == null || gap === 0) return el;
  return <GridGapContext.Provider value={typeof gap === 'number' ? gap : 0}>{el}</GridGapContext.Provider>;
}

/**
 * Col -- column layout primitive with optional 12-column grid support.
 *
 * Without grid props: behaves as <Box direction="col"> (backwards compatible).
 * With grid props: computes flexBasis from a 12-column span system.
 */
export function Col({ span, sm, md, lg, xl, responsive, style, ...rest }: ColProps) {
  const hasGrid = span !== undefined || sm !== undefined || md !== undefined
    || lg !== undefined || xl !== undefined || responsive;

  if (!hasGrid) return <Box direction="col" style={style} {...rest} />;

  const bp = useBreakpoint();

  const eSm = sm ?? (responsive ? RESPONSIVE_DEFAULTS.sm : undefined);
  const eMd = md ?? (responsive ? RESPONSIVE_DEFAULTS.md : undefined);
  const eLg = lg ?? (responsive ? RESPONSIVE_DEFAULTS.lg : undefined);
  const eXl = xl ?? (responsive ? RESPONSIVE_DEFAULTS.xl : undefined);

  const bpRank: Record<Breakpoint, number> = { sm: 0, md: 1, lg: 2, xl: 3 };
  const rank = bpRank[bp];
  const cascade: [Breakpoint, typeof eSm][] = [
    ['xl', eXl], ['lg', eLg], ['md', eMd], ['sm', eSm],
  ];
  let activeSpan = span ?? 12;
  for (const [b, val] of cascade) {
    if (bpRank[b] <= rank && val !== undefined) {
      activeSpan = val;
      break;
    }
  }

  const numericSpan = resolveSpan(activeSpan);
  const pct = spanToFlexBasis(numericSpan);
  const gridStyle: Style = {
    flexBasis: pct,
    flexGrow: 0,
    ...style,
  };

  return <Box style={gridStyle} {...rest} />;
}

export function Text(props: TextProps) {
  const anyProps = props as any;
  const playgroundLine = anyProps.__rjitPlaygroundLine;
  const playgroundTag = anyProps.__rjitPlaygroundTag;
  const { lines, numberOfLines, onKeyDown, onKeyUp, onTextInput, children } = props;
  const resolvedStyle = resolveTextStyle(props);
  const tokens = useThemeColorsOptional();
  const scaledStyle = resolveStyleColors(useScaledStyle(resolvedStyle), tokens);
  const resolvedLines = lines ?? numberOfLines;

  const hostProps: any = { style: scaledStyle, numberOfLines: resolvedLines, onKeyDown, onKeyUp, onTextInput };
  if (playgroundLine !== undefined) hostProps.__rjitPlaygroundLine = playgroundLine;
  if (playgroundTag !== undefined) hostProps.__rjitPlaygroundTag = playgroundTag;
  return React.createElement('Text', hostProps, children);
}

export function Image(props: ImageProps) {
  const anyProps = props as any;
  const playgroundLine = anyProps.__rjitPlaygroundLine;
  const playgroundTag = anyProps.__rjitPlaygroundTag;
  const { src, onClick, onWheel } = props;
  const resolvedStyle = resolveImageStyle(props);
  const scaledStyle = useScaledStyle(resolvedStyle);

  // If src looks like a bare name (no path separators, no file extension),
  // check the icon registry. Renders as vector strokePaths when matched.
  const isBareName = src && !src.includes('/') && !src.includes('\\') && !src.includes('.');
  const iconPaths = isBareName ? lookupIcon(src) : undefined;

  if (iconPaths) {
    const iconStyle: any = { ...scaledStyle, strokePaths: iconPaths, strokeWidth: 2 };
    // Map color → strokeColor so theme tokens color the icon
    if (scaledStyle?.color && !iconStyle.strokeColor) iconStyle.strokeColor = scaledStyle.color;
    const hostProps: any = {
      style: iconStyle,
      onClick,
      onWheel,
    };
    if (playgroundLine !== undefined) hostProps.__rjitPlaygroundLine = playgroundLine;
    if (playgroundTag !== undefined) hostProps.__rjitPlaygroundTag = playgroundTag;
    return React.createElement('View', hostProps);
  }

  const hostProps: any = { src, style: scaledStyle, onClick, onWheel };
  if (playgroundLine !== undefined) hostProps.__rjitPlaygroundLine = playgroundLine;
  if (playgroundTag !== undefined) hostProps.__rjitPlaygroundTag = playgroundTag;
  return React.createElement('Image', hostProps);
}

// ── Render (external capture) ─────────────────────────

export function Render(props: RenderProps) {
  const { source, fps, resolution, interactive, muted, objectFit, vmMemory, vmCpus, onClick, onReady, onError, onFrame, w, h, radius, style } = props;
  const base: Style = {};
  if (w !== undefined) base.width = w;
  if (h !== undefined) base.height = h;
  if (radius !== undefined) base.borderRadius = radius;
  const resolvedStyle = (w !== undefined || h !== undefined || radius !== undefined)
    ? (style ? { ...base, ...style } : base)
    : style;
  const scaledStyle = useScaledStyle(resolvedStyle);

  return React.createElement('Render', {
    source, fps, resolution, interactive, muted, objectFit,
    vmMemory, vmCpus,
    style: scaledStyle,
    onClick, onReady, onError, onFrame,
  });
}

// ── FocusGroup ────────────────────────────────────────

export function FocusGroup({ controller, ringColor, style, children }: FocusGroupProps) {
  return (
    <Box
      style={style}
      focusGroup={true}
      focusGroupController={controller}
      focusGroupRingColor={ringColor}
    >
      {children}
    </Box>
  );
}
