import { useState, useRef, useCallback } from 'react';
import type { StateMachineConfig, StateMachineState } from '../types';

export function useStateMachine<C = any>(config: StateMachineConfig<C>): StateMachineState {
  const { initial, states, context: initialContext } = config;

  const [, forceRender] = useState(0);
  const currentRef = useRef(initial);
  const previousRef = useRef<string | null>(null);
  const contextRef = useRef<C>(initialContext as C);
  const enteredRef = useRef(false);

  // Fire onEnter for initial state on first call
  if (!enteredRef.current) {
    enteredRef.current = true;
    const initialState = states[initial];
    if (initialState?.onEnter) {
      initialState.onEnter(contextRef.current);
    }
  }

  const update = useCallback((dt: number) => {
    const stateDef = states[currentRef.current];
    if (stateDef?.onUpdate) {
      stateDef.onUpdate(contextRef.current, dt);
    }
  }, [states]);

  const send = useCallback((event: string) => {
    const stateDef = states[currentRef.current];
    if (!stateDef || stateDef.terminal) return;

    const nextState = stateDef.transitions?.[event];
    if (!nextState || !states[nextState]) return;

    // Exit current state
    if (stateDef.onExit) {
      stateDef.onExit(contextRef.current);
    }

    previousRef.current = currentRef.current;
    currentRef.current = nextState;

    // Enter new state
    const newStateDef = states[nextState];
    if (newStateDef?.onEnter) {
      newStateDef.onEnter(contextRef.current);
    }

    forceRender(n => n + 1);
  }, [states]);

  const is = useCallback((state: string) => currentRef.current === state, []);

  return {
    current: currentRef.current,
    previous: previousRef.current,
    update,
    send,
    is,
  };
}
