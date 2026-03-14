/**
 * Physics — Package documentation page (Layout2 zigzag narrative).
 *
 * Live demos for PhysicsWorld, RigidBody, Collider, joints, sensors,
 * and force hooks. Box2D via love.physics at LuaJIT speed.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useRef } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  PhysicsWorld,
  RigidBody,
  Collider,
  MouseJoint,
  DistanceJoint,
  Sensor,
} from '../../../packages/physics/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#ef5350',
  accentDim: 'rgba(239, 83, 80, 0.12)',
  callout: 'rgba(239, 83, 80, 0.06)',
  calloutBorder: 'rgba(239, 83, 80, 0.30)',
  world: '#4fc3f7',
  body: '#66bb6a',
  collider: '#ffa726',
  joint: '#ab47bc',
  sensor: '#26c6da',
  force: '#ec4899',
  mouse: '#8b5cf6',
};

// ── Static code blocks (hoisted \u2014 never recreated) ──────

const INSTALL_CODE = `import { PhysicsWorld, RigidBody, Collider } from '@reactjit/physics'
import { Sensor, MouseJoint } from '@reactjit/physics'
import { RevoluteJoint, DistanceJoint, RopeJoint } from '@reactjit/physics'
import { useForce, useImpulse, useTorque } from '@reactjit/physics'`;
import { PageColumn } from './_shared/StoryScaffold'

const WORLD_CODE = `<PhysicsWorld gravity={[0, 980]} debug>
  {/* Everything inside is simulated */}
  <RigidBody type="static" x={400} y={500}>
    <Collider shape="rectangle" width={800} height={20} />
    <Box style={{ width: 800, height: 20, bg: 'green' }} />
  </RigidBody>
</PhysicsWorld>`;

const BODY_CODE = `<RigidBody type="dynamic" bullet fixedRotation={false}>
  <Collider shape="circle" radius={20}
    density={1} friction={0.3} restitution={0.5} />
  <Box style={{ width: 40, height: 40, borderRadius: 20 }} />
</RigidBody>

// type: "dynamic" | "static" | "kinematic"
// bullet: CCD for fast-moving bodies
// gravityScale: per-body gravity multiplier`;

const COLLIDER_CODE = `// Rectangle (auto-sizes from sibling visual node)
<Collider shape="rectangle" width={40} height={40} />

// Circle
<Collider shape="circle" radius={20} />

// Custom polygon (convex, max 8 vertices)
<Collider shape="polygon" points={[0,-20, 20,20, -20,20]} />

// Edge (infinite thin line)
<Collider shape="edge" points={[0,0, 100,0]} />

// Chain (series of edges)
<Collider shape="chain" points={[0,0, 50,30, 100,0]} loop />`;

const JOINT_CODE = `// Hinge
<RevoluteJoint bodyA={idA} bodyB={idB}
  anchorX={200} anchorY={300}
  enableMotor motorSpeed={2} maxTorque={100} />

// Spring
<DistanceJoint bodyA={idA} bodyB={idB}
  stiffness={4} damping={0.5} />

// Glue (breakable with stiffness > 0)
<WeldJoint bodyA={idA} bodyB={idB} />

// Mouse drag (add inside PhysicsWorld)
<MouseJoint stiffness={8} damping={0.7} />`;

const SENSOR_CODE = `// Trigger zone \u2014 detects overlap, no physical response
<Sensor shape="circle" radius={60}
  onCollide={(e) => console.log('entered', e.bodyB)}
  onCollideEnd={(e) => console.log('exited', e.bodyB)}
/>`;

const HOOKS_CODE = `// Continuous force (thrust, wind)
useForce(bodyRef, [0, -500])

// One-shot kick (jump, explosion)
useImpulse(bodyRef, [200, -400])

// Spin
useTorque(bodyRef, 100)`;

// ── Body colors for spawned objects ─────────────────────

const BODY_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e67e22'];

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color, fontSize: 8, fontFamily: 'monospace' }}>{text}</Text>
    </Box>
  );
}

