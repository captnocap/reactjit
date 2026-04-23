import { Box, Col, Pressable, Text } from '../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface ContextMenuAction {
  id: string;
  label: string;
  tone?: string;
  action: () => void;
}

export interface FileTreeContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  path: string;
  onDismiss: () => void;
  onOpen?: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onNewFile?: (dirPath: string) => void;
  onNewFolder?: (dirPath: string) => void;
  onCopyPath?: (path: string) => void;
}

export function FileTreeContextMenu({
  visible,
  x,
  y,
  path,
  onDismiss,
  onOpen,
  onRename,
  onDelete,
  onNewFile,
  onNewFolder,
  onCopyPath,
}: FileTreeContextMenuProps) {
  if (!visible) return null;

  const items: ContextMenuAction[] = [];
  if (onOpen) items.push({ id: 'open', label: 'Open', action: () => { onOpen(path); onDismiss(); } });
  if (onRename) items.push({ id: 'rename', label: 'Rename', action: () => { onRename(path); onDismiss(); } });
  if (onDelete) items.push({ id: 'delete', label: 'Delete', tone: COLORS.red, action: () => { onDelete(path); onDismiss(); } });
  items.push({ id: 'sep', label: '', action: () => {} });
  if (onNewFile) items.push({ id: 'new-file', label: 'New File', action: () => { onNewFile(path); onDismiss(); } });
  if (onNewFolder) items.push({ id: 'new-folder', label: 'New Folder', action: () => { onNewFolder(path); onDismiss(); } });
  items.push({ id: 'sep2', label: '', action: () => {} });
  if (onCopyPath) items.push({ id: 'copy-path', label: 'Copy Path', action: () => { onCopyPath(path); onDismiss(); } });

  return (
    <Box
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 200,
        backgroundColor: COLORS.panelRaised,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 6,
        minWidth: 160,
        shadowColor: 'rgba(0,0,0,0.4)',
        shadowRadius: 12,
      }}
    >
      <Col style={{ gap: 2 }}>
        {items.map((item) =>
          item.id.startsWith('sep') ? (
            <Box key={item.id} style={{ height: 1, backgroundColor: COLORS.border, marginTop: 4, marginBottom: 4 }} />
          ) : (
            <Pressable
              key={item.id}
              onPress={item.action}
              style={{
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 7,
                paddingBottom: 7,
                borderRadius: 6,
              }}
            >
              <Text fontSize={11} color={item.tone || COLORS.textBright}>
                {item.label}
              </Text>
            </Pressable>
          )
        )}
      </Col>
    </Box>
  );
}
