import { useState, useCallback } from 'react';

export interface GameStateConfig<S extends string = string> {
  initial: S;
  transitions: Record<S, S[]>;
}

export interface GameStateResult<S extends string = string> {
  current: S;
  previous: S | null;
  is: (state: S) => boolean;
  canTransitionTo: (state: S) => boolean;
  transitionTo: (state: S) => void;
}

/** Default game phases: menu → play ↔ pause, play → gameover → menu */
const DEFAULT_TRANSITIONS: Record<string, string[]> = {
  menu: ['play'],
  play: ['pause', 'gameover'],
  pause: ['play', 'menu'],
  gameover: ['menu', 'play'],
};

export function useGameState<S extends string = string>(
  config?: GameStateConfig<S>,
): GameStateResult<S> {
  const transitions = (config?.transitions ?? DEFAULT_TRANSITIONS) as Record<S, S[]>;
  const initial = (config?.initial ?? 'menu') as S;

  const [state, setState] = useState<{ current: S; previous: S | null }>({
    current: initial,
    previous: null,
  });

  const is = useCallback((s: S) => state.current === s, [state.current]);

  const canTransitionTo = useCallback(
    (target: S) => {
      const allowed = transitions[state.current];
      return allowed ? allowed.includes(target) : false;
    },
    [state.current, transitions],
  );

  const transitionTo = useCallback(
    (target: S) => {
      const allowed = transitions[state.current];
      if (allowed && allowed.includes(target)) {
        setState({ current: target, previous: state.current });
      }
    },
    [state.current, transitions],
  );

  return {
    current: state.current,
    previous: state.previous,
    is,
    canTransitionTo,
    transitionTo,
  };
}