function Label({ label, value, color }: { label: string; value: string; color?: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG8>
      <S.StoryCap>{label}</S.StoryCap>
      <Text style={{ color: color || c.text, fontSize: 9, fontFamily: 'monospace' }}>{value}</Text>
    </S.RowCenterG8>
  );
}

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Box style={{ backgroundColor: color + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}>
        <Text style={{ color, fontSize: 10 }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

// ── Band layout helpers ─────────────────────────────────

const BAND_STYLE = {
  flexDirection: 'row' as const,
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const HALF = { flexGrow: 1, flexBasis: 0, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const };

// ── Falling Bodies Demo ─────────────────────────────────

interface SpawnedBody {
  id: number;
  x: number;
  y: number;
  shape: 'rectangle' | 'circle';
  color: string;
  size: number;
}

let _spawnId = 0;

function FallingBodiesDemo() {
  const c = useThemeColors();
  const [bodies, setBodies] = useState<SpawnedBody[]>([]);
  const [debug, setDebug] = useState(true);
  const shapeRef = useRef<'rectangle' | 'circle'>('rectangle');

  const spawn = () => {
    const id = ++_spawnId;
    const shape = shapeRef.current;
    const size = 14 + Math.floor(Math.random() * 14);
    const color = BODY_COLORS[id % BODY_COLORS.length];
    const x = 40 + Math.random() * 180;
    const y = 15 + Math.random() * 25;
    setBodies(prev => [...prev, { id, x, y, shape, color, size }]);
  };

  const clear = () => {
    setBodies([]);
    _spawnId = 0;
  };

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="PhysicsWorld" color={C.world} />
        <Tag text="RigidBody" color={C.body} />
        <Tag text="Collider" color={C.collider} />
        <Tag text="MouseJoint" color={C.mouse} />
      </S.RowG6>

      {/* Live physics scene */}
      <PhysicsWorld gravity={[0, 680]} debug={debug} style={{ width: 260, height: 200, backgroundColor: '#330000', borderRadius: 6, overflow: 'hidden' }}>
        <MouseJoint stiffness={8} damping={0.7} />

        {/* Ground */}
        <RigidBody type="static" x={130} y={190}>
          <Collider shape="rectangle" width={240} height={14} friction={0.6} />
          <Box style={{ width: 240, height: 14, backgroundColor: '#4a7c59', borderRadius: 3 }} />
        </RigidBody>

        {/* Left wall */}
        <RigidBody type="static" x={6} y={100}>
          <Collider shape="rectangle" width={8} height={200} />
          <Box style={{ width: 8, height: 200, backgroundColor: '#7f8c8d' }} />
        </RigidBody>

        {/* Right wall */}
        <RigidBody type="static" x={254} y={100}>
          <Collider shape="rectangle" width={8} height={200} />
          <Box style={{ width: 8, height: 200, backgroundColor: '#7f8c8d' }} />
        </RigidBody>

        {/* Ramp */}
        <RigidBody type="static" x={100} y={140} angle={-12}>
          <Collider shape="rectangle" width={90} height={6} friction={0.3} />
          <Box style={{ width: 90, height: 6, backgroundColor: '#7f8c8d', borderRadius: 2 }} />
        </RigidBody>

        {/* Platform */}
        <RigidBody type="static" x={190} y={110}>
          <Collider shape="rectangle" width={60} height={6} friction={0.5} />
          <Box style={{ width: 60, height: 6, backgroundColor: '#7f8c8d', borderRadius: 2 }} />
        </RigidBody>

        {/* Initial stack */}
        {[0, 1, 2].map(i => (
          <RigidBody key={`s-${i}`} type="dynamic" x={130} y={165 - i * 24}>
            <Collider shape="rectangle" width={20} height={20} density={1} restitution={0.15} />
            <Box style={{
              width: 20, height: 20,
              backgroundColor: BODY_COLORS[i],
              borderRadius: 3,
            }} />
          </RigidBody>
        ))}

        {/* Spawned bodies */}
        {bodies.map(b => (
          <RigidBody key={b.id} type="dynamic" x={b.x} y={b.y}>
            <Collider
              shape={b.shape}
              width={b.shape === 'rectangle' ? b.size : undefined}
              height={b.shape === 'rectangle' ? b.size : undefined}
              radius={b.shape === 'circle' ? b.size / 2 : undefined}
              density={1}
              restitution={0.3}
              friction={0.4}
            />
            <Box style={{
              width: b.size, height: b.size,
              backgroundColor: b.color,
              borderRadius: b.shape === 'circle' ? b.size / 2 : 3,
            }} />
          </RigidBody>
        ))}
      </PhysicsWorld>

      <Label label="bodies" value={String(3 + bodies.length)} color={C.body} />
      <S.RowCenterG6>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: debug ? C.collider : c.textDim }} />
        <Text style={{ fontSize: 9, color: debug ? C.collider : c.textDim }}>
          {debug ? 'Debug wireframes on' : 'Debug wireframes off'}
        </Text>
      </S.RowCenterG6>

      <S.RowG8 style={{ flexWrap: 'wrap' }}>
        <ActionBtn label="+ Box" color={C.collider} onPress={() => { shapeRef.current = 'rectangle'; spawn(); }} />
        <ActionBtn label="+ Ball" color={C.world} onPress={() => { shapeRef.current = 'circle'; spawn(); }} />
        <ActionBtn label="Debug" color={C.accent} onPress={() => setDebug(d => !d)} />
        <ActionBtn label="Clear" color={c.textDim} onPress={clear} />
      </S.RowG8>
    </S.CenterW100>
  );
}

