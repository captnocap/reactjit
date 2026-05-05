export interface SplitPaneNode {
  type: 'pane';
  id: string;
  filePath: string | null;
  tabs: string[];
  activeTabIndex: number;
}

export interface SplitBranchNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  weights: [number, number];
  children: [SplitNode, SplitNode];
}

export type SplitNode = SplitPaneNode | SplitBranchNode;

let idCounter = 0;
function generateId(): string {
  return 'sp_' + (++idCounter) + '_' + Date.now();
}

export function createPane(filePath?: string): SplitPaneNode {
  return { type: 'pane', id: generateId(), filePath: filePath || null, tabs: filePath ? [filePath] : [], activeTabIndex: 0 };
}

export function createSplit(direction: 'horizontal' | 'vertical', left: SplitNode, right: SplitNode, weights?: [number, number]): SplitBranchNode {
  return { type: 'split', id: generateId(), direction, weights: weights || [1, 1], children: [left, right] };
}

export function splitNode(tree: SplitNode, paneId: string, direction: 'horizontal' | 'vertical'): SplitNode {
  return walk(tree, (node) => {
    if (node.type === 'pane' && node.id === paneId) {
      return createSplit(direction, node, createPane());
    }
    return node;
  });
}

export function removeNode(tree: SplitNode, paneId: string): SplitNode | null {
  if (tree.type === 'pane') {
    return tree.id === paneId ? null : tree;
  }
  const [left, right] = tree.children;
  const newLeft = removeNode(left, paneId);
  const newRight = removeNode(right, paneId);
  if (newLeft === null && newRight === null) return null;
  if (newLeft === null) return newRight;
  if (newRight === null) return newLeft;
  return { ...tree, children: [newLeft, newRight] };
}

export function updatePaneFilePath(tree: SplitNode, paneId: string, filePath: string | null): SplitNode {
  return walk(tree, (node) => {
    if (node.type === 'pane' && node.id === paneId) {
      const tabs = filePath && !node.tabs.includes(filePath) ? [...node.tabs, filePath] : node.tabs;
      return { ...node, filePath, tabs };
    }
    return node;
  });
}

export function moveTab(tree: SplitNode, fromPaneId: string, toPaneId: string, filePath: string): SplitNode {
  return walk(tree, (node) => {
    if (node.type === 'pane' && node.id === fromPaneId) {
      const tabs = node.tabs.filter((t) => t !== filePath);
      const activeTabIndex = Math.min(node.activeTabIndex, Math.max(0, tabs.length - 1));
      const nextFile = tabs[activeTabIndex] || null;
      return { ...node, filePath: nextFile, tabs, activeTabIndex };
    }
    if (node.type === 'pane' && node.id === toPaneId) {
      const tabs = node.tabs.includes(filePath) ? node.tabs : [...node.tabs, filePath];
      return { ...node, filePath, tabs, activeTabIndex: tabs.indexOf(filePath) };
    }
    return node;
  });
}

export function resizeSplit(tree: SplitNode, splitId: string, deltaWeight: number): SplitNode {
  return walk(tree, (node) => {
    if (node.type === 'split' && node.id === splitId) {
      const [w1, w2] = node.weights;
      const newW1 = Math.max(0.1, Math.min(10, w1 + deltaWeight));
      const newW2 = Math.max(0.1, Math.min(10, w2 - deltaWeight));
      return { ...node, weights: [newW1, newW2] };
    }
    return node;
  });
}

export function setActiveTab(tree: SplitNode, paneId: string, tabIndex: number): SplitNode {
  return walk(tree, (node) => {
    if (node.type === 'pane' && node.id === paneId) {
      const idx = Math.max(0, Math.min(tabIndex, node.tabs.length - 1));
      return { ...node, activeTabIndex: idx, filePath: node.tabs[idx] || null };
    }
    return node;
  });
}

export function closeTab(tree: SplitNode, paneId: string, filePath: string): SplitNode {
  return walk(tree, (node) => {
    if (node.type === 'pane' && node.id === paneId) {
      const tabs = node.tabs.filter((t) => t !== filePath);
      const activeTabIndex = Math.min(node.activeTabIndex, Math.max(0, tabs.length - 1));
      return { ...node, tabs, activeTabIndex, filePath: tabs[activeTabIndex] || null };
    }
    return node;
  });
}

export function findPane(tree: SplitNode, paneId: string): SplitPaneNode | null {
  if (tree.type === 'pane') return tree.id === paneId ? tree : null;
  return findPane(tree.children[0], paneId) || findPane(tree.children[1], paneId);
}

export function flattenPanes(tree: SplitNode): SplitPaneNode[] {
  if (tree.type === 'pane') return [tree];
  return [...flattenPanes(tree.children[0]), ...flattenPanes(tree.children[1])];
}

function walk(node: SplitNode, fn: (n: SplitNode) => SplitNode): SplitNode {
  const next = fn(node);
  if (next.type === 'split') {
    return { ...next, children: [walk(next.children[0], fn), walk(next.children[1], fn)] as [SplitNode, SplitNode] };
  }
  return next;
}
