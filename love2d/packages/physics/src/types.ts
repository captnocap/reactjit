import type { LoveEvent } from '@reactjit/core';
import type { ReactNode } from 'react';

// ── World ────────────────────────────────────────────────────

export interface PhysicsWorldProps {
  gravity?: [number, number];
  debug?: boolean;
  timeScale?: number;
  sleeping?: boolean;
  children?: ReactNode;
  style?: Record<string, unknown>;
}

// ── Body ─────────────────────────────────────────────────────

export type BodyType = 'dynamic' | 'static' | 'kinematic';
export type BodyRef = string | number;

export interface RigidBodyProps {
  id?: string;
  bodyId?: string;
  type?: BodyType;
  x?: number;
  y?: number;
  angle?: number;
  linearDamping?: number;
  angularDamping?: number;
  fixedRotation?: boolean;
  bullet?: boolean;
  gravityScale?: number;
  onCollide?: (event: CollisionEvent) => void;
  onCollideEnd?: (event: CollisionEvent) => void;
  children?: ReactNode;
}

// ── Shapes ───────────────────────────────────────────────────

export type ColliderShape = 'rectangle' | 'circle' | 'polygon' | 'edge' | 'chain';

export interface ColliderProps {
  shape?: ColliderShape;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  loop?: boolean;
  density?: number;
  friction?: number;
  restitution?: number;
  sensor?: boolean;
}

export interface SensorProps {
  shape?: ColliderShape;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  onCollide?: (event: CollisionEvent) => void;
  onCollideEnd?: (event: CollisionEvent) => void;
}

// ── Joints ───────────────────────────────────────────────────

export interface RevoluteJointProps {
  bodyA: BodyRef;
  bodyB: BodyRef;
  anchorX?: number;
  anchorY?: number;
  motorSpeed?: number;
  maxTorque?: number;
  enableMotor?: boolean;
  lowerAngle?: number;
  upperAngle?: number;
  enableLimit?: boolean;
  collideConnected?: boolean;
}

export interface DistanceJointProps {
  bodyA: BodyRef;
  bodyB: BodyRef;
  length?: number;
  stiffness?: number;
  damping?: number;
  collideConnected?: boolean;
}

export interface PrismaticJointProps {
  bodyA: BodyRef;
  bodyB: BodyRef;
  axisX?: number;
  axisY?: number;
  enableLimit?: boolean;
  lowerTranslation?: number;
  upperTranslation?: number;
  enableMotor?: boolean;
  motorSpeed?: number;
  maxForce?: number;
  collideConnected?: boolean;
}

export interface WeldJointProps {
  bodyA: BodyRef;
  bodyB: BodyRef;
  anchorX?: number;
  anchorY?: number;
  stiffness?: number;
  damping?: number;
  collideConnected?: boolean;
}

export interface RopeJointProps {
  bodyA: BodyRef;
  bodyB: BodyRef;
  maxLength?: number;
  collideConnected?: boolean;
}

export interface MouseJointProps {
  stiffness?: number;
  damping?: number;
  maxForce?: number;
}

// ── Events ───────────────────────────────────────────────────

export interface CollisionEvent extends LoveEvent {
  bodyA: BodyRef;
  bodyB: BodyRef;
  normalX?: number;
  normalY?: number;
}
