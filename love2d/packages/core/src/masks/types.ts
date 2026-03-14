/**
 * Base props shared by all post-processing mask components.
 */
export interface MaskProps {
  /** Apply as a foreground post-processing mask on the parent element. */
  mask?: boolean;
  /** Animation speed multiplier. Default 1. */
  speed?: number;
  /** Effect intensity. 0-1. Default varies per mask. */
  intensity?: number;
  /** Style props (unused in mask mode — masks fill their parent). */
  style?: Record<string, unknown>;
}
