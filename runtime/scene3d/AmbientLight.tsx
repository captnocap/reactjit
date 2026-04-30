// =============================================================================
// AmbientLight — uniform base illumination
// =============================================================================


import type { AmbientLightProps } from './types';
import { useScene3D } from './useScene3D';

export function AmbientLight(props: AmbientLightProps) {
  const scene = useScene3D();
  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scene) return;
    const id = scene.nextId();
    idRef.current = id;
    scene.lights.add({
      id, kind: 'ambient',
      color: props.color ?? '#1a1a2e',
      intensity: props.intensity ?? 0.15,
    });
    return () => { scene.lights.remove(id); idRef.current = null; };
  }, [scene]);

  useEffect(() => {
    if (!scene || idRef.current === null) return;
    scene.lights.update(idRef.current, {
      color: props.color ?? '#1a1a2e',
      intensity: props.intensity ?? 0.15,
    });
  }, [scene, props.color, props.intensity]);

  return null;
}
