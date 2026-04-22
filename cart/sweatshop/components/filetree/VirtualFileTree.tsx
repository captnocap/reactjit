// ── Virtual File Tree ────────────────────────────────────────────────


import { Box, Col, ScrollView } from '../../../runtime/primitives';
import { FileItemLike, rebuildVisibleFromFlat } from './FileTreeFlatten';
import { FileTreeContextMenu } from './FileTreeContextMenu';
import { FileTreeRow } from './FileTreeRow';
import { FileTreeSearch } from './FileTreeSearch';
import { useFileTreeExpansion } from './useFileTreeExpansion';
import { useFileTreeVirtual } from './useFileTreeVirtual';

export interface VirtualFileTreeProps {
  files: FileItemLike[];
  currentFilePath?: string;
  onSelectPath: (path: string) => void;
  onToggleDir?: (path: string) => void;
  rowHeight?: number;
  viewportHeight?: number;
  overscan?: number;
  indentWidth?: number;
  showHidden?: boolean;
  onContextOpen?: (path: string) => void;
  onContextRename?: (path: string) => void;
  onContextDelete?: (path: string) => void;
  onContextNewFile?: (dirPath: string) => void;
  onContextNewFolder?: (dirPath: string) => void;
  onContextCopyPath?: (path: string) => void;
}

export function VirtualFileTree(props: VirtualFileTreeProps) {
  const {
    files, currentFilePath, onSelectPath, onToggleDir,
    rowHeight = 34, viewportHeight = 720, overscan = 12,
    indentWidth = 14, showHidden = true,
    onContextOpen, onContextRename, onContextDelete,
    onContextNewFile, onContextNewFolder, onContextCopyPath,
  } = props;

  const [searchQuery, setSearchQuery] = useState('');
  const [menu, setMenu] = useState<{ visible: boolean; x: number; y: number; path: string } | null>(null);
  const expansion = useFileTreeExpansion();

  const visibleFlat = useMemo(
    () => rebuildVisibleFromFlat(files, expansion.expandedPaths, showHidden),
    [files, expansion.expandedPaths, showHidden]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return visibleFlat;
    const q = searchQuery.toLowerCase();
    return visibleFlat.filter((n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q));
  }, [visibleFlat, searchQuery]);

  const virtual = useFileTreeVirtual(filtered, rowHeight, viewportHeight, overscan);

  const handleSelect = useCallback((path: string) => {
    const item = files.find((f) => f.path === path);
    if (item && item.type === 'dir') {
      expansion.togglePath(path);
      onToggleDir?.(path);
    } else {
      onSelectPath(path);
    }
  }, [files, expansion, onSelectPath, onToggleDir]);

  const handleToggle = useCallback((path: string) => {
    expansion.togglePath(path);
    onToggleDir?.(path);
  }, [expansion, onToggleDir]);

  return (
    <Box style={{ flexGrow: 1, height: '100%', position: 'relative' }}>
      <FileTreeSearch query={searchQuery} onChange={setSearchQuery} resultCount={filtered.length} totalCount={visibleFlat.length} />
      <ScrollView
        showScrollbar={true}
        style={{ flexGrow: 1, paddingLeft: 8, paddingRight: 8, paddingBottom: 12 }}
        onScroll={(p: any) => {
          const y = typeof p?.scrollY === 'number' ? p.scrollY : 0;
          if (Math.abs(y - virtual.scrollY) >= rowHeight / 2) virtual.setScrollY(y);
        }}
      >
        <Col style={{ gap: 4 }}>
          {virtual.topSpacer > 0 ? <Box style={{ height: virtual.topSpacer }} /> : null}
          {virtual.items.map((file) => (
            <FileTreeRow
              key={file.path + '_' + file.indent}
              name={file.name} path={file.path} type={file.type} indent={file.indent}
              expanded={file.expanded} selected={file.path === currentFilePath || file.selected}
              git={file.git} hot={file.hot} indentWidth={indentWidth} showHidden={showHidden}
              onSelect={() => handleSelect(file.path)}
              onToggle={file.type === 'dir' ? () => handleToggle(file.path) : undefined}
              onRightClick={() => setMenu({ visible: true, x: 16, y: 16, path: file.path })}
            />
          ))}
          {virtual.bottomSpacer > 0 ? <Box style={{ height: virtual.bottomSpacer }} /> : null}
        </Col>
      </ScrollView>
      {menu && (
        <FileTreeContextMenu visible={menu.visible} x={menu.x} y={menu.y} path={menu.path}
          onDismiss={() => setMenu(null)} onOpen={onContextOpen} onRename={onContextRename}
          onDelete={onContextDelete} onNewFile={onContextNewFile} onNewFolder={onContextNewFolder}
          onCopyPath={onContextCopyPath} />
      )}
    </Box>
  );
}
