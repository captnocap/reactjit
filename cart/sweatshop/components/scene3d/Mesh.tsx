// =============================================================================
// Mesh — a renderable object inside Scene3D
// =============================================================================
// Author-facing geometry prop accepts either a full GeometryDescriptor or
// a shorthand kind string ('box' | 'sphere' | 'plane' | 'torus'). material
// accepts a full StandardMaterial partial, a colour-hex shorthand, or
// nothing (default blue-grey). Transforms are reactive — changing position
// etc. pushes into the registry.
// =============================================================================


import type { GeometryDescriptor, MeshNode, MeshProps, Vec3 } from './types';
import { useScene3D } from './useScene3D';
import { makeBoxGeometry } from './geometry/Box';
import { makeSphereGeometry } from './geometry/Sphere';
import { makePlaneGeometry } from './geometry/Plane';
import { makeTorusGeometry } from './geometry/Torus';
import { resolveMaterial } from './material/StandardMaterial';

function resolveGeometry(input: MeshProps['geometry']): GeometryDescriptor {
  if (!input) return makeBoxGeometry();
  if (typeof input === 'string') {
    if (input === 'sphere') return makeSphereGeometry();
    if (input === 'plane')  return makePlaneGeometry();
    if (input === 'torus')  return makeTorusGeometry();
    return makeBoxGeometry();
  }
  return input;
}

function resolveScale(input: MeshProps['scale']): Vec3 {
  if (typeof input === 'number') return [input, input, input];
  if (Array.isArray(input)) return input;
  return [1, 1, 1];
}

export function Mesh(props: MeshProps) {
  const scene = useScene3D();
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scene) return;
    const id = scene.nextId();
    idRef.current = id;
    const node: MeshNode = {
      id,
      position: props.position ?? [0, 0, 0],
      rotation: props.rotation ?? [0, 0, 0],
      scale:    resolveScale(props.scale),
      geometry: resolveGeometry(props.geometry),
      material: resolveMaterial(props.material as any),
      wireframe: !!props.wireframe,
      visible: props.visible !== false,
    };
    scene.meshes.add(node);
    return () => { scene.meshes.remove(id); idRef.current = null; };
  }, [scene]);

  useEffect(() => {
    if (!scene || idRef.current === null) return;
    scene.meshes.update(idRef.current, {
      position: props.position ?? [0, 0, 0],
      rotation: props.rotation ?? [0, 0, 0],
      scale:    resolveScale(props.scale),
      geometry: resolveGeometry(props.geometry),
      material: resolveMaterial(props.material as any),
      wireframe: !!props.wireframe,
      visible: props.visible !== false,
    });
  }, [
    scene,
    props.position && props.position[0], props.position && props.position[1], props.position && props.position[2],
    props.rotation && props.rotation[0], props.rotation && props.rotation[1], props.rotation && props.rotation[2],
    typeof props.scale === 'number' ? props.scale : (props.scale && props.scale[0]),
    typeof props.scale === 'number' ? props.scale : (props.scale && props.scale[1]),
    typeof props.scale === 'number' ? props.scale : (props.scale && props.scale[2]),
    typeof props.geometry === 'string' ? props.geometry : (props.geometry && props.geometry.kind),
    typeof props.material === 'string' ? props.material : (props.material && props.material.color),
    typeof props.material === 'string' ? null : (props.material && props.material.roughness),
    typeof props.material === 'string' ? null : (props.material && props.material.metalness),
    props.wireframe,
    props.visible,
  ]);

  return null;
}
