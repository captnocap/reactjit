
import { ptyAlive, ptyClose, ptyFocus, ptyOpen, ptyRead, ptyWrite } from '../../host';

const host: any = globalThis as any;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;

const DEFAULT_SHELL = '/bin/bash';

function readShell(): string {
  try {
    const raw = storeGet('sweatshop.settings.terminal.shell');
    return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_SHELL;
  } catch {
    return DEFAULT_SHELL;
  }
}

export function useTerminalSpawn(props: {
  tabId: string;
  cwd: string;
  cols: number;
  rows: number;
  enabled?: boolean;
  focused?: boolean;
  onOutput?: (chunk: string) => void;
  onExit?: (code?: number) => void;
  onUnread?: (dirty: boolean) => void;
}) {
  const enabled = props.enabled !== false;
  const onOutputRef = useRef(props.onOutput);
  const onExitRef = useRef(props.onExit);
  const onUnreadRef = useRef(props.onUnread);
  const [handle, setHandle] = useState(-1);
  const handleRef = useRef(-1);
  const [alive, setAlive] = useState(false);

  useEffect(() => { onOutputRef.current = props.onOutput; }, [props.onOutput]);
  useEffect(() => { onExitRef.current = props.onExit; }, [props.onExit]);
  useEffect(() => { onUnreadRef.current = props.onUnread; }, [props.onUnread]);

  useEffect(() => {
    if (!enabled) return;
    const nextHandle = ptyOpen(props.cols, props.rows, readShell(), props.cwd);
    handleRef.current = nextHandle;
    setHandle(nextHandle);
    setAlive(nextHandle >= 0);
    return () => {
      if (handleRef.current >= 0) {
        ptyClose(handleRef.current);
        handleRef.current = -1;
      }
      setHandle(-1);
      setAlive(false);
    };
  }, [enabled, props.cols, props.cwd, props.rows, props.tabId]);

  useEffect(() => {
    if (props.focused && handleRef.current >= 0) ptyFocus(handleRef.current);
  }, [handle, props.focused]);

  useEffect(() => {
    if (handle < 0) return;
    const id = setInterval(() => {
      const current = handleRef.current;
      if (current < 0) return;
      const chunk = ptyRead(current);
      if (chunk) {
        onOutputRef.current?.(chunk);
        onUnreadRef.current?.(true);
      }
      const isAlive = ptyAlive(current);
      setAlive(isAlive);
      if (!isAlive) {
        onExitRef.current?.();
        onUnreadRef.current?.(false);
      }
    }, 80);
    return () => clearInterval(id);
  }, [handle]);

  const write = useCallback((data: string) => {
    if (handleRef.current < 0) return;
    ptyWrite(handleRef.current, data);
  }, []);

  const close = useCallback(() => {
    if (handleRef.current < 0) return;
    ptyClose(handleRef.current);
    handleRef.current = -1;
    setHandle(-1);
    setAlive(false);
  }, []);

  const restart = useCallback(() => {
    close();
    const nextHandle = ptyOpen(props.cols, props.rows, readShell(), props.cwd);
    handleRef.current = nextHandle;
    setHandle(nextHandle);
    setAlive(nextHandle >= 0);
  }, [close, props.cols, props.cwd, props.rows]);

  return useMemo(() => ({
    handle,
    alive,
    write,
    close,
    restart,
    cwd: props.cwd,
  }), [alive, close, handle, props.cwd, restart, write]);
}
