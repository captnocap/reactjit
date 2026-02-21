import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { MeshProps } from './types';

/**
 * <Mesh> — a renderable 3D object inside a <Scene>.
 *
 * Can be a built-in geometry (box, sphere, plane) or a loaded model (.obj).
 * Position, rotation, and scale are reactive props that update the transform
 * each frame without reconciliation overhead.
 *
 * Usage:
 *   <Mesh geometry="box" color="#89b4fa" position={[0, 1, 0]} />
 *   <Mesh geometry="sphere" color="#f5c2e7" rotation={[0, spin, 0]} />
 *   <Mesh model="maps/de_dust2.obj" scale={0.5} />
 */
export function Mesh(props: MeshProps) {
  const mode = useRendererMode();
  if (mode === 'web') return null;

  return React.createElement('Mesh3D', {
    geometry: props.geometry,
    model: props.model,
    color: props.color,
    texture: props.texture,
    seed: props.seed,
    position: props.position,
    rotation: props.rotation,
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
