// =============================================================================
// DirectionalLight — sun-like directional light
// =============================================================================


import type { DirectionalLightProps, Vec3 } from './types';
import { useScene3D } from './useScene3D';

export function DirectionalLight(props: DirectionalLightProps) {
  const scene = useScene3D();
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scene) return;
    const id = scene.nextId();
    idRef.current = id;
    scene.lights.add({
      id, kind: 'directional',
      direction: (props.direction ?? [0.5, 1, 0.25]) as Vec3,
      color: props.color ?? '#ffffff',
      intensity: props.intensity ?? 1,
    });
    return () => { scene.lights.remove(id); idRef.current = null; };
  }, [scene]);

  useEffect(() => {
    if (!scene || idRef.current === null) return;
    scene.lights.update(idRef.current, {
      direction: (props.direction ?? [0.5, 1, 0.25]) as Vec3,
      color: props.color ?? '#ffffff',
      intensity: props.intensity ?? 1,
    });
  }, [
    scene,
    props.direction && props.direction[0],
    props.direction && props.direction[1],
    props.direction && props.direction[2],
    props.color, props.intensity,
  ]);

  return null;
}
