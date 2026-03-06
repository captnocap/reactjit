import React from 'react';
import type { PopupProps } from './types';

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

export function Popup({
  position,
  maxWidth,
  minWidth,
  closeButton,
  autoClose,
  closeOnClick,
  closeOnEscapeKey,
  eventHandlers,
  children,
}: PopupProps) {
  return React.createElement('MapPopup', {
    position: normalizeLatLng(position),
    text: extractText(children),
    maxWidth: maxWidth ?? 300,
    minWidth: minWidth ?? 50,
    closeButton: closeButton !== false,
    autoClose: autoClose !== false,
    closeOnClick: closeOnClick !== false,
    closeOnEscapeKey: closeOnEscapeKey !== false,
    onOpen: eventHandlers?.popupopen,
    onClose: eventHandlers?.popupclose,
  });
}
