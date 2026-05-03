// Avatar — types for the visual avatar ecosystem.
//
// This is a *visual entity*, decoupled from Character (the assistant's
// voice configuration). An Avatar can belong to a Character, to the
// User, or be free-floating as a scene prop. Same primitive across all
// three. Carts that need a chunky 3D figure consume <Avatar> directly.
//
// Mirrors the gallery data shape at
// `cart/app/gallery/data/avatar.ts`. Defining the types in
// runtime/ keeps the runtime free of cart-side imports.

export type AvatarPartKind =
  | 'head'
  | 'crown'        // hat / helmet / crown — sits above head
  | 'halo'         // ring above the head (mentor / sage stance)
  | 'torso'
  | 'arm-left'
  | 'arm-right'
  | 'hand-left'
  | 'hand-right'
  | 'waist'        // belt / sash slot
  | 'leg-left'
  | 'leg-right'
  | 'foot-left'
  | 'foot-right'
  | 'prop'         // held item billboard or mesh
  | 'accessory';   // free slot for one-off cosmetics

export type AvatarGeometry = 'box' | 'sphere' | 'plane' | 'torus' | 'cylinder' | 'cone';

export type Vec3 = [number, number, number];

export interface AvatarPart {
  /** Stable identifier — e.g. "head", "left-hand". Renderer uses as React key. */
  id: string;
  kind: AvatarPartKind;
  geometry: AvatarGeometry;
  /** Hex color string (e.g. "#4aa3ff"). */
  color: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  /** Sphere / torus / cylinder / cone radius. */
  radius?: number;
  /** Torus tube radius. */
  tubeRadius?: number;
  /** Box / plane / cylinder / cone size — [width, height, depth]. */
  size?: Vec3;
  /** Default true. Set false to mute a part without removing it from the list. */
  visible?: boolean;
}

export interface AvatarData {
  /** Unique id within whatever store owns this avatar. */
  id: string;
  /** Display name. */
  name: string;
  /** Optional one-line description. */
  description?: string;
  /**
   * Who owns this avatar — drives where the row is filed and what
   * cross-references it carries. 'user' = the user's own avatar;
   * 'character' = bound to an AI character; 'prop' = a free scene
   * element with no owner.
   */
  ownerKind: 'user' | 'character' | 'prop';
  /** FK into the relevant store keyed by ownerKind. Empty string when ownerKind = 'prop'. */
  ownerId: string;
  /** Ordered list of parts. Render order is list order; later parts paint over earlier. */
  parts: AvatarPart[];
}
