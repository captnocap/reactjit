// =============================================================================
// PointLight — positional light with falloff
// =============================================================================
// Not in the love2d reference package — added here because the supervisor
// brief asked for it. Registers a LightNode{kind:'point'} with a world
// position, colour, intensity, and max range (falloff zero at r>range).
// =============================================================================


import type { PointLightProps, Vec3 } from './types';
import { useScene3D } from './useScene3D';

export function PointLight(props: PointLightProps) {
  const scene = useScene3D();
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scene) return;
    const id = scene.nextId();
    idRef.current = id;
    scene.lights.add({
      id, kind: 'point',
      position: (props.position ?? [0, 3, 0]) as Vec3,
      color: props.color ?? '#ffffff',
      intensity: props.intensity ?? 1,
      range: props.range ?? 10,
    });
    return () => { scene.lights.remove(id); idRef.current = null; };
  }, [scene]);

  useEffect(() => {
    if (!scene || idRef.current === null) return;
    scene.lights.update(idRef.current, {
      position: (props.position ?? [0, 3, 0]) as Vec3,
      color: props.color ?? '#ffffff',
      intensity: props.intensity ?? 1,
      range: props.range ?? 10,
    });
  }, [
    scene,
    props.position && props.position[0],
    props.position && props.position[1],
    props.position && props.position[2],
    props.color, props.intensity, props.range,
  ]);

  return null;
}
