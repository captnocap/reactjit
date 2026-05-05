// =============================================================================
// Gamepad types — SDL GameController naming
// =============================================================================
// Matches SDL_GameControllerButton / SDL_GameControllerAxis string names so a
// future __gamepad_* host binding can stream state through without rewriting
// either side. Enum-style string unions (not real enums) so they survive the
// bridge as plain strings.
// =============================================================================

/** SDL GameController button names. */
export type ButtonId =
  | 'a' | 'b' | 'x' | 'y'
  | 'back' | 'start' | 'guide'
  | 'leftstick' | 'rightstick'
  | 'leftshoulder' | 'rightshoulder'
  | 'dpup' | 'dpdown' | 'dpleft' | 'dpright';

export const ALL_BUTTONS: ButtonId[] = [
  'a','b','x','y',
  'back','start','guide',
  'leftstick','rightstick',
  'leftshoulder','rightshoulder',
  'dpup','dpdown','dpleft','dpright',
];

export const FACE_BUTTONS:    ButtonId[] = ['a','b','x','y'];
export const DPAD_BUTTONS:    ButtonId[] = ['dpup','dpdown','dpleft','dpright'];
export const SHOULDER_BUTTONS:ButtonId[] = ['leftshoulder','rightshoulder','leftstick','rightstick'];
export const META_BUTTONS:    ButtonId[] = ['back','start','guide'];

/** SDL GameController axis names. triggers are 0..1, sticks are -1..1. */
export type AxisId =
  | 'leftx' | 'lefty'
  | 'rightx' | 'righty'
  | 'triggerleft' | 'triggerright';

export const ALL_AXES: AxisId[] = ['leftx','lefty','rightx','righty','triggerleft','triggerright'];

export interface GamepadState {
  /** SDL joystick instance id — stable across hot-plug of the same controller. */
  id: number;
  /** Human-readable name from SDL_GameControllerName. */
  name: string;
  /** true when button pressed. Missing keys treated as released. */
  buttons: Partial<Record<ButtonId, boolean>>;
  /** axis value at last poll. Missing keys treated as 0. */
  axes: Partial<Record<AxisId, number>>;
  /** Monotonic frame counter — each poll increments. Use to detect "fresh" frames. */
  frame: number;
}

export interface GamepadBridge {
  /** true when __gamepad_* host fns are actually bound by the runtime. */
  bound: boolean;
  /** Short description of what's missing when !bound — surfaced in the banner. */
  gap: string;
}

export interface GamepadEvent {
  type: 'button-down' | 'button-up' | 'axis-change';
  id: number;
  button?: ButtonId;
  axis?: AxisId;
  value?: number;
  /** ms since boot when the event fired. */
  ts: number;
}

export interface HapticSpec {
  /** low-frequency rumble strength, 0..1 */
  low: number;
  /** high-frequency rumble strength, 0..1 */
  high: number;
  /** duration in ms */
  durationMs: number;
}
