// Narrowphase collision math. AABB + circle pairs only for MVP.
// Polygon / chain / edge → TODO(physics-ffi): SAT + manifold in Box2D/Bullet swap.

import type { Body } from './core';

export interface Contact {
  // Normal points from A toward B (separating direction to push B).
  normal: { x: number; y: number };
  penetration: number;
}

export function circleVsCircle(a: Body, b: Body): Contact | null {
  const ra = a.shape.radius || 0; const rb = b.shape.radius || 0;
  const dx = b.position.x - a.position.x; const dy = b.position.y - a.position.y;
  const dist = Math.hypot(dx, dy);
  const sum = ra + rb;
  if (dist >= sum) return null;
  if (dist === 0) return { normal: { x: 1, y: 0 }, penetration: sum };
  return { normal: { x: dx / dist, y: dy / dist }, penetration: sum - dist };
}

export function aabbVsAabb(a: Body, b: Body): Contact | null {
  const ax = a.position.x, ay = a.position.y;
  const bx = b.position.x, by = b.position.y;
  const aHw = (a.shape.width || 40) / 2; const aHh = (a.shape.height || 40) / 2;
  const bHw = (b.shape.width || 40) / 2; const bHh = (b.shape.height || 40) / 2;
  const dx = bx - ax; const dy = by - ay;
  const overlapX = (aHw + bHw) - Math.abs(dx);
  if (overlapX <= 0) return null;
  const overlapY = (aHh + bHh) - Math.abs(dy);
  if (overlapY <= 0) return null;
  if (overlapX < overlapY) {
    return { normal: { x: dx < 0 ? -1 : 1, y: 0 }, penetration: overlapX };
  }
  return { normal: { x: 0, y: dy < 0 ? -1 : 1 }, penetration: overlapY };
}

export function circleVsAabb(a: Body, b: Body): Contact | null {
  // `a` is the circle, `b` is the AABB.
  const ra = a.shape.radius || 0;
  const bHw = (b.shape.width || 40) / 2; const bHh = (b.shape.height || 40) / 2;
  const closestX = Math.max(b.position.x - bHw, Math.min(a.position.x, b.position.x + bHw));
  const closestY = Math.max(b.position.y - bHh, Math.min(a.position.y, b.position.y + bHh));
  const dx = closestX - a.position.x; const dy = closestY - a.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= ra) return null;
  if (dist === 0) {
    // Circle center inside box — push out along shortest exit.
    const exL = a.position.x - (b.position.x - bHw);
    const exR = (b.position.x + bHw) - a.position.x;
    const exU = a.position.y - (b.position.y - bHh);
    const exD = (b.position.y + bHh) - a.position.y;
    const m = Math.min(exL, exR, exU, exD);
    if (m === exL) return { normal: { x: -1, y: 0 }, penetration: m + ra };
    if (m === exR) return { normal: { x: 1, y: 0 }, penetration: m + ra };
    if (m === exU) return { normal: { x: 0, y: -1 }, penetration: m + ra };
    return { normal: { x: 0, y: 1 }, penetration: m + ra };
  }
  // Normal points A→B (circle toward box surface).
  return { normal: { x: dx / dist, y: dy / dist }, penetration: ra - dist };
}
