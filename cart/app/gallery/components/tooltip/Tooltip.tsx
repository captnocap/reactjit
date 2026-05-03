import { useEffect, useRef, useState } from 'react';
import { Box, Col, Row } from '@reactjit/runtime/primitives';
import { Activity, Bell, Bot, ChartLine, Command, Hash, Link, Shield, Target } from '@reactjit/runtime/icons/icons';
import { EASINGS, type EasingName } from '@reactjit/runtime/easing';
import { Divider, Mono } from '../controls-specimen/controlsSpecimenParts';
import { StatusBadge } from '../controls-specimen/StatusBadge';
import type { ControlTone } from '../controls-specimen/controlsSpecimenTheme';
import { TooltipDataRow } from '../tooltip-data-row/TooltipDataRow';
import { TooltipFrame } from '../tooltip-frame/TooltipFrame';
import { TooltipHeader } from '../tooltip-header/TooltipHeader';
import type { IconData } from '../../../sweatshop/components/icons';

export type TooltipType = 'basic' | 'rich';
export type BasicTooltipMethod = 'command' | 'field' | 'status' | 'reference';
export type RichTooltipMethod = 'metrics' | 'worker' | 'task' | 'hook' | 'constraint';
export type TooltipMethod = BasicTooltipMethod | RichTooltipMethod;
export type TooltipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export type TooltipAppear = 'fade' | 'rise' | 'scale' | 'pop';

export type TooltipRow = {
  label: string;
  value: string;
  tone?: ControlTone;
};

export type TooltipData = {
  tone?: TooltipTone;
  title?: string;
  detail?: string;
  shortcut?: string;
  meta?: string;
  source?: string;
  badge?: string;
  rows?: TooltipRow[];
  footer?: string;
};

export type TooltipProps = {
  type?: TooltipType;
  method?: TooltipMethod;
  data?: TooltipData;
  appear?: TooltipAppear | false;
  appearDelayMs?: number;
  appearDurationMs?: number;
  appearEasing?: EasingName;
};

const BASIC_DEFAULTS: Record<BasicTooltipMethod, Required<Pick<TooltipData, 'title' | 'detail' | 'meta' | 'tone'>> & Pick<TooltipData, 'shortcut'>> = {
  command: {
    title: 'Open command palette',
    detail: 'Quick access to actions and files.',
    shortcut: 'Cmd K',
    tone: 'accent',
    meta: 'command',
  },
  field: {
    title: 'Required field',
    detail: 'This value is persisted with the shape row.',
    tone: 'neutral',
    meta: 'schema field',
  },
  status: {
    title: 'Worker is streaming',
    detail: 'Live lifecycle state from the Worker row.',
    tone: 'success',
    meta: 'runtime status',
  },
  reference: {
    title: 'Linked data shape',
    detail: 'Follow this relationship through the gallery catalog.',
    tone: 'warning',
    meta: 'reference',
  },
};

const RICH_DEFAULTS: Record<RichTooltipMethod, Required<Pick<TooltipData, 'title' | 'detail' | 'badge' | 'tone' | 'rows' | 'footer'>>> = {
  metrics: {
    title: 'Render pipeline',
    detail: 'Frame budget snapshot',
    badge: 'metrics',
    tone: 'accent',
    rows: [
      { label: 'P50', value: '42 ms', tone: 'ok' },
      { label: 'P95', value: '118 ms', tone: 'warn' },
      { label: 'ERR', value: '0.4%', tone: 'flag' },
    ],
    footer: 'Metric rows use the tooltip data-row atom.',
  },
  worker: {
    title: 'Worker context',
    detail: 'Runtime actor snapshot',
    badge: 'worker',
    tone: 'success',
    rows: [
      { label: 'KIND', value: 'primary', tone: 'ok' },
      { label: 'STATE', value: 'streaming', tone: 'accent' },
      { label: 'REQ', value: '1', tone: 'blue' },
    ],
    footer: 'Bound to Worker.kind and lifecycle.',
  },
  task: {
    title: 'Task context',
    detail: 'Atomic work unit',
    badge: 'task',
    tone: 'accent',
    rows: [
      { label: 'KIND', value: 'code', tone: 'accent' },
      { label: 'STATE', value: 'active', tone: 'warn' },
      { label: 'ART', value: '1', tone: 'blue' },
    ],
    footer: 'Bound to Task.kind, status, and artifactRefs.',
  },
  hook: {
    title: 'Event hook',
    detail: 'Reactive rule',
    badge: 'hook',
    tone: 'warning',
    rows: [
      { label: 'MATCH', value: 'constraint', tone: 'warn' },
      { label: 'ACTION', value: 'notify', tone: 'accent' },
      { label: 'FIRES', value: '1', tone: 'ok' },
    ],
    footer: 'Bound to EventHook.match and action.kind.',
  },
  constraint: {
    title: 'Constraint',
    detail: 'Boundary that travels with work',
    badge: 'constraint',
    tone: 'danger',
    rows: [
      { label: 'KIND', value: 'forbidden', tone: 'flag' },
      { label: 'SEV', value: 'hard', tone: 'warn' },
      { label: 'MODE', value: 'block', tone: 'flag' },
    ],
    footer: 'Bound to Constraint.kind, severity, and violationResponse.',
  },
};

function toControlTone(tone: TooltipTone): ControlTone {
  switch (tone) {
    case 'accent':
      return 'accent';
    case 'success':
      return 'ok';
    case 'warning':
      return 'warn';
    case 'danger':
      return 'flag';
    default:
      return 'neutral';
  }
}

function basicIcon(method: BasicTooltipMethod): IconData {
  switch (method) {
    case 'field':
      return Hash;
    case 'status':
      return Activity;
    case 'reference':
      return Link;
    default:
      return Command;
  }
}

