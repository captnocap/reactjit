import { useCallback, useEffect, useMemo, useState } from 'react';
import { exec } from '../../../host';

const host: any = globalThis as any;

export type SystemRowKey =
  | 'os'
  | 'host'
  | 'kernel'
  | 'uptime'
  | 'packages'
  | 'shell'
  | 'resolution'
  | 'de'
  | 'wm'
  | 'theme'
  | 'icons'
  | 'terminal'
  | 'cpu'
  | 'gpu'
  | 'memory'
  | 'disk'
  | 'ip'
  | 'battery';

export type SystemRowDef = { key: SystemRowKey; label: string };

export const SYSTEM_ROWS: SystemRowDef[] = [
  { key: 'os', label: 'OS' },
  { key: 'host', label: 'Host' },
  { key: 'kernel', label: 'Kernel' },
  { key: 'uptime', label: 'Uptime' },
  { key: 'packages', label: 'Packages' },
  { key: 'shell', label: 'Shell' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'de', label: 'DE' },
  { key: 'wm', label: 'WM' },
  { key: 'theme', label: 'Theme' },
  { key: 'icons', label: 'Icons' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'cpu', label: 'CPU' },
  { key: 'gpu', label: 'GPU' },
  { key: 'memory', label: 'Memory' },
  { key: 'disk', label: 'Disk' },
  { key: 'ip', label: 'Local IP' },
  { key: 'battery', label: 'Battery' },
];

export type SystemInfoSnapshot = {
  values: Record<SystemRowKey, string>;
  distro: string;
  refreshedAt: number;
};

export type SystemInfoSettings = {
  refreshIntervalMs: number;
  visibleRows: SystemRowKey[];
  processInclude: string;
  processExclude: string;
  savePath: string;
};

export type UseSystemInfoResult = {
  snapshot: SystemInfoSnapshot;
  settings: SystemInfoSettings;
  refresh: () => void;
  setRefreshIntervalMs: (next: number) => void;
  toggleRow: (key: SystemRowKey) => void;
  setProcessInclude: (next: string) => void;
  setProcessExclude: (next: string) => void;
  setSavePath: (next: string) => void;
};

const KEYS = {
  interval: 'sweatshop.system-info.refresh-interval',
  rows: 'sweatshop.system-info.visible-rows',
  include: 'sweatshop.system-info.process-include',
  exclude: 'sweatshop.system-info.process-exclude',
  savePath: 'sweatshop.system-info.save-path',
};

function storeGet(key: string): string | null {
  try {
    if (typeof host.__store_get !== 'function') return null;
    const raw = host.__store_get(key);
    return raw == null ? null : String(raw);
  } catch {
    return null;
  }
}

function storeSet(key: string, value: string): void {
  try {
    if (typeof host.__store_set === 'function') host.__store_set(key, value);
  } catch {}
}

function sh(script: string): string {
  return exec(`sh -lc ${JSON.stringify(script)}`).trim();
}

function parseList(raw: string | null, fallback: SystemRowKey[]): SystemRowKey[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const allowed = new Set(SYSTEM_ROWS.map((row) => row.key));
    const next = parsed.filter((item) => typeof item === 'string' && allowed.has(item)) as SystemRowKey[];
    return next.length > 0 ? next : fallback;
  } catch {
    return fallback;
  }
}

function trimOr(value: string, fallback: string): string {
  const next = String(value || '').trim();
  return next.length > 0 ? next : fallback;
}

