// <PhysicsDebugLayer /> — theme-aware wireframe overlay showing each
// body's AABB (or circle bounds) plus its velocity as a short arrow.
// Must be mounted *inside* <PhysicsWorld>; it re-renders each frame
// via the subscription bus.

const React: any = require('react');
const { useEffect, useState } = React;

import { Box } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { usePhysicsCtx } from './PhysicsContext';

export interface PhysicsDebugLayerProps {
  visible?: boolean;
  bodyStroke?: string;
  jointStroke?: string;
  velocityStroke?: string;
}

export function PhysicsDebugLayer(props: PhysicsDebugLayerProps) {
  const { world, subscribe } = usePhysicsCtx();
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((n) => n + 1)), [subscribe]);
  if (props.visible === false) return null;

  const bodyStroke = props.bodyStroke || COLORS.green || '#4caf50';
  const jointStroke = props.jointStroke || COLORS.purple || '#ab47bc';
  const velStroke = props.velocityStroke || COLORS.yellow || '#ffd54f';

  const children: any[] = [];
  // Bodies — circle or axis-aligned rectangle outline.
  for (const b of world.bodies.values()) {
    const s = b.shape;
    if (s.kind === 'circle') {
      const r = s.radius || 0;
      children.push(React.createElement(Box, {
        key: 'b-' + b.id,
        style: {
          position: 'absolute',
          left: b.position.x - r,
          top: b.position.y - r,
          width: r * 2,
          height: r * 2,
          borderWidth: 1,
          borderColor: bodyStroke,
          borderRadius: r,
        },
      }));
    } else {
      const w = s.width || (b.aabbMax.x - b.aabbMin.x);
      const h = s.height || (b.aabbMax.y - b.aabbMin.y);
      children.push(React.createElement(Box, {
        key: 'b-' + b.id,
        style: {
          position: 'absolute',
          left: b.position.x - w / 2,
          top: b.position.y - h / 2,
          width: w,
          height: h,
          borderWidth: 1,
          borderColor: bodyStroke,
        },
      }));
    }
    // Velocity arrow — a 1px-high rectangle oriented from position in direction of v.
    const vmag = Math.hypot(b.velocity.x, b.velocity.y);
    if (vmag > 1) {
      const len = Math.min(40, vmag * 0.05);
      children.push(React.createElement(Box, {
        key: 'v-' + b.id,
        style: {
          position: 'absolute',
          left: b.position.x,
          top: b.position.y - 1,
          width: len,
          height: 2,
          backgroundColor: velStroke,
          transform: [{ rotate: Math.atan2(b.velocity.y, b.velocity.x) + 'rad' }],
          transformOrigin: '0 1px',
        },
      }));
    }
  }
  // Joints — thin line between anchors.
  for (const j of world.joints.values()) {
    const a = world.bodies.get(j.bodyA); const bb = world.bodies.get(j.bodyB);
    if (!a || !bb) continue;
    const ax = a.position.x + j.anchorA.x; const ay = a.position.y + j.anchorA.y;
    const bx = bb.position.x + j.anchorB.x; const by = bb.position.y + j.anchorB.y;
    const dx = bx - ax; const dy = by - ay;
    const len = Math.hypot(dx, dy);
    children.push(React.createElement(Box, {
      key: 'j-' + j.id,
      style: {
        position: 'absolute',
        left: ax,
        top: ay - 1,
        width: len,
        height: 2,
        backgroundColor: jointStroke,
        transform: [{ rotate: Math.atan2(dy, dx) + 'rad' }],
        transformOrigin: '0 1px',
        opacity: 0.7,
      },
    }));
  }

  return React.createElement(Box, {
    style: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  }, children);
}
