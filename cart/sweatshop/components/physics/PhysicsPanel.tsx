// <PhysicsPanel /> — interactive 2D physics workspace. Real bodies,
// real simulation, real boundaries. User adds bodies via "+body",
// drives gravity/timestep live, toggles debug overlay. Resets the
// scene via "clear". No canned demo content — the scene starts empty
// inside its physical arena (floor + walls).

const React: any = require('react');
const { useCallback, useRef, useState } = React;

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { PhysicsWorld } from './PhysicsWorld';
import { RigidBody, PhysicsMotion } from './RigidBody';
import { Collider } from './Collider';
import { PhysicsDebugLayer } from './PhysicsDebugLayer';

const ARENA_W = 640;
const ARENA_H = 360;
const BODY_PALETTE = ['#ef5350', '#4fc3f7', '#66bb6a', '#ffa726', '#ab47bc', '#26c6da'];

interface SceneBody {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
}

export function PhysicsPanel() {
  const [gravityX, setGravityX] = useState(0);
  const [gravityY, setGravityY] = useState(800);
  const [timeStep, setTimeStep] = useState(1 / 60);
  const [debug, setDebug] = useState(true);
  const [bodies, setBodies] = useState<SceneBody[]>([]);
  const counterRef = useRef(0);

  const addBody = useCallback(() => {
    setBodies((prev) => {
      counterRef.current++;
      const n = counterRef.current;
      // Deterministic spread across the top of the arena.
      const col = (n - 1) % 8;
      const row = Math.floor((n - 1) / 8);
      return prev.concat([{
        id: 'body-' + n,
        x: 80 + col * 60,
        y: 30 + (row % 3) * 24,
        r: 12 + (n % 5) * 3,
        color: BODY_PALETTE[(n - 1) % BODY_PALETTE.length],
      }]);
    });
  }, []);
  const clearScene = useCallback(() => { counterRef.current = 0; setBodies([]); }, []);

  return React.createElement(Col, { style: { width: '100%', height: '100%', backgroundColor: COLORS.panelBg } },
    React.createElement(Row, {
      style: { padding: 10, gap: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.borderSoft },
    },
      React.createElement(Text, { fontSize: 12, color: COLORS.textBright, style: { fontWeight: 'bold' } }, 'Physics'),
      React.createElement(Text, { fontSize: 10, color: COLORS.textDim }, bodies.length + ' bodies'),
      React.createElement(Box, { style: { flexGrow: 1 } }),
      NumberKnob({ label: 'gx', value: gravityX, step: 200, set: setGravityX }),
      NumberKnob({ label: 'gy', value: gravityY, step: 200, set: setGravityY }),
      NumberKnob({ label: 'dt', value: Math.round(1 / timeStep), step: 15, set: (hz) => setTimeStep(1 / Math.max(15, hz)) }),
      React.createElement(Pressable, { onPress: () => setDebug(!debug) },
        React.createElement(Tag, { tone: debug ? COLORS.green : COLORS.textDim, label: debug ? 'debug on' : 'debug off' })),
      React.createElement(Pressable, { onPress: addBody },
        React.createElement(Tag, { tone: COLORS.blue, label: '+ body' })),
      React.createElement(Pressable, { onPress: clearScene },
        React.createElement(Tag, { tone: COLORS.orange, label: 'clear' })),
    ),
    React.createElement(Box, { style: { flexGrow: 1, padding: 20, alignItems: 'center', justifyContent: 'center' } },
      React.createElement(Box, {
        style: {
          width: ARENA_W, height: ARENA_H, position: 'relative',
          borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
          overflow: 'hidden',
        },
      },
        React.createElement(PhysicsWorld, { gravity: [gravityX, gravityY], timeStep, debug },
          // Arena scenery — real static containment.
          React.createElement(RigidBody, { id: 'floor', type: 'static', x: ARENA_W / 2, y: ARENA_H - 10,
            shape: { kind: 'rectangle', width: ARENA_W, height: 20, restitution: 0.2 } }),
          React.createElement(RigidBody, { id: 'wall-l', type: 'static', x: 10, y: ARENA_H / 2,
            shape: { kind: 'rectangle', width: 20, height: ARENA_H, restitution: 0.2 } }),
          React.createElement(RigidBody, { id: 'wall-r', type: 'static', x: ARENA_W - 10, y: ARENA_H / 2,
            shape: { kind: 'rectangle', width: 20, height: ARENA_H, restitution: 0.2 } }),
          React.createElement(RigidBody, { id: 'ceiling', type: 'static', x: ARENA_W / 2, y: 10,
            shape: { kind: 'rectangle', width: ARENA_W, height: 20, restitution: 0.2 } }),
          // User-spawned dynamic bodies.
          ...bodies.map((d) =>
            React.createElement(RigidBody, { key: d.id, id: d.id, type: 'dynamic', x: d.x, y: d.y,
              shape: { kind: 'circle', radius: d.r, restitution: 0.3, friction: 0.3 } },
              React.createElement(Collider, { shape: 'circle', radius: d.r, density: 1, friction: 0.3, restitution: 0.3 }),
            ),
          ),
          React.createElement(ArenaVisuals, { bodies }),
          debug ? React.createElement(PhysicsDebugLayer, {}) : null,
        ),
      ),
    ),
  );
}

function ArenaVisuals({ bodies }: { bodies: SceneBody[] }) {
  return React.createElement(Box, { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
    bodies.map((b) => React.createElement(PhysicsMotion, { key: b.id, id: b.id },
      (s: { position: { x: number; y: number } }) =>
        React.createElement(Box, {
          style: {
            position: 'absolute',
            left: s.position.x - b.r,
            top: s.position.y - b.r,
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: b.r,
            backgroundColor: b.color,
          },
        }),
    )),
  );
}

function NumberKnob({ label, value, step, set }: { label: string; value: number; step: number; set: (n: number) => void }) {
  return React.createElement(Row, { style: { gap: 4, alignItems: 'center' } },
    React.createElement(Text, { fontSize: 9, color: COLORS.textMuted }, label),
    React.createElement(Pressable, { onPress: () => set(value - step) },
      React.createElement(Tag, { tone: COLORS.textDim, label: '−' })),
    React.createElement(Text, { fontSize: 10, color: COLORS.text, style: { minWidth: 42, textAlign: 'center' } }, String(value)),
    React.createElement(Pressable, { onPress: () => set(value + step) },
      React.createElement(Tag, { tone: COLORS.textDim, label: '+' })),
  );
}

function Tag({ tone, label }: { tone: string; label: string }) {
  return React.createElement(Box, {
    style: {
      paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
      borderRadius: 6, borderWidth: 1, borderColor: tone,
    },
  }, React.createElement(Text, { fontSize: 10, color: tone, style: { fontWeight: 'bold' } }, label));
}
