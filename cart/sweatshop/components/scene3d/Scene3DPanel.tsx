// =============================================================================
// Scene3DPanel — three live Scene3D instances sharing state
// =============================================================================
// The panel mounts three independent Scene3D surfaces (Cube, Orbiting
// Satellites, Planet + Atmosphere) driven by a shared 32ms tick. Each scene
// is a real scene graph — meshes register with the scene's own registry,
// the camera drives real projection math, orbit controls actually mutate
// the camera, and the wireframe toggle propagates through
// Scene3D.wireframeAll to every mesh in all three scenes.
//
// User-controlled (persisted under sweatshop.scene3d.*):
// camera projection (perspective | ortho), orbit enabled, wireframe toggle,
// shared directional-light direction (X/Y steppers).
// =============================================================================


import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Scene3D } from '@reactjit/runtime/scene3d/Scene3D';
import { Camera } from '@reactjit/runtime/scene3d/Camera';
import { Mesh } from '@reactjit/runtime/scene3d/Mesh';
import { AmbientLight } from '@reactjit/runtime/scene3d/AmbientLight';
import { DirectionalLight } from '@reactjit/runtime/scene3d/DirectionalLight';
import { PointLight } from '@reactjit/runtime/scene3d/PointLight';
import { OrbitControls } from '@reactjit/runtime/scene3d/OrbitControls';
import type { CameraKind } from '@reactjit/runtime/scene3d/types';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

function sget(path: string, fallback: any): any {
  try {
    const raw = storeGet('sweatshop.scene3d.' + path);
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof fallback === 'boolean') return raw === 'true' || raw === '1';
    if (typeof fallback === 'number') { const n = Number(raw); return isNaN(n) ? fallback : n; }
    return String(raw);
  } catch { return fallback; }
}
function sset(path: string, value: any) {
  try { storeSet('sweatshop.scene3d.' + path, String(value)); } catch {}
}

