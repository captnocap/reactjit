export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  fields?: Record<string, any>;
  stack?: string;
}

const CATEGORIES = ['app', 'network', 'db', 'render', 'input', 'bridge', 'theme'];
const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

let GLOBAL_INDEX = 0;

function generateEntry(): LogEntry {
  GLOBAL_INDEX++;
  const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
  const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const messages: Record<LogLevel, string> = {
    debug: `Tracing ${cat} lifecycle step ${GLOBAL_INDEX}`,
    info: `${cat} connected successfully`,
    warn: `${cat} latency exceeded threshold at ${Math.round(Math.random() * 200)}ms`,
    error: `${cat} operation failed: timeout`,
  };
  return {
    id: `log-${Date.now()}-${GLOBAL_INDEX}`,
    timestamp: Date.now(),
    level,
    category: cat,
    message: messages[level],
    fields: level === 'error' ? { code: 500 + Math.floor(Math.random() * 20), retry: false } : level === 'warn' ? { threshold: 150, actual: Math.round(Math.random() * 300) } : undefined,
    stack: level === 'error' ? `Error: ${cat} timeout\n  at process (${cat}.ts:${Math.floor(Math.random() * 100)})\n  at async run (runner.ts:42)` : undefined,
  };
}

export function useLogStream(options?: { maxEntries?: number; intervalMs?: number }): LogEntry[] {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const max = options?.maxEntries ?? 50000;
  const interval = options?.intervalMs ?? 800;
  const seedRef = useRef(false);

  useEffect(() => {
    if (!seedRef.current) {
      seedRef.current = true;
      const seed: LogEntry[] = [];
      const now = Date.now();
      for (let i = 0; i < 200; i++) {
        const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
        const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        seed.push({
          id: `log-seed-${i}`,
          timestamp: now - Math.floor(Math.random() * 3600000),
          level,
          category: cat,
          message: `Historical ${level} event in ${cat}`,
          fields: level === 'error' ? { code: 500 } : undefined,
          stack: level === 'error' ? 'Error: historical\n  at legacy.ts:10' : undefined,
        });
      }
      setEntries(seed.sort((a, b) => a.timestamp - b.timestamp));
    }

    const id = setInterval(() => {
      setEntries((prev) => {
        const next = [...prev, generateEntry()];
        if (next.length > max) next.splice(0, next.length - max);
        return next;
      });
    }, interval);
    return () => clearInterval(id);
  }, [max, interval]);

  return entries;
}
