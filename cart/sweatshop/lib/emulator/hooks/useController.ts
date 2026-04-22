
export type ControllerBindings = {
  up: string;
  down: string;
  left: string;
  right: string;
  a: string;
  b: string;
  start: string;
  select: string;
};

export const DEFAULT_BINDINGS: ControllerBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  a: 'z',
  b: 'x',
  start: 'Enter',
  select: 'Shift',
};

export function useController(
  onButtonChange: (button: keyof ControllerBindings, pressed: boolean) => void
) {
  const [bindings, setBindingsState] = useState<ControllerBindings>(DEFAULT_BINDINGS);
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const b = bindingsRef.current;
      const map: Record<string, keyof ControllerBindings> = {};
      for (const key of Object.keys(b) as Array<keyof ControllerBindings>) {
        map[b[key]] = key;
      }
      const button = map[e.key];
      if (button) {
        e.preventDefault();
        onButtonChange(button, e.type === 'keydown');
      }
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', handler);
    };
  }, [onButtonChange]);

  const setBindings = useCallback((next: Partial<ControllerBindings>) => {
    setBindingsState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetBindings = useCallback(() => {
    setBindingsState(DEFAULT_BINDINGS);
  }, []);

  return { bindings, setBindings, resetBindings };
}