// ── Chain / Joint Demo ──────────────────────────────────

function ChainDemo() {
  const c = useThemeColors();
  const LINKS = 5;
  const LINK_GAP = 24;
  const START_X = 130;
  const START_Y = 30;

  const linkIds = Array.from({ length: LINKS }, (_, i) => `chain-link-${i}`);

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="DistanceJoint" color={C.joint} />
        <Tag text="chain" color={C.joint} />
      </S.RowG6>

      <PhysicsWorld gravity={[0, 400]} debug style={{ width: 260, height: 180, backgroundColor: '#330000', borderRadius: 6, overflow: 'hidden' }}>
        <MouseJoint stiffness={10} damping={0.8} />

        {/* Anchor (static) */}
        <RigidBody key="chain-anchor" bodyId="chain-anchor" type="static" x={START_X} y={START_Y}>
          <Collider shape="circle" radius={6} />
          <Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#7f8c8d' }} />
        </RigidBody>

        {/* Chain links */}
        {linkIds.map((id, i) => (
          <RigidBody key={id} bodyId={id} type="dynamic" x={START_X + (i + 1) * LINK_GAP} y={START_Y} linearDamping={0.3}>
            <Collider shape="circle" radius={8} density={2} restitution={0.1} />
            <Box style={{
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: BODY_COLORS[i % BODY_COLORS.length],
            }} />
          </RigidBody>
        ))}

        {/* Distance joints connecting each link to the previous */}
        {linkIds.map((id, i) => (
          <DistanceJoint
            key={`dj-${i}`}
            bodyA={i === 0 ? 'chain-anchor' : linkIds[i - 1]}
            bodyB={id}
            length={LINK_GAP}
            stiffness={6}
            damping={0.5}
          />
        ))}
      </PhysicsWorld>

      <Label label="links" value={String(LINKS)} color={C.joint} />
      <Label label="joint type" value="DistanceJoint" color={C.joint} />
      <Label label="stiffness" value="6 Hz" />
      <Label label="damping" value="0.5" />
      <S.StoryCap>
        {'Drag any link with the mouse to swing the chain'}
      </S.StoryCap>
    </S.CenterW100>
  );
}

// ── Sensor Demo ─────────────────────────────────────────

function SensorDemo() {
  const c = useThemeColors();
  const [entered, setEntered] = useState(false);
  const [hitCount, setHitCount] = useState(0);

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <Tag text="Sensor" color={C.sensor} />

      <PhysicsWorld gravity={[0, 300]} debug style={{ width: 260, height: 160, backgroundColor: '#330000', borderRadius: 6, overflow: 'hidden' }}>
        <MouseJoint stiffness={8} damping={0.7} />

        {/* Ground */}
        <RigidBody type="static" x={130} y={154}>
          <Collider shape="rectangle" width={240} height={8} />
          <Box style={{ width: 240, height: 8, backgroundColor: '#7f8c8d' }} />
        </RigidBody>

        {/* Ceiling */}
        <RigidBody type="static" x={130} y={6}>
          <Collider shape="rectangle" width={240} height={8} />
          <Box style={{ width: 240, height: 8, backgroundColor: '#7f8c8d' }} />
        </RigidBody>

        {/* Left wall */}
        <RigidBody type="static" x={6} y={80}>
          <Collider shape="rectangle" width={8} height={160} />
          <Box style={{ width: 8, height: 160, backgroundColor: '#7f8c8d' }} />
        </RigidBody>

        {/* Right wall */}
        <RigidBody type="static" x={254} y={80}>
          <Collider shape="rectangle" width={8} height={160} />
          <Box style={{ width: 8, height: 160, backgroundColor: '#7f8c8d' }} />
        </RigidBody>

        {/* Sensor zone (no collision response) */}
        <RigidBody type="static" x={130} y={95}>
          <Sensor
            shape="rectangle"
            width={80}
            height={70}
            onCollide={() => { setEntered(true); setHitCount(n => n + 1); }}
            onCollideEnd={() => setEntered(false)}
          />
          <Box style={{
            width: 80, height: 70,
            backgroundColor: entered ? 'rgba(38, 198, 218, 0.15)' : 'rgba(38, 198, 218, 0.05)',
            borderWidth: 1,
            borderColor: entered ? C.sensor : C.sensor + '44',
            borderRadius: 4,
          }} />
        </RigidBody>

        {/* Falling ball */}
        <RigidBody type="dynamic" x={130} y={15}>
          <Collider shape="circle" radius={10} restitution={0.6} />
          <Box style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.collider }} />
        </RigidBody>

        {/* Second ball, offset */}
        <RigidBody type="dynamic" x={150} y={8}>
          <Collider shape="circle" radius={8} restitution={0.5} />
          <Box style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.accent }} />
        </RigidBody>
      </PhysicsWorld>

      <S.RowCenterG6>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: entered ? C.sensor : c.textDim }} />
        <Text style={{ fontSize: 9, color: entered ? C.sensor : c.textDim }}>
          {entered ? 'Body inside sensor zone' : 'Sensor zone empty'}
        </Text>
      </S.RowCenterG6>
      <Label label="trigger count" value={String(hitCount)} color={C.sensor} />
      <S.StoryCap>
        {'Sensor detects overlap without pushing bodies away'}
      </S.StoryCap>
    </S.CenterW100>
  );
}

