import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, fileTone } from '../../theme';
import { Icon } from '../icons';

export interface FileTreeRowProps {
  name: string;
  path: string;
  type: string;
  indent: number;
  expanded: boolean;
  selected: boolean;
  git: string;
  hot: boolean;
  indentWidth: number;
  showHidden: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  onRightClick?: () => void;
}

function gitGutterColor(gitStatus: string): string | null {
  if (!gitStatus) return null;
  const code = gitStatus.trim();
  if (code.startsWith('A') || code.startsWith('M') || code.startsWith('D') || code.startsWith('R')) return COLORS.green;
  if (code === '??' || code.startsWith('?')) return COLORS.blue;
  if (code.includes('M') || code.includes('D')) return COLORS.yellow;
  if (code.includes('R') || code.includes('C')) return COLORS.purple;
  return COLORS.textMuted;
}

export function FileTreeRow(props: FileTreeRowProps) {
  const {
    name, type, indent, expanded, selected, git, hot,
    indentWidth, onSelect, onToggle, onRightClick,
  } = props;

  const isDir = type === 'dir';
  const gitGutter = gitGutterColor(git);

  return (
    <Pressable
      onPress={onSelect}
      onRightClick={onRightClick}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 10 + indent * indentWidth,
        paddingRight: 10,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: 10,
        backgroundColor: selected ? COLORS.panelHover : hot ? COLORS.panelRaised : 'transparent',
        borderLeftWidth: gitGutter ? 3 : 0,
        borderColor: gitGutter || 'transparent',
      }}
    >
      {/* Expand chevron */}
      <Pressable onPress={onToggle} style={{ padding: 2 }}>
        <Text fontSize={9} color={COLORS.textDim}>
          {isDir ? (expanded ? 'v' : '>') : ''}
        </Text>
      </Pressable>

      {/* Icon */}
      <Icon
        name={isDir ? 'folder' : 'file'}
        size={14}
        color={isDir ? COLORS.textMuted : fileTone(type)}
      />

      {/* Name */}
      <Text
        fontSize={11}
        color={selected ? COLORS.textBright : COLORS.text}
        style={{ flexGrow: 1, flexBasis: 0 }}
      >
        {name}
      </Text>

      {/* Hot indicator */}
      {hot ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.blue }} /> : null}

      {/* Drag handle */}
      <Text fontSize={10} color={COLORS.textDim} style={{ opacity: 0.4 }}>
        {'\u22ee\u22ee'}
      </Text>
    </Pressable>
  );
}
