import { PaletteCommand } from './types';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

const KEYBINDINGS_KEY = 'sweatshop.palette.keybindings';

export interface CustomBinding {
  key: string;
  commandId: string;
}

function loadBindings(): CustomBinding[] {
  try {
    const raw = storeGet(KEYBINDINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function saveBindings(bindings: CustomBinding[]) {
  try { storeSet(KEYBINDINGS_KEY, JSON.stringify(bindings)); } catch {}
}

export function useCustomCommands(commands: PaletteCommand[]): PaletteCommand[] {
  const bindingsRef = useRef<CustomBinding[]>(loadBindings());

  const custom: PaletteCommand[] = [];
  for (const b of bindingsRef.current) {
    const target = commands.find((c) => c.id === b.commandId);
    if (target) {
      custom.push({
        id: 'custom.' + b.key,
        label: `${target.label} (${b.key})`,
        category: 'Custom',
        action: target.action,
      });
    }
  }
  return custom;
}
