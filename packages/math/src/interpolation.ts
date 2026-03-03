/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverse linear interpolation — returns t such that lerp(a, b, t) = value */
export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

/** Hermite smoothstep (cubic, C1 continuous) */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Ken Perlin's smootherstep (quintic, C2 continuous) */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Remap a value from one range to another */
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Modular wrap (value wraps around min..max range) */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  return range === 0 ? min : min + ((((value - min) % range) + range) % range);
}

/** Frame-rate independent exponential interpolation (damping) */
export function damp(a: number, b: number, smoothing: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-smoothing * dt));
}

/** Step function — returns 0 if x < edge, 1 otherwise */
export function step(edge: number, x: number): number {
  return x < edge ? 0 : 1;
}

/** Ping-pong — oscillates value between 0 and length */
export function pingPong(value: number, length: number): number {
  const t = wrap(value, 0, length * 2);
  return length - Math.abs(t - length);
}

/** Move towards target at a maximum rate */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/** Attempt to reach target angle, wrapping around 2*PI */
export function moveTowardsAngle(current: number, target: number, maxDelta: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/** Attempt to smoothly damp a value towards target (spring-damper) */
export function smoothDamp(
  current: number,
  target: number,
  velocity: { value: number },
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity,
): number {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * smoothTime;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const adjustedTarget = current - change;
  const temp = (velocity.value + omega * change) * dt;
  velocity.value = (velocity.value - omega * temp) * exp;
  let result = adjustedTarget + (change + temp) * exp;
  if ((target - current > 0) === (result > target)) {
    result = target;
    velocity.value = (result - target) / dt;
  }
  return result;
}