// ── Collision Shapes Catalog ────────────────────────────

function ShapesCatalog() {
  const c = useThemeColors();
  const shapes = [
    { label: 'rectangle', desc: 'Axis-aligned box. Auto-sizes from sibling visual node if width/height omitted.', color: C.collider },
    { label: 'circle', desc: 'Perfect circle. Set radius prop. Good for balls, wheels, character capsules.', color: C.collider },
    { label: 'polygon', desc: 'Convex polygon (max 8 vertices). Pass flat points array [x1,y1,x2,y2,...].', color: C.collider },
    { label: 'edge', desc: 'Infinite thin line segment. Use for one-sided walls and boundaries.', color: C.collider },
    { label: 'chain', desc: 'Series of connected edges. Use loop prop for closed shapes. Good for terrain.', color: C.collider },
  ];
  return (
    <>
      {shapes.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <S.StoryBody style={{ fontWeight: 'normal', width: 80 }}>{f.label}</S.StoryBody>
          <S.SecondaryBody>{f.desc}</S.SecondaryBody>
        </S.RowCenterG8>
      ))}
    </>
  );
}

// ── Feature Catalog ─────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  const features = [
    { label: 'PhysicsWorld', desc: 'Gravity, timestep, debug wireframes. Container for all bodies.', color: C.world },
    { label: 'RigidBody', desc: 'Dynamic, static, or kinematic. Damping, bullet CCD, gravity scale.', color: C.body },
    { label: 'Collider', desc: 'Rectangle, circle, polygon, edge, chain. Density, friction, restitution.', color: C.collider },
    { label: 'Sensor', desc: 'Trigger zone \u2014 detects overlap without physical response.', color: C.sensor },
    { label: 'RevoluteJoint', desc: 'Hinge. Optional motor + angle limits.', color: C.joint },
    { label: 'DistanceJoint', desc: 'Spring/bungee. Stiffness + damping.', color: C.joint },
    { label: 'PrismaticJoint', desc: 'Slider/piston along an axis. Motor + translation limits.', color: C.joint },
    { label: 'WeldJoint', desc: 'Glue two bodies. Breakable with stiffness > 0.', color: C.joint },
    { label: 'RopeJoint', desc: 'Maximum distance constraint.', color: C.joint },
    { label: 'MouseJoint', desc: 'Click-drag interaction. Drop inside PhysicsWorld.', color: C.mouse },
    { label: 'useForce', desc: 'Continuous force per frame (thrust, wind).', color: C.force },
    { label: 'useImpulse', desc: 'One-shot velocity change (jump, explosion).', color: C.force },
    { label: 'useTorque', desc: 'Continuous angular force.', color: C.force },
  ];
  return (
    <>
      {features.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <S.StoryBody style={{ fontWeight: 'normal', width: 120 }}>{f.label}</S.StoryBody>
          <S.SecondaryBody>{f.desc}</S.SecondaryBody>
        </S.RowCenterG8>
      ))}
    </>
  );
}