function richIcon(method: RichTooltipMethod): IconData {
  switch (method) {
    case 'worker':
      return Bot;
    case 'task':
      return Target;
    case 'hook':
      return Bell;
    case 'constraint':
      return Shield;
    default:
      return ChartLine;
  }
}

function asBasicMethod(method: TooltipMethod | undefined): BasicTooltipMethod {
  return method === 'field' || method === 'status' || method === 'reference' || method === 'command'
    ? method
    : 'command';
}

function asRichMethod(method: TooltipMethod | undefined): RichTooltipMethod {
  return method === 'worker' || method === 'task' || method === 'hook' || method === 'constraint' || method === 'metrics'
    ? method
    : 'metrics';
}

function textLines(value: string, maxChars: number): string[] {
  const source = String(value || '').trim();
  if (!source) return [];
  const lines: string[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    let line = '';

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function cancelFrame(frameId: any): void {
  if (frameId == null) return;
  const host: any = globalThis;
  const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
  if (cancel) cancel(frameId);
  else clearTimeout(frameId);
}

function scheduleFrame(fn: () => void): any {
  const host: any = globalThis;
  const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
  return raf ? raf(fn) : setTimeout(fn, 16);
}

function useAppearProgress(durationMs: number, delayMs: number, easing: EasingName): number {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now() + Math.max(0, delayMs);
    const ease = EASINGS[easing] || EASINGS.easeOutCubic;

    const tick = () => {
      if (cancelled) return;
      const raw = (Date.now() - startedAt) / Math.max(1, durationMs);
      const next = ease(raw);
      setProgress(next);
      if (raw < 1) frameRef.current = scheduleFrame(tick);
    };

    setProgress(0);
    frameRef.current = scheduleFrame(tick);
    return () => {
      cancelled = true;
      cancelFrame(frameRef.current);
    };
  }, [delayMs, durationMs, easing]);

  return progress;
}

function TooltipAppearFrame({
  mode,
  delayMs,
  durationMs,
  easing,
  children,
}: {
  mode: TooltipAppear | false;
  delayMs: number;
  durationMs: number;
  easing: EasingName;
  children: any;
}) {
  const t = useAppearProgress(durationMs, delayMs, easing);
  if (mode === false) return children;

  const opacity = Math.max(0, Math.min(1, t));
  const lift = mode === 'fade' ? 0 : mode === 'scale' ? 4 : mode === 'pop' ? 10 : 8;
  const startScale = mode === 'fade' ? 1 : mode === 'rise' ? 0.985 : mode === 'scale' ? 0.96 : 0.92;
  const scale = startScale + (1 - startScale) * t;

  return (
    <Box
      style={{
        opacity,
        scaleX: scale,
        scaleY: scale,
        marginTop: (1 - opacity) * lift,
      }}
    >
      {children}
    </Box>
  );
}

function BasicTooltipView({ method, data }: { method: BasicTooltipMethod; data: TooltipData }) {
  const defaults = BASIC_DEFAULTS[method];
  const controlTone = toControlTone(data.tone || defaults.tone);
  const metaLabel = data.source ? data.source.replace(/^[^.]+\./, '') : data.meta || defaults.meta;

  return (
    <TooltipFrame width={300} tone={controlTone} spine={method.toUpperCase()}>
      <TooltipHeader
        title={data.title || defaults.title}
        detail={data.detail || defaults.detail}
        shortcut={data.shortcut === undefined ? defaults.shortcut : data.shortcut}
        tone={controlTone}
        icon={basicIcon(method)}
      />
      <StatusBadge label={metaLabel} tone={controlTone} variant="led" />
    </TooltipFrame>
  );
}

function RichTooltipView({ method, data }: { method: RichTooltipMethod; data: TooltipData }) {
  const defaults = RICH_DEFAULTS[method];
  const controlTone = toControlTone(data.tone || defaults.tone);
  const rows = data.rows || defaults.rows;
  const footerLines = textLines(data.footer || defaults.footer, 58);

  return (
    <TooltipFrame width={360} tone={controlTone} spine={method.toUpperCase()}>
      <TooltipHeader
        title={data.title || defaults.title}
        detail={data.detail || defaults.detail}
        tone={controlTone}
        icon={richIcon(method)}
      />
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusBadge label={data.badge || defaults.badge} tone={controlTone} variant="led" />
        <StatusBadge label={`${rows.length} fields`} tone="neutral" variant="outline" />
      </Row>
      <Divider />
      <Col style={{ width: '100%', gap: 8 }}>
        {rows.map((row) => (
          <TooltipDataRow key={row.label} label={row.label} value={row.value} tone={row.tone || controlTone} />
        ))}
      </Col>
      {footerLines.length ? (
        <>
          <Divider />
          <Col style={{ width: '100%', gap: 1 }}>
            {footerLines.map((line, index) => (
              <Mono key={`${line}-${index}`} fontSize={9} lineHeight={10} letterSpacing={0.4} noWrap>
                {line}
              </Mono>
            ))}
          </Col>
        </>
      ) : null}
    </TooltipFrame>
  );
}

export function Tooltip({
  type = 'rich',
  method,
  data = {},
  appear = 'rise',
  appearDelayMs = 0,
  appearDurationMs = 220,
  appearEasing = 'easeOutCubic',
}: TooltipProps) {
  const content = type === 'basic'
    ? <BasicTooltipView method={asBasicMethod(method)} data={data} />
    : <RichTooltipView method={asRichMethod(method)} data={data} />;

  return (
    <TooltipAppearFrame
      mode={appear}
      delayMs={appearDelayMs}
      durationMs={appearDurationMs}
      easing={appearEasing}
    >
      {content}
    </TooltipAppearFrame>
  );
}
