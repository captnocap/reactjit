const React: any = require('react');
const { useState, useMemo, useCallback, useEffect } = React;

import type { SplitNode } from './SplitLayoutEngine';
import { flattenPanes } from './SplitLayoutEngine';

export function useSplitFocus(tree: SplitNode) {
  const panes = useMemo(() => flattenPanes(tree), [tree]);
  const [focusedPane, setFocusedPane] = useState<string>(panes[0]?.id || '');

  useEffect(() => {
    if (!panes.some((p) => p.id === focusedPane)) {
      setFocusedPane(panes[0]?.id || '');
    }
  }, [panes, focusedPane]);

  const cycleFocus = useCallback(
    (direction: 1 | -1) => {
      const idx = panes.findIndex((p) => p.id === focusedPane);
      if (idx < 0) {
        setFocusedPane(panes[0]?.id || '');
        return;
      }
      const nextIdx = (idx + direction + panes.length) % panes.length;
      setFocusedPane(panes[nextIdx].id);
    },
    [panes, focusedPane]
  );

  return { focusedPane, setFocusedPane, cycleFocus };
}
