// hottest — minimal useHotState round-trip test. Counter increments on click;
// state should survive a hot reload (edit this file, save, counter stays).
//
// Also renders the raw value returned by __hot_get so we can see whether the
// Zig side actually holds anything.

import { useHotState } from '@reactjit/runtime/hooks';

export default function HotTest() {
  const [count, setCount] = useHotState<number>('hottest.count', 0);
  const [label, setLabel] = useHotState<string>('hottest.label', 'start');

  const hostGet = (globalThis as any).__hot_get;
  const hasHost = typeof hostGet === 'function';
  const raw = hasHost ? hostGet('hottest.count') : '(host missing)';

  return (
    <div style={{ width: '100%', height: '100%', padding: 24, backgroundColor: '#0a0d12' }}>
      <h1 style={{ color: '#e8ecef' }}>useHotState test</h1>

      <div style={{ marginTop: 16, padding: 12, backgroundColor: '#111620', borderRadius: 6 }}>
        <p style={{ color: '#a0a8b5' }}>
          __hot_get on globalThis: <span style={{ color: hasHost ? '#34d399' : '#f87171' }}>{hasHost ? 'present' : 'MISSING'}</span>
        </p>
        <p style={{ color: '#a0a8b5' }}>
          Zig-side raw value for 'hottest.count': <span style={{ color: '#fbbf24' }}>{String(raw)}</span>
        </p>
      </div>

      <div style={{ marginTop: 24, flexDirection: 'row', gap: 12 }}>
        <button
          onClick={() => setCount(c => c + 1)}
          style={{ padding: 10, backgroundColor: '#1e3a8a', color: '#fff', borderRadius: 4 }}
        >
          count: {count} (click to +1)
        </button>
        <button
          onClick={() => setLabel(label === 'start' ? 'clicked' : 'start')}
          style={{ padding: 10, backgroundColor: '#064e3b', color: '#fff', borderRadius: 4 }}
        >
          label: {label}
        </button>
      </div>

      <p style={{ marginTop: 24, color: '#6b7585' }}>
        Save this file to trigger a reload. count + label should survive.
      </p>
    </div>
  );
}
