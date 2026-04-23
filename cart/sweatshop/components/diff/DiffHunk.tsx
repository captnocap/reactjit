import { Col } from '../../../../runtime/primitives';
import { DiffHunkHeader } from './DiffHunkHeader';
import { DiffHunkSummary } from './DiffHunkSummary';
import { DiffSideBySide } from './DiffSideBySide';
import { DiffInline } from './DiffInline';
import type { DiffHunk as DiffHunkType, SideBySideRow } from '../../app/diff-helpers';

interface DiffHunkProps {
  hunk: DiffHunkType & { rows: SideBySideRow[] };
  hunkIndex: number;
  collapsed: boolean;
  onToggle: () => void;
  viewMode: 'side-by-side' | 'inline';
  wordDiffEnabled: boolean;
}

export function DiffHunk(props: DiffHunkProps) {
  return (
    <Col>
      <DiffHunkHeader hunk={props.hunk} collapsed={props.collapsed} onToggle={props.onToggle} />
      {props.collapsed ? (
        <DiffHunkSummary hiddenCount={props.hunk.rows.length} onToggle={props.onToggle} />
      ) : props.viewMode === 'side-by-side' ? (
        <DiffSideBySide rows={props.hunk.rows} wordDiffEnabled={props.wordDiffEnabled} />
      ) : (
        <DiffInline hunk={props.hunk} wordDiffEnabled={props.wordDiffEnabled} />
      )}
    </Col>
  );
}
