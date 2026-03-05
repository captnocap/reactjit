import React from 'react';
import type { TooltipProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (!ll) return undefined;
  if (Array.isArray(ll)) return ll;
  if (ll.lat !== undefined) return [ll.lat, ll.lng];
  return undefined;
};

const extractText = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  return '';
};

export function Tooltip({
  position,
  direction,
  permanent,
  sticky,
  opacity,
  eventHandlers,
  children,
}: TooltipProps) {
  return React.createElement('MapTooltip', {
    position: normalizeLatLng(position),
    text: extractText(children),
    direction: direction ?? 'auto',
    permanent: permanent || false,
    sticky: sticky || false,
    opacity: opacity ?? 0.9,
    onOpen: eventHandlers?.tooltipopen,
    onClose: eventHandlers?.tooltipclose,
  });
}
