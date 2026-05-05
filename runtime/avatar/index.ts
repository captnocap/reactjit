// Barrel export for the avatar visual ecosystem.
//
// Carts import via `@reactjit/runtime/avatar`. The path itself is the
// signal that this is a discrete subsystem — separate from primitives,
// separate from Character/voice configuration.

export { Avatar } from './Avatar';
export type { AvatarProps, AvatarPose } from './Avatar';
export type { AvatarData, AvatarPart, AvatarPartKind, AvatarGeometry, Vec3 } from './types';
