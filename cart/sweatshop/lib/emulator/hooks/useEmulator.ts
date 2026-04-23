
import { Bus } from '../bus';
import { Cartridge } from '../cartridge';

function base64Decode(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup: Record<string, number> = {};
  for (let i = 0; i < chars.length; i++) lookup[chars[i]] = i;

  const len = base64.length;
  let bufferLength = len * 0.75;
  if (base64[len - 1] === '=') bufferLength--;
  if (base64[len - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  let encoded1: number, encoded2: number, encoded3: number, encoded4: number;

  for (let i = 0; i < len; i += 4) {
    encoded1 = lookup[base64[i]];
    encoded2 = lookup[base64[i + 1]];
    encoded3 = lookup[base64[i + 2]];
    encoded4 = lookup[base64[i + 3]];
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== undefined) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (encoded4 !== undefined) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
  }
  return bytes;
}

function readROMViaExec(path: string): Uint8Array | null {
  const exec = (globalThis as any).__exec;
  if (typeof exec !== 'function') {
    console.warn('[emulator] __exec not available — cannot load ROM');
    return null;
  }
  try {
    const result = exec(`base64 "${path}"`);
    if (!result || result.length === 0) return null;
    return base64Decode(result.replace(/\s/g, ''));
  } catch (e) {
    console.warn('[emulator] Failed to load ROM:', e);
    return null;
  }
}

export type EmulatorState = 'idle' | 'running' | 'paused';

export type SaveState = {
  ram: Uint8Array;
  cpuA: number;
  cpuX: number;
  cpuY: number;
  cpuSP: number;
  cpuPC: number;
  cpuStatus: number;
  ppuCtrl: number;
  ppuMask: number;
  ppuStatus: number;
  ppuOAMAddr: number;
  ppuScroll: number;
  ppuAddr: number;
  ppuV: number;
  ppuT: number;
  ppuX: number;
  ppuW: number;
  ppuVRAM: Uint8Array;
  ppuPalette: Uint8Array;
  ppuOAM: Uint8Array;
  ppuCycle: number;
  ppuScanline: number;
  ppuFrame: number;
};

export function useEmulator() {
  const busRef = useRef<Bus | null>(null);
  const stateRef = useRef<EmulatorState>('idle');
  const speedRef = useRef<number>(1);
  const timeAccumRef = useRef<number>(0);

  const [state, setState] = useState<EmulatorState>('idle');
  const [romName, setRomName] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  const fpsFrameCount = useRef(0);
  const fpsTimeAccum = useRef(0);

  const loadROM = useCallback((path: string): boolean => {
    const data = readROMViaExec(path);
    if (!data) return false;

    const cartridge = Cartridge.loadINES(data);
    if (!cartridge) {
      console.warn('[emulator] Invalid iNES ROM');
      return false;
    }

    const bus = new Bus(cartridge);
    bus.cpu.buildLookup();
    bus.reset();

    busRef.current = bus;
    setRomName(path.split('/').pop() || path);
    setState('paused');
    stateRef.current = 'paused';
    return true;
  }, []);

  const reset = useCallback(() => {
    if (busRef.current) {
      busRef.current.reset();
      busRef.current.cpu.buildLookup();
    }
  }, []);

  const play = useCallback(() => {
    if (busRef.current) {
      setState('running');
      stateRef.current = 'running';
    }
  }, []);

  const pause = useCallback(() => {
    setState('paused');
    stateRef.current = 'paused';
  }, []);

  const step = useCallback(() => {
    if (!busRef.current) return;
    for (let i = 0; i < 29781; i++) {
      busRef.current.clock();
    }
  }, []);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
  }, []);

  const tick = useCallback((dt: number): boolean => {
    const bus = busRef.current;
    if (!bus || stateRef.current !== 'running') return false;

    const frameTime = 1 / 60.0988;
    const speed = speedRef.current;
    timeAccumRef.current += dt * speed;

    let newFrame = false;
    while (timeAccumRef.current >= frameTime) {
      for (let i = 0; i < 89340; i++) {
        newFrame = bus.clock() || newFrame;
      }
      timeAccumRef.current -= frameTime;
    }

    fpsFrameCount.current++;
    fpsTimeAccum.current += dt;
    if (fpsTimeAccum.current >= 1) {
      setFps(fpsFrameCount.current);
      fpsFrameCount.current = 0;
      fpsTimeAccum.current = 0;
    }

    return newFrame;
  }, []);

  const saveState = useCallback((): SaveState | null => {
    const bus = busRef.current;
    if (!bus) return null;
    return {
      ram: new Uint8Array(bus.ram),
      cpuA: bus.cpu.a,
      cpuX: bus.cpu.x,
      cpuY: bus.cpu.y,
      cpuSP: bus.cpu.sp,
      cpuPC: bus.cpu.pc,
      cpuStatus: bus.cpu.status,
      ppuCtrl: bus.ppu.ctrl,
      ppuMask: bus.ppu.mask,
      ppuStatus: bus.ppu.status,
      ppuOAMAddr: bus.ppu.oamAddr,
      ppuScroll: bus.ppu.scroll,
      ppuAddr: bus.ppu.addr,
      ppuV: bus.ppu.v,
      ppuT: bus.ppu.t,
      ppuX: bus.ppu.x,
      ppuW: bus.ppu.w,
      ppuVRAM: new Uint8Array(bus.ppu.vram),
      ppuPalette: new Uint8Array(bus.ppu.palette),
      ppuOAM: new Uint8Array(bus.ppu.oam),
      ppuCycle: bus.ppu.cycle,
      ppuScanline: bus.ppu.scanline,
      ppuFrame: bus.ppu.frame,
    };
  }, []);

  const loadSaveState = useCallback((ss: SaveState): void => {
    const bus = busRef.current;
    if (!bus) return;
    bus.ram.set(ss.ram);
    bus.cpu.a = ss.cpuA;
    bus.cpu.x = ss.cpuX;
    bus.cpu.y = ss.cpuY;
    bus.cpu.sp = ss.cpuSP;
    bus.cpu.pc = ss.cpuPC;
    bus.cpu.status = ss.cpuStatus;
    bus.ppu.ctrl = ss.ppuCtrl;
    bus.ppu.mask = ss.ppuMask;
    bus.ppu.status = ss.ppuStatus;
    bus.ppu.oamAddr = ss.ppuOAMAddr;
    bus.ppu.scroll = ss.ppuScroll;
    bus.ppu.addr = ss.ppuAddr;
    bus.ppu.v = ss.ppuV;
    bus.ppu.t = ss.ppuT;
    bus.ppu.x = ss.ppuX;
    bus.ppu.w = ss.ppuW;
    bus.ppu.vram.set(ss.ppuVRAM);
    bus.ppu.palette.set(ss.ppuPalette);
    bus.ppu.oam.set(ss.ppuOAM);
    bus.ppu.cycle = ss.ppuCycle;
    bus.ppu.scanline = ss.ppuScanline;
    bus.ppu.frame = ss.ppuFrame;
  }, []);

  return {
    busRef,
    state,
    romName,
    fps,
    loadROM,
    reset,
    play,
    pause,
    step,
    setSpeed,
    tick,
    saveState,
    loadSaveState,
  };
}