export function Scene3DPanel() {
  const [tick, setTick] = useState(0);
  const [cameraKind, setCameraKind] = useState(sget('cameraKind', 'perspective') as CameraKind);
  const [orbit, setOrbit]           = useState(sget('orbit', true));
  const [wireframe, setWireframe]   = useState(sget('wireframe', false));
  const [lightX, setLightX]         = useState(sget('lightX', 0.6));
  const [lightY, setLightY]         = useState(sget('lightY', 0.9));

  useEffect(() => {
    const id = setInterval(() => setTick((n: number) => (n + 1) % 1_000_000), 32);
    return () => { try { clearInterval(id); } catch {} };
  }, []);

  const spin = tick * 0.04;
  const orbitAngle = tick * 0.02;

  const hdr = (
    <Row style={{
      alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Scene3D playground</Text>
      <Text fontSize={10} color={COLORS.textDim}>cube · galaxy stub · planet atmosphere</Text>
      <Box style={{ flexGrow: 1 }} />
      <Pressable onPress={() => { const next = cameraKind === 'perspective' ? 'ortho' : 'perspective'; setCameraKind(next); sset('cameraKind', next); }}
        style={tinyBtnStyle(cameraKind === 'ortho' ? COLORS.purple : COLORS.blue)}>
        <Text fontSize={10} color={cameraKind === 'ortho' ? COLORS.purple : COLORS.blue} style={{ fontWeight: 'bold' }}>{cameraKind}</Text>
      </Pressable>
      <Pressable onPress={() => { const next = !orbit; setOrbit(next); sset('orbit', next); }}
        style={tinyBtnStyle(orbit ? COLORS.green : COLORS.textDim)}>
        <Text fontSize={10} color={orbit ? COLORS.green : COLORS.textDim} style={{ fontWeight: 'bold' }}>orbit {orbit ? 'on' : 'off'}</Text>
      </Pressable>
      <Pressable onPress={() => { const next = !wireframe; setWireframe(next); sset('wireframe', next); }}
        style={tinyBtnStyle(wireframe ? COLORS.orange : COLORS.textDim)}>
        <Text fontSize={10} color={wireframe ? COLORS.orange : COLORS.textDim} style={{ fontWeight: 'bold' }}>wire {wireframe ? 'on' : 'off'}</Text>
      </Pressable>
      <Text fontSize={9} color={COLORS.textDim}>lx</Text>
      <StepperSmall value={lightX} onChange={(v) => { setLightX(v); sset('lightX', v); }} />
      <Text fontSize={9} color={COLORS.textDim}>ly</Text>
      <StepperSmall value={lightY} onChange={(v) => { setLightY(v); sset('lightY', v); }} />
    </Row>
  );

  return (
    <Col style={{ width: '100%', height: '100%', padding: 10, gap: 10, backgroundColor: COLORS.panelBg }}>
      {hdr}
      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ flexGrow: 1, flexBasis: 260, minHeight: 220, gap: 4 }}>
          <Text fontSize={10} color={COLORS.textDim}>cube</Text>
          <Scene3D style={{ flexGrow: 1 }} backgroundColor="#0a0e18" wireframeAll={wireframe}>
            <Camera kind={cameraKind} position={[3, 2, 4]} target={[0, 0, 0]} fov={Math.PI / 3} orthoSize={4} />
            <AmbientLight color="#1b2235" intensity={0.35} />
            <DirectionalLight direction={[lightX, lightY, -0.35]} color="#fff2d8" intensity={1.3} />
            <Mesh geometry="box" material={{ color: '#4aa3ff', metalness: 0.2, roughness: 0.4 }}
              rotation={[spin * 0.7, spin, spin * 0.3]} />
            <Mesh geometry="plane" material="#1a2334" position={[0, -1, 0]} scale={[4, 1, 4]} />
            {orbit ? <OrbitControls /> : null}
          </Scene3D>
        </Col>
        <Col style={{ flexGrow: 1, flexBasis: 260, minHeight: 220, gap: 4 }}>
          <Text fontSize={10} color={COLORS.textDim}>orbiting satellites</Text>
          <Scene3D style={{ flexGrow: 1 }} backgroundColor="#05070f" wireframeAll={wireframe}>
            <Camera kind={cameraKind} position={[0, 4, 6]} target={[0, 0, 0]} fov={Math.PI / 3} orthoSize={6} />
            <AmbientLight color="#05070f" intensity={0.1} />
            <PointLight position={[0, 0, 0]} color="#ffc48a" intensity={2} range={8} />
            <Mesh geometry={{ kind: 'sphere', radius: 0.45, widthSegments: 16, heightSegments: 12 }}
              material={{ color: '#ffc48a', emissive: '#ff8f44', roughness: 1 }} />
            {Array.from({ length: 8 }).map((_, i) => {
              const a = orbitAngle + (i / 8) * Math.PI * 2;
              const r = 2 + (i % 3) * 0.6;
              return (
                <Mesh key={'gs_' + i}
                  geometry={{ kind: 'sphere', radius: 0.18, widthSegments: 10, heightSegments: 8 }}
                  material={{ color: i % 2 === 0 ? '#89b4fa' : '#cba6f7', metalness: 0.1, roughness: 0.6 }}
                  position={[Math.cos(a) * r, Math.sin(a * 0.5) * 0.3, Math.sin(a) * r]} />
              );
            })}
            {orbit ? <OrbitControls /> : null}
          </Scene3D>
        </Col>
        <Col style={{ flexGrow: 1, flexBasis: 260, minHeight: 220, gap: 4 }}>
          <Text fontSize={10} color={COLORS.textDim}>planet atmosphere</Text>
          <Scene3D style={{ flexGrow: 1 }} backgroundColor="#040611" wireframeAll={wireframe}>
            <Camera kind={cameraKind} position={[0, 0, 4]} target={[0, 0, 0]} fov={Math.PI / 3.5} orthoSize={3} />
            <AmbientLight color="#0c1530" intensity={0.25} />
            <DirectionalLight direction={[lightX, lightY, 0.4]} color="#e6f0ff" intensity={1.2} />
            <Mesh geometry={{ kind: 'sphere', radius: 1.4, widthSegments: 28, heightSegments: 18 }}
              material={{ color: '#3a6ba8', roughness: 0.7 }}
              rotation={[0, spin * 0.3, 0]} />
            <Mesh geometry={{ kind: 'sphere', radius: 1.55, widthSegments: 24, heightSegments: 16 }}
              material={{ color: '#5aa2ff', emissive: '#2c4770', opacity: 0.22 }}
              wireframe={true} />
            {orbit ? <OrbitControls /> : null}
          </Scene3D>
        </Col>
      </Row>
    </Col>
  );
}

function tinyBtnStyle(tone: string) {
  return {
    paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
    borderRadius: TOKENS.radiusPill, borderWidth: 1,
    borderColor: tone, backgroundColor: COLORS.panelAlt,
  };
}

function StepperSmall(props: { value: number; onChange: (v: number) => void }) {
  return (
    <Row style={{ alignItems: 'center', gap: 3 }}>
      <Pressable onPress={() => props.onChange(Math.max(-2, +(props.value - 0.1).toFixed(2)))}
        style={{ width: 18, height: 18, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>−</Text>
      </Pressable>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace', minWidth: 28, textAlign: 'center' as any }}>
        {props.value.toFixed(1)}
      </Text>
      <Pressable onPress={() => props.onChange(Math.min(2, +(props.value + 0.1).toFixed(2)))}
        style={{ width: 18, height: 18, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+</Text>
      </Pressable>
    </Row>
  );
}
