import { useRef, useEffect } from 'react';
import { InspectorNode } from '../types';

export type DiffMap = Map<number, 'added' | 'removed' | 'updated'>;

function flattenNodes(nodes: InspectorNode[]): Map<number, InspectorNode> {
  const map = new Map<number, InspectorNode>();
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    map.set(n.id, n);
    for (const c of n.children) stack.push(c);
  }
  return map;
}

export function useTreeDiff(tree: InspectorNode[]): DiffMap {
  const prevRef = useRef<Map<number, InspectorNode>>(new Map());
  const diffRef = useRef<DiffMap>(new Map());

  useEffect(() => {
    const current = flattenNodes(tree);
    const prev = prevRef.current;
    const diff = new Map<number, 'added' | 'removed' | 'updated'>();

    current.forEach((node, id) => {
      const old = prev.get(id);
      if (!old) {
        diff.set(id, 'added');
      } else if (
        old.renderCount !== node.renderCount ||
        JSON.stringify(old.props) !== JSON.stringify(node.props) ||
        JSON.stringify(old.style) !== JSON.stringify(node.style)
      ) {
        diff.set(id, 'updated');
      }
    });

    prev.forEach((_node, id) => {
      if (!current.has(id)) {
        diff.set(id, 'removed');
      }
    });

    diffRef.current = diff;
    prevRef.current = current;
  }, [tree]);

  return diffRef.current;
}
