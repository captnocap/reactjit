// Pure-TS physics core. No React dependency. Semi-implicit Euler
// integrator, fixed timestep with accumulator, O(n²) pair broadphase.
// Narrowphase handles circle-circle, aabb-aabb, circle-aabb with real
// normals + penetration depth. Joint solver supports distance, rope,
// and weld as position/velocity constraints.

import { circleVsCircle, aabbVsAabb, circleVsAabb, type Contact } from './collision';

export type Vec2 = { x: number; y: number };

export type ShapeKind = 'circle' | 'rectangle';

export interface ShapeSpec {
  kind: ShapeKind;
  radius?: number;        // circle
  width?: number;         // rectangle
  height?: number;        // rectangle
  density?: number;
  friction?: number;
  restitution?: number;
  isSensor?: boolean;
}

export type BodyType = 'dynamic' | 'static' | 'kinematic';

export interface BodyInit {
  id: string;
  type: BodyType;
  position: Vec2;
  angle?: number;
  velocity?: Vec2;
  angularVelocity?: number;
  mass?: number;
  fixedRotation?: boolean;
  gravityScale?: number;
  shape: ShapeSpec;
}

export interface Body {
  id: string;
  type: BodyType;
  position: Vec2;
  prevPosition: Vec2;
  angle: number;
  velocity: Vec2;
  angularVelocity: number;
  mass: number;
  invMass: number;
  momentOfInertia: number;
  invInertia: number;
  fixedRotation: boolean;
  gravityScale: number;
  shape: ShapeSpec;
  forceAccum: Vec2;
  torqueAccum: number;
  // Cached AABB in world space; recomputed each step.
  aabbMin: Vec2;
  aabbMax: Vec2;
}

export type JointKind = 'distance' | 'rope' | 'weld';

export interface Joint {
  id: string;
  kind: JointKind;
  bodyA: string;
  bodyB: string;
  anchorA: Vec2;   // local anchor on A (world = posA + anchorA rotated by angleA; rotation ignored for MVP)
  anchorB: Vec2;
  restLength?: number;
  stiffness?: number;
  damping?: number;
  maxLength?: number;
}

export interface CollisionEvent {
  bodyA: string;
  bodyB: string;
  normal: Vec2;
  penetration: number;
}

export type CollisionListener = (evt: CollisionEvent) => void;

export interface WorldOptions {
  gravity?: Vec2;
  timeStep?: number;       // fixed dt, seconds
  velocityIterations?: number;
  positionIterations?: number;
}

export class PhysicsWorldCore {
  gravity: Vec2;
  timeStep: number;
  velocityIterations: number;
  positionIterations: number;
  bodies: Map<string, Body> = new Map();
  joints: Map<string, Joint> = new Map();
  private accumulator = 0;
  private listeners: CollisionListener[] = [];
  private activeContacts: Map<string, CollisionEvent> = new Map();

  constructor(opts: WorldOptions = {}) {
    this.gravity = opts.gravity || { x: 0, y: 980 };
    this.timeStep = opts.timeStep || 1 / 60;
    this.velocityIterations = opts.velocityIterations || 8;
    this.positionIterations = opts.positionIterations || 3;
  }

  addBody(init: BodyInit): Body {
    const mass = init.type === 'static' ? 0 : (init.mass == null ? 1 : init.mass);
    const invMass = mass > 0 ? 1 / mass : 0;
    // Rough moment of inertia — good enough for semi-implicit Euler.
    const r = init.shape.radius || Math.max(init.shape.width || 40, init.shape.height || 40) / 2;
    const I = mass > 0 ? 0.5 * mass * r * r : 0;
    const body: Body = {
      id: init.id,
      type: init.type,
      position: { x: init.position.x, y: init.position.y },
      prevPosition: { x: init.position.x, y: init.position.y },
      angle: init.angle || 0,
      velocity: init.velocity ? { ...init.velocity } : { x: 0, y: 0 },
      angularVelocity: init.angularVelocity || 0,
      mass, invMass,
      momentOfInertia: I,
      invInertia: I > 0 ? 1 / I : 0,
      fixedRotation: !!init.fixedRotation,
      gravityScale: init.gravityScale == null ? 1 : init.gravityScale,
      shape: init.shape,
      forceAccum: { x: 0, y: 0 },
      torqueAccum: 0,
      aabbMin: { x: 0, y: 0 },
      aabbMax: { x: 0, y: 0 },
    };
    this.updateAabb(body);
    this.bodies.set(init.id, body);
    return body;
  }

