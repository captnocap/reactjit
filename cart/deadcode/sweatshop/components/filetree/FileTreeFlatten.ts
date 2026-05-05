// ── Tree → Flat Visible List ─────────────────────────────────────────

export interface TreeNode {
  name: string;
  path: string;
  type: 'workspace' | 'dir' | 'file';
  dirs?: Record<string, TreeNode>;
  files?: Array<{ name: string; path: string; type: string }>;
}

export interface FlatNode {
  name: string;
  path: string;
  type: string;
  indent: number;
  expanded: boolean;
  selected: boolean;
  git: string;
  hot: boolean;
}

export interface FileItemLike {
  name: string;
  path: string;
  type: string;
  indent: number;
  expanded: number;
  selected: number;
  visible: number;
  git: string;
  hot: number;
}

/** Flatten a raw tree into a visible list respecting expansion state. */
export function flattenTree(
  node: TreeNode,
  expandedPaths: Set<string>,
  depth = 0,
  out: FlatNode[] = []
): FlatNode[] {
  const isExpanded = expandedPaths.has(node.path) || node.type === 'workspace';

  if (node.type !== 'workspace') {
    out.push({
      name: node.name,
      path: node.path,
      type: node.type,
      indent: depth,
      expanded: isExpanded,
      selected: false,
      git: '',
      hot: false,
    });
  }

  if (!isExpanded && node.type !== 'workspace') return out;

  const nextDepth = node.type === 'workspace' ? 0 : depth + 1;

  const dirNames = node.dirs ? Object.keys(node.dirs).sort() : [];
  for (const dirName of dirNames) {
    flattenTree(node.dirs![dirName], expandedPaths, nextDepth, out);
  }

  const fileList = node.files || [];
  const sortedFiles = [...fileList].sort((a, b) => {
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  for (const file of sortedFiles) {
    out.push({
      name: file.name,
      path: file.path,
      type: file.type,
      indent: nextDepth,
      expanded: false,
      selected: false,
      git: '',
      hot: false,
    });
  }

  return out;
}

/** Recompute visibility from a pre-flattened FileItem list + expansion override. */
export function rebuildVisibleFromFlat(
  items: FileItemLike[],
  expandedPaths: Set<string>,
  showHidden: boolean
): FlatNode[] {
  const out: FlatNode[] = [];

  for (const item of items) {
    if (!showHidden && item.name.startsWith('.')) continue;

    if (item.type === 'workspace') {
      out.push({
        name: item.name,
        path: item.path,
        type: item.type,
        indent: item.indent,
        expanded: true,
        selected: !!item.selected,
        git: item.git,
        hot: !!item.hot,
      });
      continue;
    }

    let visible = true;
    let parent = parentOf(item.path);
    while (parent !== '.' && parent.length > 0) {
      const parentItem = items.find((it) => it.path === parent);
      if (parentItem && !expandedPaths.has(parent) && parentItem.type !== 'workspace') {
        visible = false;
        break;
      }
      parent = parentOf(parent);
    }

    if (!visible) continue;

    const isDir = item.type === 'dir';
    out.push({
      name: item.name,
      path: item.path,
      type: item.type,
      indent: item.indent,
      expanded: isDir ? expandedPaths.has(item.path) : false,
      selected: !!item.selected,
      git: item.git,
      hot: !!item.hot,
    });
  }

  return out;
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return '.';
  return path.slice(0, idx);
}