function probeSystemInfo(): SystemInfoSnapshot {
  const distro = trimOr(sh(`
    if command -v lsb_release >/dev/null 2>&1; then
      lsb_release -is 2>/dev/null | tr -d '"'
    elif [ -r /etc/os-release ]; then
      awk -F= '/^PRETTY_NAME=/ {gsub(/^"/,"",$2); gsub(/"$/,"",$2); print $2; exit}' /etc/os-release
    else
      uname -s
    fi
  `), 'unknown');

  const values: Record<SystemRowKey, string> = {
    os: distro,
    host: trimOr(exec('hostname -s 2>/dev/null || hostname 2>/dev/null'), 'unknown'),
    kernel: trimOr(exec('uname -sr 2>/dev/null'), 'unknown'),
    uptime: trimOr(sh(`uptime -p 2>/dev/null | sed 's/^up //'`), trimOr(sh(`cut -d' ' -f1 /proc/uptime 2>/dev/null`), 'unknown')),
    packages: trimOr(sh(`
      if command -v pacman >/dev/null 2>&1; then
        pacman -Qq 2>/dev/null | wc -l
      elif command -v dpkg >/dev/null 2>&1; then
        dpkg -l 2>/dev/null | awk '/^ii/ {c++} END {print c+0}'
      elif command -v rpm >/dev/null 2>&1; then
        rpm -qa 2>/dev/null | wc -l
      else
        echo 0
      fi
    `), '0'),
    shell: trimOr(sh(`printf '%s' "\${SHELL:-}" | sed 's#.*/##'`), 'unknown'),
    resolution: trimOr(sh(`
      if command -v xrandr >/dev/null 2>&1; then
        xrandr --current 2>/dev/null | awk '/\\*/ {print $1; exit}'
      elif command -v wlr-randr >/dev/null 2>&1; then
        wlr-randr 2>/dev/null | awk '/^[[:space:]]*[0-9]+x[0-9]+/ {print $1; exit}'
      else
        echo unknown
      fi
    `), 'unknown'),
    de: trimOr(sh(`printf '%s' "\${XDG_CURRENT_DESKTOP:-\${DESKTOP_SESSION:-unknown}}"`), 'unknown'),
    wm: trimOr(sh(`
      if command -v wmctrl >/dev/null 2>&1; then
        wmctrl -m 2>/dev/null | awk -F': ' '/Name/ {print $2; exit}'
      elif [ -n "\${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
        echo Hyprland
      elif [ -n "\${SWAYSOCK:-}" ]; then
        echo Sway
      else
        echo unknown
      fi
    `), 'unknown'),
    theme: trimOr(sh(`printf '%s' "\${GTK_THEME:-\${QT_STYLE_OVERRIDE:-unknown}}"`), 'unknown'),
    icons: trimOr(sh(`printf '%s' "\${XDG_ICON_THEME:-\${ICON_THEME:-unknown}}"`), 'unknown'),
    terminal: trimOr(sh(`
      parent="$(ps -p "$(ps -o ppid= -p $$ | tr -d ' ')" -o comm= 2>/dev/null | head -n1 | tr -d ' ')"
      if [ -n "\${TERM_PROGRAM:-}" ]; then
        printf '%s' "$TERM_PROGRAM"
      elif [ -n "\${TERMINAL:-}" ]; then
        printf '%s' "$TERMINAL"
      elif [ -n "$parent" ]; then
        printf '%s' "$parent"
      else
        echo unknown
      fi
    `), 'unknown'),
    cpu: trimOr(sh(`awk -F: '/model name/ {print $2; exit}' /proc/cpuinfo | sed 's/^ *//' | tr -s ' '`), 'unknown'),
    gpu: trimOr(sh(`
      if command -v lspci >/dev/null 2>&1; then
        lspci 2>/dev/null | awk 'tolower($0) ~ /(vga|3d|display)/ {print; exit}'
      else
        echo unknown
      fi
    `), 'unknown'),
    memory: trimOr(sh(`free -h 2>/dev/null | awk '/^Mem:/ {print $3 " / " $2}'`), 'unknown'),
    disk: trimOr(sh(`df -h / 2>/dev/null | awk 'NR==2 {print $3 " / " $2 " (" $5 ")"}'`), 'unknown'),
    ip: trimOr(sh(`hostname -I 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i ~ /^[0-9.]+$/) {print $i; exit}}'`), 'unknown'),
    battery: trimOr(sh(`
      for b in /sys/class/power_supply/BAT*; do
        [ -e "$b" ] || continue
        cap="$(cat "$b/capacity" 2>/dev/null)"
        status="$(cat "$b/status" 2>/dev/null)"
        if [ -n "$cap" ]; then
          printf '%s %s%%' "\${status:-Battery}" "$cap"
          exit
        fi
      done
      if command -v acpi >/dev/null 2>&1; then
        acpi -b 2>/dev/null | head -n1
      else
        echo no battery
      fi
    `), 'no battery'),
  };

  return {
    values,
    distro,
    refreshedAt: Date.now(),
  };
}

