import React from 'react';
import type { MeshProps } from './types';

export function Mesh(props: MeshProps) {
  return React.createElement('Mesh3D', {
    geometry: props.geometry,
    model: props.model,
    color: props.color,
    texture: props.texture,
    seed: props.seed,
    position: props.position,
    rotation: props.rotation,
    spin: props.spin,
    scale: props.scale,
    edgeColor: props.edgeColor,
    edgeWidth: props.edgeWidth,
    wireframe: props.wireframe,
    gridLines: props.gridLines,
    opacity: props.opacity,
    specular: props.specular,
    fresnel: props.fresnel,
    unlit: props.unlit,
    onClick: props.onClick,
    onPointerEnter: props.onPointerEnter,
    onPointerLeave: props.onPointerLeave,
  });
}