  removeBody(id: string) {
    this.bodies.delete(id);
    for (const [jid, j] of this.joints) {
      if (j.bodyA === id || j.bodyB === id) this.joints.delete(jid);
    }
  }

  addJoint(j: Joint) { this.joints.set(j.id, j); }
  removeJoint(id: string) { this.joints.delete(id); }

  applyForce(id: string, f: Vec2) {
    const b = this.bodies.get(id); if (!b || b.type !== 'dynamic') return;
    b.forceAccum.x += f.x; b.forceAccum.y += f.y;
  }
  applyImpulse(id: string, j: Vec2) {
    const b = this.bodies.get(id); if (!b || b.type !== 'dynamic') return;
    b.velocity.x += j.x * b.invMass; b.velocity.y += j.y * b.invMass;
  }
  applyTorque(id: string, t: number) {
    const b = this.bodies.get(id); if (!b || b.type !== 'dynamic' || b.fixedRotation) return;
    b.torqueAccum += t;
  }

  onCollision(fn: CollisionListener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  step(frameDt: number) {
    // Cap catch-up to 4 sub-steps to avoid spiral-of-death on lag.
    this.accumulator = Math.min(this.accumulator + frameDt, this.timeStep * 4);
    while (this.accumulator >= this.timeStep) {
      this.stepOnce(this.timeStep);
      this.accumulator -= this.timeStep;
    }
  }

  private stepOnce(dt: number) {
    // Integrate velocities from forces + gravity.
    for (const b of this.bodies.values()) {
      if (b.type !== 'dynamic') { b.forceAccum.x = 0; b.forceAccum.y = 0; b.torqueAccum = 0; continue; }
      b.velocity.x += (b.forceAccum.x * b.invMass + this.gravity.x * b.gravityScale) * dt;
      b.velocity.y += (b.forceAccum.y * b.invMass + this.gravity.y * b.gravityScale) * dt;
      if (!b.fixedRotation) b.angularVelocity += b.torqueAccum * b.invInertia * dt;
      b.forceAccum.x = 0; b.forceAccum.y = 0; b.torqueAccum = 0;
    }
    // Integrate positions.
    for (const b of this.bodies.values()) {
      if (b.type === 'static') continue;
      b.prevPosition.x = b.position.x; b.prevPosition.y = b.position.y;
      b.position.x += b.velocity.x * dt;
      b.position.y += b.velocity.y * dt;
      if (!b.fixedRotation) b.angle += b.angularVelocity * dt;
      this.updateAabb(b);
    }
    // Solve joints (position + velocity correction).
    for (let i = 0; i < this.positionIterations; i++) {
      for (const j of this.joints.values()) this.solveJoint(j);
    }
    // Narrowphase + resolution.
    this.resolveContacts();
  }

  private updateAabb(b: Body) {
    const s = b.shape;
    if (s.kind === 'circle') {
      const r = s.radius || 0;
      b.aabbMin.x = b.position.x - r; b.aabbMin.y = b.position.y - r;
      b.aabbMax.x = b.position.x + r; b.aabbMax.y = b.position.y + r;
    } else {
      const hw = (s.width || 40) / 2; const hh = (s.height || 40) / 2;
      b.aabbMin.x = b.position.x - hw; b.aabbMin.y = b.position.y - hh;
      b.aabbMax.x = b.position.x + hw; b.aabbMax.y = b.position.y + hh;
    }
  }

  private resolveContacts() {
    const arr = Array.from(this.bodies.values());
    const nextContacts = new Map<string, CollisionEvent>();
    for (let i = 0; i < arr.length; i++) {
      for (let k = i + 1; k < arr.length; k++) {
        const a = arr[i], c = arr[k];
        if (a.type !== 'dynamic' && c.type !== 'dynamic') continue;
        if (!aabbsOverlap(a, c)) continue;
        const contact = narrowphase(a, c);
        if (!contact) continue;
        const key = a.id < c.id ? `${a.id}|${c.id}` : `${c.id}|${a.id}`;
        const evt: CollisionEvent = { bodyA: a.id, bodyB: c.id, normal: contact.normal, penetration: contact.penetration };
        nextContacts.set(key, evt);
        if (!a.shape.isSensor && !c.shape.isSensor) resolveContact(a, c, contact);
      }
    }
    // Fire listeners for new contacts (onCollide). Exits fire for contacts that left.
    for (const [k, evt] of nextContacts) {
      if (!this.activeContacts.has(k)) for (const l of this.listeners) l(evt);
    }
    this.activeContacts = nextContacts;
  }

  private solveJoint(j: Joint) {
    const a = this.bodies.get(j.bodyA); const b = this.bodies.get(j.bodyB);
    if (!a || !b) return;
    const ax = a.position.x + j.anchorA.x; const ay = a.position.y + j.anchorA.y;
    const bx = b.position.x + j.anchorB.x; const by = b.position.y + j.anchorB.y;
    const dx = bx - ax; const dy = by - ay;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const rest = j.restLength != null ? j.restLength : 0;
    let diff = 0;
    if (j.kind === 'rope') diff = Math.max(0, dist - (j.maxLength || rest));
    else if (j.kind === 'weld') diff = dist;                          // pull anchor points to coincidence
    else diff = dist - rest;                                          // distance (spring)
    if (diff === 0) return;
    const invSum = a.invMass + b.invMass; if (invSum === 0) return;
    const stiffness = j.stiffness == null ? 1 : j.stiffness;
    const nx = dx / dist; const ny = dy / dist;
    const correction = (diff * stiffness) / invSum;
    if (a.type === 'dynamic') { a.position.x += nx * correction * a.invMass; a.position.y += ny * correction * a.invMass; this.updateAabb(a); }
    if (b.type === 'dynamic') { b.position.x -= nx * correction * b.invMass; b.position.y -= ny * correction * b.invMass; this.updateAabb(b); }
    const damping = j.damping == null ? 0 : j.damping;
    if (damping > 0) {
      const relVx = b.velocity.x - a.velocity.x; const relVy = b.velocity.y - a.velocity.y;
      const vn = relVx * nx + relVy * ny;
      const impulse = (vn * damping) / invSum;
      if (a.type === 'dynamic') { a.velocity.x += nx * impulse * a.invMass; a.velocity.y += ny * impulse * a.invMass; }
      if (b.type === 'dynamic') { b.velocity.x -= nx * impulse * b.invMass; b.velocity.y -= ny * impulse * b.invMass; }
    }
  }
}

function aabbsOverlap(a: Body, b: Body): boolean {
  return !(a.aabbMax.x < b.aabbMin.x || a.aabbMin.x > b.aabbMax.x || a.aabbMax.y < b.aabbMin.y || a.aabbMin.y > b.aabbMax.y);
}

function narrowphase(a: Body, b: Body): Contact | null {
  const as = a.shape.kind === 'circle' ? 'circle' : 'box';
  const bs = b.shape.kind === 'circle' ? 'circle' : 'box';
  if (as === 'circle' && bs === 'circle') return circleVsCircle(a, b);
  if (as === 'box' && bs === 'box') return aabbVsAabb(a, b);
  if (as === 'circle' && bs === 'box') return circleVsAabb(a, b);
  const c = circleVsAabb(b, a);
  if (!c) return null;
  return { normal: { x: -c.normal.x, y: -c.normal.y }, penetration: c.penetration };
}

function resolveContact(a: Body, b: Body, c: Contact) {
  const invSum = a.invMass + b.invMass; if (invSum === 0) return;
  // Position correction (Baumgarte-like).
  const slop = 0.01; const percent = 0.8;
  const mag = Math.max(c.penetration - slop, 0) / invSum * percent;
  a.position.x -= c.normal.x * mag * a.invMass;
  a.position.y -= c.normal.y * mag * a.invMass;
  b.position.x += c.normal.x * mag * b.invMass;
  b.position.y += c.normal.y * mag * b.invMass;
  // Velocity response.
  const relVx = b.velocity.x - a.velocity.x; const relVy = b.velocity.y - a.velocity.y;
  const vn = relVx * c.normal.x + relVy * c.normal.y;
  if (vn > 0) return; // separating
  const restitution = Math.min(a.shape.restitution || 0.1, b.shape.restitution || 0.1);
  const jmag = -(1 + restitution) * vn / invSum;
  const jx = c.normal.x * jmag; const jy = c.normal.y * jmag;
  a.velocity.x -= jx * a.invMass; a.velocity.y -= jy * a.invMass;
  b.velocity.x += jx * b.invMass; b.velocity.y += jy * b.invMass;
}