export function buildSystemMarkdown(snapshot: SystemInfoSnapshot, visibleRows: SystemRowKey[], processes: Array<{ pid: number; cpu: number; mem: number; command: string }>): string {
  const rows = visibleRows.map((key) => SYSTEM_ROWS.find((row) => row.key === key)).filter(Boolean) as SystemRowDef[];
  const lines: string[] = [
    '# System Info',
    '',
    `- Distro: ${snapshot.distro}`,
    `- Refreshed: ${new Date(snapshot.refreshedAt).toISOString()}`,
    '',
  ];
  for (const row of rows) lines.push(`- ${row.label}: ${snapshot.values[row.key]}`);
  lines.push('', '## Processes', '', '| PID | CPU% | MEM% | COMMAND |', '| --- | ---: | ---: | --- |');
  for (const proc of processes) lines.push(`| ${proc.pid} | ${proc.cpu.toFixed(1)} | ${proc.mem.toFixed(1)} | ${proc.command.replace(/\|/g, '\\|')} |`);
  return lines.join('\n');
}

export function useSystemInfo(): UseSystemInfoResult {
  const [snapshot, setSnapshot] = useState<SystemInfoSnapshot>(() => probeSystemInfo());
  const [refreshIntervalMs, setRefreshIntervalMsState] = useState<number>(() => Number(storeGet(KEYS.interval) || 5000) || 5000);
  const [visibleRows, setVisibleRows] = useState<SystemRowKey[]>(() => parseList(storeGet(KEYS.rows), SYSTEM_ROWS.map((row) => row.key)));
  const [processInclude, setProcessIncludeState] = useState(() => trimOr(storeGet(KEYS.include) || '', ''));
  const [processExclude, setProcessExcludeState] = useState(() => trimOr(storeGet(KEYS.exclude) || '', ''));
  const [savePath, setSavePathState] = useState(() => trimOr(storeGet(KEYS.savePath) || '', './system-info.md'));

  const refresh = useCallback(() => setSnapshot(probeSystemInfo()), []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, Math.max(1000, refreshIntervalMs));
    return () => clearInterval(id);
  }, [refresh, refreshIntervalMs]);

  useEffect(() => { storeSet(KEYS.interval, String(refreshIntervalMs)); }, [refreshIntervalMs]);
  useEffect(() => { storeSet(KEYS.rows, JSON.stringify(visibleRows)); }, [visibleRows]);
  useEffect(() => { storeSet(KEYS.include, processInclude); }, [processInclude]);
  useEffect(() => { storeSet(KEYS.exclude, processExclude); }, [processExclude]);
  useEffect(() => { storeSet(KEYS.savePath, savePath); }, [savePath]);

  const setRefreshIntervalMs = useCallback((next: number) => {
    const value = Math.max(1000, Math.round(Number(next) || 5000));
    setRefreshIntervalMsState(value);
  }, []);

  const toggleRow = useCallback((key: SystemRowKey) => {
    setVisibleRows((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]);
  }, []);

  const setProcessInclude = useCallback((next: string) => setProcessIncludeState(next), []);
  const setProcessExclude = useCallback((next: string) => setProcessExcludeState(next), []);
  const setSavePath = useCallback((next: string) => setSavePathState(next || './system-info.md'), []);

  return {
    snapshot,
    settings: { refreshIntervalMs, visibleRows, processInclude, processExclude, savePath },
    refresh,
    setRefreshIntervalMs,
    toggleRow,
    setProcessInclude,
    setProcessExclude,
    setSavePath,
  };
}
