// Types
export type { Vec2, Vec3, Vec4, Mat4, Quat, BBox2, BBox3 } from './types';
export type { NoiseConfig, NoiseFieldConfig, BezierConfig, MathPoolOp } from './types';

// Vector math (pure TS — no bridge)
export { Vec2 } from './vec2';
export { Vec3 } from './vec3';
export { Vec4 } from './vec4';

// Matrix math (pure TS)
export { Mat4 } from './mat4';

// Quaternion math (pure TS)
export { Quat } from './quat';

// Geometry (pure TS)
export { BBox2, BBox3, distancePointToSegment, distancePointToRect } from './geometry';
export { circleContainsPoint, circleIntersectsRect, lineIntersection } from './geometry';

// Interpolation (pure TS)
export { lerp, inverseLerp, smoothstep, smootherstep } from './interpolation';
export { remap, clamp, wrap, damp, step, pingPong } from './interpolation';
export { moveTowards, moveTowardsAngle, smoothDamp } from './interpolation';

// React hooks
export { useVec2, useVec3, useVec4, useMat4, useTransform } from './hooks';
export { useLerp, useSmoothstep, useDistance, useBBox, useIntersection } from './hooks';
export { useNoise, useNoiseField, useFFT, useBezier, useMathPool } from './hooks';
