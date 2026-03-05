import React from 'react';
import type { LayersControlProps, ControlledLayerProps } from './types';

function LayersControlBase({ position, collapsed, children }: LayersControlProps) {
  return React.createElement(
    'MapLayersControl',
    { position: position ?? 'topright', collapsed: collapsed ?? true },
    children,
  );
}

function BaseLayer({ checked, name, children }: ControlledLayerProps) {
  return React.createElement('MapLayersControlBaseLayer', { checked, name }, children);
}

function Overlay({ checked, name, children }: ControlledLayerProps) {
  return React.createElement('MapLayersControlOverlay', { checked, name }, children);
}

export const LayersControl = Object.assign(LayersControlBase, {
  BaseLayer,
  Overlay,
});
