/** 2D vector as immutable tuple */
export type Vec2 = readonly [number, number];

/** 3D vector as immutable tuple */
export type Vec3 = readonly [number, number, number];

/** 4D vector as immutable tuple (colors, homogeneous coords) */
export type Vec4 = readonly [number, number, number, number];

/** 4x4 matrix as immutable 16-element tuple (column-major) */
export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

/** Quaternion as immutable tuple [x, y, z, w] */
export type Quat = readonly [number, number, number, number];

/** 2D axis-aligned bounding box */
export interface BBox2 {
  readonly min: Vec2;
  readonly max: Vec2;
}

/** 3D axis-aligned bounding box */
export interface BBox3 {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** Noise generation config */
export interface NoiseConfig {
  x: number;
  y: number;
  z?: number;
  seed?: number;
  octaves?: number;
  lacunarity?: number;
  persistence?: number;
}

/** Noise field config — generates a grid of noise values */
export interface NoiseFieldConfig {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  seed?: number;
  octaves?: number;
  lacunarity?: number;
  persistence?: number;
}

/** Bezier curve config */
export interface BezierConfig {
  points: Vec2[];
  segments: number;
}

/** Math pool operation */
export interface MathPoolOp {
  op: string;
  args: Record<string, any>;
}

/** Math pool result */
export interface MathPoolResult<T = any> {
  id: number;
  value: T | undefined;
}