// ── PhysicsStory ────────────────────────────────────────

export function PhysicsStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="package" tintColor={C.accent} />
        <S.StoryTitle>
          {'Physics'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/physics'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'Box2D at LuaJIT speed'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <S.StoryHeadline>
            {'Declarative 2D physics. React declares the bodies, Lua runs the simulation.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'love.physics wraps Box2D \u2014 a battle-tested rigid body engine used in Angry Birds, Limbo, and Crayon Physics. Every component is a one-liner. PhysicsWorld steps the simulation, RigidBody creates bodies, Collider defines shapes. Position sync happens automatically \u2014 node.computed.x/y are overridden each frame from the Box2D solver.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Install: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Components for the world, bodies, shapes, joints, and sensors. Hooks for applying forces from React. Everything runs in Lua \u2014 React just declares the layout.'}
            </S.StoryBody>
          </Box>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Falling Bodies: demo | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <FallingBodiesDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="zap">{'SIMULATION'}</SectionLabel>
            <S.StoryBody>
              {'Wrap everything in <PhysicsWorld>. Static bodies are immovable (ground, walls, platforms). Dynamic bodies fall with gravity and collide. The debug prop draws green wireframes for all collision shapes. MouseJoint enables click-drag on any dynamic body.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={WORLD_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Bodies: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="code">{'RIGID BODIES'}</SectionLabel>
            <S.StoryBody>
              {'Three body types: dynamic (moves with physics), static (immovable), kinematic (script-driven). Enable bullet for fast-moving objects that might tunnel through thin walls. fixedRotation prevents spinning. gravityScale lets individual bodies float or fall faster.'}
            </S.StoryBody>
          </Box>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={BODY_CODE} />
        </Box>

        <Divider />

        {/* ── Collider shapes: code | text ── */}
        <Box style={BAND_STYLE}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={COLLIDER_CODE} />
          <Box style={HALF}>
            <SectionLabel icon="layers">{'COLLIDER SHAPES'}</SectionLabel>
            <S.StoryBody>
              {'Five shape types. Rectangle auto-sizes from the sibling visual node if you omit width/height. Polygons must be convex with max 8 vertices (Box2D limit). Chains are great for terrain profiles.'}
            </S.StoryBody>
          </Box>
        </Box>

        <Divider />

        {/* ── Callout band ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Physics runs entirely in Lua. React never handles forces, collisions, or position updates \u2014 the capability\u2019s tick function mutates node.computed directly after each Box2D timestep. Zero bridge overhead per frame.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Chain demo: demo | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <ChainDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="link">{'JOINTS'}</SectionLabel>
            <S.StoryBody>
              {'Six joint types connect bodies together. DistanceJoint acts as a spring \u2014 chain N of them for rope. RevoluteJoint makes hinges (doors, ragdoll limbs). WeldJoint glues bodies (set stiffness > 0 for breakable). MouseJoint enables drag interaction. All joints reference bodies by node ID.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={JOINT_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Sensor: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="shield">{'SENSORS'}</SectionLabel>
            <S.StoryBody>
              {'Sensors detect overlap without pushing bodies away. Use them for trigger zones (enter zone \u2192 open door), pickup items (overlap \u2192 collect), or damage areas. Fires onCollide/onCollideEnd events with the other body\u2019s ID.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SENSOR_CODE} />
          </Box>
          <Box style={HALF}>
            <SensorDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Hooks: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="zap">{'FORCE HOOKS'}</SectionLabel>
            <S.StoryBody>
              {'Apply forces from React via RPC. useForce applies continuously (good for thrust, wind). useImpulse fires once (jump, explosion knockback). useTorque spins bodies. All resolve to physics:applyForce / physics:applyImpulse / physics:applyTorque RPCs that mutate the Box2D body directly.'}
            </S.StoryBody>
          </Box>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={HOOKS_CODE} />
        </Box>

        <Divider />

        {/* ── Shape catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 16,
          gap: 8,
        }}>
          <SectionLabel icon="layers">{'COLLISION SHAPES'}</SectionLabel>
          <ShapesCatalog />
        </Box>

        <Divider />

        {/* ── Feature catalog ── */}
        <S.StoryFullBand>
          <SectionLabel icon="terminal">{'API SURFACE'}</SectionLabel>
          <FeatureCatalog />
        </S.StoryFullBand>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="package" />
        <S.StoryBreadcrumbActive>{'Physics'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
