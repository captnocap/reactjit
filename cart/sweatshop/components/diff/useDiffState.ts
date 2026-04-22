
import type { Checkpoint, CheckpointDiff } from '../../checkpoint';
import { parseSideBySide, type ParsedDiff } from '../../app/diff-helpers';

export interface DiffState {
  selectedFilePath: string | null;
  setSelectedFilePath: (p: string | null) => void;
  inlineView: boolean;
  setInlineView: (v: boolean) => void;
  wordDiffEnabled: boolean;
  setWordDiffEnabled: (v: boolean) => void;
  virtualizeThreshold: number;
  setVirtualizeThreshold: (v: number) => void;
  scrollY: number;
  setScrollY: (y: number) => void;
  collapsedHunks: Set<string>;
  toggleHunk: (filePath: string, hunkIndex: number) => void;
  jumpIndex: number | null;
  setJumpIndex: (i: number | null) => void;
  parsed: ParsedDiff | null;
  diffs: CheckpointDiff[];
  selectedDiff: CheckpointDiff | null;
  totalAdditions: number;
  totalDeletions: number;
}

function mergeCumulativeDiffs(checkpoints: Checkpoint[]): CheckpointDiff[] {
  const map = new Map<string, CheckpointDiff>();
  for (const cp of checkpoints) {
    for (const d of cp.diff) {
      const existing = map.get(d.path);
      if (existing) {
        existing.additions += d.additions;
        existing.deletions += d.deletions;
        existing.patch = d.patch;
        if (d.status === 'deleted' || existing.status === 'deleted') existing.status = 'deleted';
        else if (d.status === 'added' || existing.status === 'added') existing.status = 'added';
        else existing.status = 'modified';
      } else {
        map.set(d.path, { ...d });
      }
    }
  }
  return Array.from(map.values());
}

export function useDiffState(props: {
  checkpoints: Checkpoint[];
  activeCheckpointId?: string;
}): DiffState {
  const { checkpoints, activeCheckpointId } = props;

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [inlineView, setInlineView] = useState(false);
  const [wordDiffEnabled, setWordDiffEnabled] = useState(false);
  const [virtualizeThreshold, setVirtualizeThreshold] = useState(500);
  const [scrollY, setScrollY] = useState(0);
  const [collapsedHunks, setCollapsedHunks] = useState<Set<string>>(new Set());
  const [jumpIndex, setJumpIndex] = useState<number | null>(null);

  const ALL_TURNS_ID = '__all__';
  const viewMode = activeCheckpointId || ALL_TURNS_ID;
  const isAllTurns = viewMode === ALL_TURNS_ID;

  const activeCheckpoint = isAllTurns
    ? null
    : checkpoints.find((cp) => cp.id === activeCheckpointId) || null;

  const diffs: CheckpointDiff[] = useMemo(() => {
    if (isAllTurns) return mergeCumulativeDiffs(checkpoints);
    return activeCheckpoint?.diff || [];
  }, [checkpoints, activeCheckpointId, isAllTurns]);

  const selectedDiff = diffs.find((d) => d.path === selectedFilePath) || null;

  useMemo(() => {
    if (diffs.length > 0 && !selectedDiff) {
      setSelectedFilePath(diffs[0].path);
    } else if (diffs.length === 0) {
      setSelectedFilePath(null);
    }
  }, [activeCheckpointId, diffs.length]);

  useEffect(() => {
    setCollapsedHunks(new Set());
    setScrollY(0);
  }, [selectedDiff?.path]);

  const toggleHunk = useCallback((filePath: string, hunkIndex: number) => {
    const key = `${filePath}::${hunkIndex}`;
    setCollapsedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const parsed = useMemo(() => {
    if (!selectedDiff || inlineView) return null;
    return parseSideBySide(selectedDiff.patch);
  }, [selectedDiff, inlineView]);

  const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0);
  const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0);

  return {
    selectedFilePath,
    setSelectedFilePath,
    inlineView,
    setInlineView,
    wordDiffEnabled,
    setWordDiffEnabled,
    virtualizeThreshold,
    setVirtualizeThreshold,
    scrollY,
    setScrollY,
    collapsedHunks,
    toggleHunk,
    jumpIndex,
    setJumpIndex,
    parsed,
    diffs,
    selectedDiff,
    totalAdditions,
    totalDeletions,
  };
}
