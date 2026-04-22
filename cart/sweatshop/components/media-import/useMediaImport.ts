
import { exec } from '../../host';
import { stat } from '../../../../runtime/hooks/fs';

export type MediaImportKind = 'image' | 'video' | 'gif';
export type MediaImportStatus = 'queued' | 'loading' | 'ready' | 'failed';

export type MediaImportItem = {
  id: string;
  path: string;
  name: string;
  kind: MediaImportKind;
  size: number;
  status: MediaImportStatus;
  progress: number;
  error?: string;
};

type Draft = { id: string; path: string; name: string; kind: MediaImportKind };

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif', 'svg']);
const GIF_EXTS = new Set(['gif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'ogv']);

function extname(path: string): string {
  const m = String(path || '').toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
  return m ? m[1] : '';
}

function baseName(path: string): string {
  const clean = String(path || '').replace(/[\\/]+$/, '');
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || clean || 'file';
}

function humanName(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function mediaKind(path: string): MediaImportKind | null {
  const ext = extname(path);
  if (GIF_EXTS.has(ext)) return 'gif';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return null;
}

function bytesLabel(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return (unit === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 0 : 1)) + ' ' + units[unit];
}

function parsePickerOutput(output: string): string[] {
  return String(output || '')
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function openFilePicker(): string[] {
  const cmd = [
    'if command -v zenity >/dev/null 2>&1; then zenity --file-selection --multiple --separator=$\'\\n\' --title="Import media";',
    'elif command -v kdialog >/dev/null 2>&1; then kdialog --getopenfilename --multiple --separate-output --title "Import media";',
    'elif command -v osascript >/dev/null 2>&1; then osascript -e \'set chosen to choose file names with prompt "Import media"\' -e \'repeat with f in chosen\' -e \'log POSIX path of f\' -e \'end repeat\';',
    'fi',
  ].join(' ');
  return parsePickerOutput(exec(cmd));
}

function validateDraft(draft: Draft, maxSizeBytes: number): MediaImportItem {
  const info = stat(draft.path);
  if (!info || info.isDir) return { id: draft.id, path: draft.path, name: draft.name, kind: draft.kind, size: 0, status: 'failed', progress: 100, error: 'not a file' };
  if (draft.kind === 'gif' && info.size > maxSizeBytes) return { id: draft.id, path: draft.path, name: draft.name, kind: draft.kind, size: info.size, status: 'failed', progress: 100, error: 'size cap exceeded' };
  if (info.size > maxSizeBytes) return { id: draft.id, path: draft.path, name: draft.name, kind: draft.kind, size: info.size, status: 'failed', progress: 100, error: 'size cap exceeded' };
  return { id: draft.id, path: draft.path, name: draft.name, kind: draft.kind, size: info.size, status: 'ready', progress: 100 };
}

export function humanMediaSize(size: number): string {
  return bytesLabel(size);
}

export function mediaImportLabel(path: string): string {
  return humanName(path);
}

export function useMediaImport(opts: { maxSizeBytes: number; onConfirm: (items: MediaImportItem[]) => void }) {
  const [batch, setBatch] = useState<MediaImportItem[]>([]);
  const queueRef = useRef<Draft[]>([]);
  const processingRef = useRef(false);
  const [pump, setPump] = useState(0);

  const enqueuePaths = useCallback((paths: string[]) => {
    const drafts = paths.map((path) => {
      const kind = mediaKind(path);
      return kind ? { id: 'import_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6), path, name: humanName(path), kind } : null;
    }).filter(Boolean) as Draft[];
    if (!drafts.length) return;
    queueRef.current.push(...drafts);
    setBatch((prev) => prev.concat(drafts.map((draft) => ({ id: draft.id, path: draft.path, name: draft.name, kind: draft.kind, size: 0, status: 'queued', progress: 0 }))));
    setPump((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!pump || processingRef.current) return;
    processingRef.current = true;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const draft = queueRef.current.shift();
      if (!draft) { processingRef.current = false; return; }
      setBatch((prev) => prev.map((item) => item.id === draft.id ? { ...item, status: 'loading', progress: 40, error: undefined } : item));
      const next = validateDraft(draft, opts.maxSizeBytes);
      setBatch((prev) => prev.map((item) => item.id === draft.id ? next : item));
      setTimeout(run, 0);
    };
    run();
    return () => { cancelled = true; processingRef.current = false; };
  }, [opts.maxSizeBytes, pump]);

  const clear = useCallback(() => {
    queueRef.current = [];
    setBatch([]);
  }, []);

  const remove = useCallback((id: string) => {
    queueRef.current = queueRef.current.filter((draft) => draft.id !== id);
    setBatch((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const confirm = useCallback(() => {
    const ready = batch.filter((item) => item.status === 'ready');
    if (!ready.length) return;
    opts.onConfirm(ready);
  }, [batch, opts]);

  const pickFiles = useCallback(() => enqueuePaths(openFilePicker()), [enqueuePaths]);

  const readyItems = useMemo(() => batch.filter((item) => item.status === 'ready'), [batch]);
  const failedItems = useMemo(() => batch.filter((item) => item.status === 'failed'), [batch]);
  const pendingItems = useMemo(() => batch.filter((item) => item.status === 'queued' || item.status === 'loading'), [batch]);

  return {
    batch,
    readyItems,
    failedItems,
    pendingItems,
    addPaths: enqueuePaths,
    pickFiles,
    remove,
    clear,
    confirm,
  };
}
