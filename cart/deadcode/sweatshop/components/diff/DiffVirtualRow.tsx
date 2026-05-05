import { DiffHunkHeader } from './DiffHunkHeader';
import { DiffHunkSummary } from './DiffHunkSummary';
import { DiffSideBySide } from './DiffSideBySide';
import type { ParsedDiff } from '../../app/diff-helpers';

interface DiffVirtualRowProps {
  vr: { type: string; hunkIndex: number; hiddenCount?: number; row?: any; key: string };
  parsed: ParsedDiff;
  filePath: string;
  collapsedHunks: Set<string>;
  toggleHunk: (filePath: string, hunkIndex: number) => void;
  wordDiffEnabled: boolean;
}

export function DiffVirtualRow(props: DiffVirtualRowProps) {
  const { vr, parsed, filePath, collapsedHunks, toggleHunk, wordDiffEnabled } = props;

  if (vr.type === 'hunk-header') {
    return (
      <DiffHunkHeader
        key={vr.key}
        hunk={parsed.hunks[vr.hunkIndex]}
        collapsed={collapsedHunks.has(`${filePath}::${vr.hunkIndex}`)}
        onToggle={() => toggleHunk(filePath, vr.hunkIndex)}
      />
    );
  }
  if (vr.type === 'hunk-summary') {
    return (
      <DiffHunkSummary
        key={vr.key}
        hiddenCount={vr.hiddenCount || 0}
        onToggle={() => toggleHunk(filePath, vr.hunkIndex)}
      />
    );
  }
  return <DiffSideBySide key={vr.key} rows={[vr.row]} wordDiffEnabled={wordDiffEnabled} />;
}
