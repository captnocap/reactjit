// React surface for android.ts — device list + selected serial + action helpers.


import { probeAdb, devices as adbDevices, tap, swipe, typeText, keyevent, launchApp, screencap, listPackages, currentActivity,
         type AdbProbe, type AdbDevice } from '../../../lib/automation/android';

export interface AndroidVMApi {
  probe: AdbProbe | null;
  probing: boolean;
  devices: AdbDevice[];
  selected: string | null;
  setSelected: (serial: string | null) => void;
  refresh: () => Promise<void>;
  running: boolean;
  lastNote: string | null;

  tap: (x: number, y: number) => Promise<boolean>;
  swipe: (x1: number, y1: number, x2: number, y2: number, ms?: number) => Promise<boolean>;
  type: (text: string) => Promise<boolean>;
  key: (code: number | string) => Promise<boolean>;
  launch: (pkg: string) => Promise<boolean>;
  screencap: (outPath: string) => Promise<{ ok: boolean; path: string; bytes: number; err?: string }>;
  listPackages: () => Promise<string[]>;
  currentActivity: () => Promise<string>;
}

export function useAndroidVM(): AndroidVMApi {
  const [probe, setProbe] = useState<AdbProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastNote, setLastNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setProbing(true);
    const p = await probeAdb();
    setProbe(p);
    if (p.present) {
      const d = await adbDevices();
      setDevices(d);
      setSelected((cur: string | null) => cur && d.find((x) => x.serial === cur) ? cur : (d[0]?.serial ?? null));
    } else {
      setDevices([]);
    }
    setProbing(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const wrap = async <T,>(fn: () => Promise<T>, note: (r: T) => string): Promise<T> => {
    setRunning(true);
    const r = await fn();
    setRunning(false);
    setLastNote(note(r));
    return r;
  };

  return {
    probe, probing, devices, selected, setSelected, refresh, running, lastNote,
    tap: (x, y) => wrap(() => tap(selected, x, y), (ok) => 'tap ' + x + ',' + y + ' → ' + (ok ? 'ok' : 'fail')),
    swipe: (x1, y1, x2, y2, ms) => wrap(() => swipe(selected, x1, y1, x2, y2, ms), (ok) => 'swipe → ' + (ok ? 'ok' : 'fail')),
    type: (text) => wrap(() => typeText(selected, text), (ok) => 'type ' + text.length + ' chars → ' + (ok ? 'ok' : 'fail')),
    key: (code) => wrap(() => keyevent(selected, code), (ok) => 'keyevent ' + code + ' → ' + (ok ? 'ok' : 'fail')),
    launch: (pkg) => wrap(() => launchApp(selected, pkg), (ok) => 'launch ' + pkg + ' → ' + (ok ? 'ok' : 'fail')),
    screencap: (out) => wrap(() => screencap(selected, out), (r) => r.ok ? (r.bytes + 'B → ' + r.path) : (r.err || 'screencap failed')),
    listPackages: () => listPackages(selected),
    currentActivity: () => currentActivity(selected),
  };
}
