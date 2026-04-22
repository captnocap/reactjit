// =============================================================================
// VARIABLE EXPANSION — ported from AI app variable specs
// =============================================================================
// Supports: system variables, app-level variables, wildcard variables.
// REST API and JavaScript variables are NOT supported (require fetch/vm).
// All user-defined variables are persisted via __store_* host bindings.

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : () => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : () => {};

// ── Types ────────────────────────────────────────────────────────────────────

export type VariableType = 'system' | 'app-level' | 'wildcard';

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  description?: string;
  isEnabled: boolean;
}

export interface SystemVariable extends Variable {
  type: 'system';
  computeFn: 'time' | 'date' | 'datetime' | 'timestamp' | 'user-name' | 'workspace' | 'branch';
}

export interface AppLevelVariable extends Variable {
  type: 'app-level';
  value: string;
}

export interface WildcardVariable extends Variable {
  type: 'wildcard';
  options: string[];
  allowDuplicates: boolean;
  lastPick?: string;
}

export type AnyVariable = SystemVariable | AppLevelVariable | WildcardVariable;

export interface ExpansionResult {
  variable: string;
  data?: string;
  error?: string;
}

// ── System Variables (built-in, always available) ────────────────────────────

function getSystemVarValue(v: SystemVariable, ctx: { workDir: string; gitBranch: string; userName: string }): string {
  switch (v.computeFn) {
    case 'time': {
      const d = new Date();
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    }
    case 'date': {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    case 'datetime': {
      return new Date().toISOString();
    }
    case 'timestamp': {
      return String(Date.now());
    }
    case 'user-name':
      return ctx.userName || 'user';
    case 'workspace': {
      const parts = ctx.workDir.split('/');
      return parts[parts.length - 1] || 'workspace';
    }
    case 'branch':
      return ctx.gitBranch || 'main';
    default:
      return '';
  }
}

export const SYSTEM_VARIABLES: SystemVariable[] = [
  { id: 'sys_time', name: 'time', type: 'system', description: 'Current time (HH:MM:SS)', isEnabled: true, computeFn: 'time' },
  { id: 'sys_date', name: 'date', type: 'system', description: 'Current date (YYYY-MM-DD)', isEnabled: true, computeFn: 'date' },
  { id: 'sys_datetime', name: 'datetime', type: 'system', description: 'Current date/time (ISO 8601)', isEnabled: true, computeFn: 'datetime' },
  { id: 'sys_timestamp', name: 'timestamp', type: 'system', description: 'Unix timestamp (ms)', isEnabled: true, computeFn: 'timestamp' },
  { id: 'sys_user_name', name: 'user-name', type: 'system', description: 'System username', isEnabled: true, computeFn: 'user-name' },
  { id: 'sys_workspace', name: 'workspace', type: 'system', description: 'Current workspace name', isEnabled: true, computeFn: 'workspace' },
  { id: 'sys_branch', name: 'branch', type: 'system', description: 'Current git branch', isEnabled: true, computeFn: 'branch' },
];

// ── Persistence ──────────────────────────────────────────────────────────────

const STORE_PREFIX = 'cursor-ide:vars:';
const STORE_LIST_KEY = 'cursor-ide:vars:list';

function varStoreKey(name: string): string {
  return STORE_PREFIX + name;
}

function loadVarList(): string[] {
  const json = storeGet(STORE_LIST_KEY);
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function saveVarList(names: string[]): void {
  storeSet(STORE_LIST_KEY, JSON.stringify(names));
}

export function loadVariable(name: string): AnyVariable | null {
  const json = storeGet(varStoreKey(name));
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export function saveVariable(v: AnyVariable): void {
  storeSet(varStoreKey(v.name), JSON.stringify(v));
  const list = loadVarList();
  if (!list.includes(v.name)) {
    list.push(v.name);
    saveVarList(list);
  }
}

export function deleteVariable(name: string): void {
  const list = loadVarList().filter(n => n !== name);
  saveVarList(list);
  storeSet(varStoreKey(name), '');
}

export function listVariables(): AnyVariable[] {
  const names = loadVarList();
  const vars: AnyVariable[] = [...SYSTEM_VARIABLES];
  for (const name of names) {
    const v = loadVariable(name);
    if (v) vars.push(v);
  }
  return vars;
}

export function listCustomVariables(): AnyVariable[] {
  const names = loadVarList();
  const vars: AnyVariable[] = [];
  for (const name of names) {
    const v = loadVariable(name);
    if (v) vars.push(v);
  }
  return vars;
}

// ── Creation helpers ─────────────────────────────────────────────────────────

export function createAppVariable(name: string, value: string, description?: string): AppLevelVariable {
  const v: AppLevelVariable = { id: 'var_' + Date.now(), name, type: 'app-level', description, isEnabled: true, value };
  saveVariable(v);
  return v;
}

export function createWildcardVariable(name: string, options: string[], allowDuplicates: boolean = false, description?: string): WildcardVariable {
  const v: WildcardVariable = { id: 'var_' + Date.now(), name, type: 'wildcard', description, isEnabled: true, options, allowDuplicates };
  saveVariable(v);
  return v;
}

// ── Expansion engine ─────────────────────────────────────────────────────────

const MAX_DEPTH = 5;

function resolveVariable(name: string, ctx: ExpansionContext, depth: number = 0): ExpansionResult {
  if (depth > MAX_DEPTH) {
    return { variable: name, error: 'Circular reference (max depth)' };
  }

  // Check system vars first
  const sysVar = SYSTEM_VARIABLES.find(v => v.name === name);
  if (sysVar) {
    if (!sysVar.isEnabled) return { variable: name, error: 'Variable disabled' };
    return { variable: name, data: getSystemVarValue(sysVar, ctx) };
  }

  // Check custom vars
  const customVar = loadVariable(name);
  if (!customVar) {
    return { variable: name, error: 'Variable not found: ' + name };
  }
  if (!customVar.isEnabled) {
    return { variable: name, error: 'Variable disabled: ' + name };
  }

  switch (customVar.type) {
    case 'app-level': {
      let value = customVar.value;
      // Recursive expansion within value
      value = expandVariablesSync(value, ctx, depth + 1);
      return { variable: name, data: value };
    }
    case 'wildcard': {
      if (customVar.options.length === 0) {
        return { variable: name, error: 'Wildcard has no options' };
      }
      let index = Math.floor(Math.random() * customVar.options.length);
      let selected = customVar.options[index];
      if (!customVar.allowDuplicates && customVar.lastPick) {
        let attempts = 0;
        while (selected === customVar.lastPick && attempts < 10) {
          index = Math.floor(Math.random() * customVar.options.length);
          selected = customVar.options[index];
          attempts++;
        }
      }
      customVar.lastPick = selected;
      saveVariable(customVar);
      return { variable: name, data: selected };
    }
    default:
      return { variable: name, error: 'Unsupported variable type: ' + (customVar as any).type };
  }
}

export interface ExpansionContext {
  workDir: string;
  gitBranch: string;
  userName: string;
}

export function expandVariablesSync(text: string, ctx: ExpansionContext, depth: number = 0): string {
  const regex = /\{\{([a-zA-Z_][\w-]*)\}\}/g;
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (!matches.includes(m[1])) matches.push(m[1]);
  }
  if (matches.length === 0) return text;

  let result = text;
  for (const varName of matches) {
    const resolved = resolveVariable(varName, ctx, depth);
    if (resolved.data !== undefined) {
      result = result.replace(new RegExp('\\{\\{' + varName + '\\}\\}', 'g'), resolved.data);
    }
  }
  return result;
}

export function expandVariables(text: string, ctx: ExpansionContext): ExpansionResult[] {
  const regex = /\{\{([a-zA-Z_][\w-]*)\}\}/g;
  const names: string[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names.map(name => resolveVariable(name, ctx));
}

export function hasVariables(text: string): boolean {
  return /\{\{[a-zA-Z_][\w-]*\}\}/.test(text);
}

export function getVariableNames(text: string): string[] {
  const regex = /\{\{([a-zA-Z_][\w-]*)\}\}/g;
  const names: string[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}
