import { useRef, useCallback, useState } from 'react';
import type { EntityState, PlatformerConfig, AABB } from '../types';

export interface PlatformerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface PlatformerState {
  grounded: boolean;
  wallSliding: boolean;
  facing: 'left' | 'right';
  /** Call each frame with dt and input to update physics */
  update: (dt: number, input: PlatformerInput) => void;
}

export function usePlatformer(
  entity: EntityState,
  solids: AABB[],
  config: PlatformerConfig = {},
): PlatformerState {
  const {
    gravity = 800,
    jumpForce = 350,
    moveSpeed = 150,
    maxFallSpeed = 400,
    coyoteTime = 0.1,
    jumpBuffer = 0.1,
    wallSlide = false,
    wallSlideSpeed = 60,
    wallJump,
  } = config;

  const [, forceRender] = useState(0);
  const groundedRef = useRef(false);
  const wallSlidingRef = useRef(false);
  const facingRef = useRef<'left' | 'right'>('right');
  const coyoteRef = useRef(0);
  const jumpBufferRef = useRef(0);
  const wallDirRef = useRef(0);

  /** Check if entity overlaps any solid at a given offset */
  const checkSolid = useCallback((ex: number, ey: number, ew: number, eh: number) => {
    for (const s of solids) {
      if (ex < s.x + s.width && ex + ew > s.x && ey < s.y + s.height && ey + eh > s.y) {
        return true;
      }
    }
    return false;
  }, [solids]);

  const update = useCallback((dt: number, input: PlatformerInput) => {
    const e = entity;

    // Horizontal movement
    if (input.left) {
      e.vx = -moveSpeed;
      facingRef.current = 'left';
    } else if (input.right) {
      e.vx = moveSpeed;
      facingRef.current = 'right';
    } else {
      e.vx = 0;
    }

    // Apply gravity
    e.vy += gravity * dt;
    if (e.vy > maxFallSpeed) e.vy = maxFallSpeed;

    // Jump buffer
    if (input.jump) {
      jumpBufferRef.current = jumpBuffer;
    } else {
      jumpBufferRef.current -= dt;
    }

    // Ground check
    const wasGrounded = groundedRef.current;
    groundedRef.current = checkSolid(e.x, e.y + 1, e.width, e.height);

    if (groundedRef.current) {
      coyoteRef.current = coyoteTime;
    } else {
      coyoteRef.current -= dt;
    }

    // Jump
    const canJump = coyoteRef.current > 0 && jumpBufferRef.current > 0;
    if (canJump) {
      e.vy = -jumpForce;
      coyoteRef.current = 0;
      jumpBufferRef.current = 0;
    }

    // Wall slide
    wallSlidingRef.current = false;
    if (wallSlide && !groundedRef.current && e.vy > 0) {
      const touchingLeft = checkSolid(e.x - 1, e.y, e.width, e.height);
      const touchingRight = checkSolid(e.x + 1, e.y, e.width, e.height);

      if (touchingLeft && input.left) {
        wallSlidingRef.current = true;
        wallDirRef.current = -1;
        e.vy = Math.min(e.vy, wallSlideSpeed);
      } else if (touchingRight && input.right) {
        wallSlidingRef.current = true;
        wallDirRef.current = 1;
        e.vy = Math.min(e.vy, wallSlideSpeed);
      }

      // Wall jump
      if (wallSlidingRef.current && wallJump && input.jump) {
        e.vx = -wallDirRef.current * wallJump.x;
        e.vy = -wallJump.y;
        wallSlidingRef.current = false;
      }
    }

    // Move X and resolve
    e.x += e.vx * dt;
    for (const s of solids) {
      if (e.x < s.x + s.width && e.x + e.width > s.x && e.y < s.y + s.height && e.y + e.height > s.y) {
        if (e.vx > 0) {
          e.x = s.x - e.width;
        } else if (e.vx < 0) {
          e.x = s.x + s.width;
        }
        e.vx = 0;
      }
    }

    // Move Y and resolve
    e.y += e.vy * dt;
    for (const s of solids) {
      if (e.x < s.x + s.width && e.x + e.width > s.x && e.y < s.y + s.height && e.y + e.height > s.y) {
        if (e.vy > 0) {
          e.y = s.y - e.height;
          groundedRef.current = true;
        } else if (e.vy < 0) {
          e.y = s.y + s.height;
        }
        e.vy = 0;
      }
    }

    forceRender(n => n + 1);
  }, [entity, solids, gravity, jumpForce, moveSpeed, maxFallSpeed, coyoteTime, jumpBuffer, wallSlide, wallSlideSpeed, wallJump, checkSolid]);

  return {
    grounded: groundedRef.current,
    wallSliding: wallSlidingRef.current,
    facing: facingRef.current,
    update,
  };
}
