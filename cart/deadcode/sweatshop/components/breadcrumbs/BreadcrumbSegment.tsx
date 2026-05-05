import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Glyph } from '../shared';
import { BreadcrumbDropdown } from './BreadcrumbDropdown';
import { BreadcrumbSymbols } from './BreadcrumbSymbols';
import type { Breadcrumb, FileItem } from '../../types';

export function BreadcrumbSegment(props: {
  crumb: Breadcrumb;
  idx: number;
  items: Breadcrumb[];
  compact?: boolean;
  isLast: boolean;
  siblings: FileItem[];
  hasSymbols: boolean;
  fileContent?: string;
  onOpenHome?: () => void;
  onSelectPath?: (path: string) => void;
  onSelectLine?: (line: number) => void;
  openIdx: number | null;
  onToggleOpen: (idx: number) => void;
}) {
  const {
    crumb,
    idx,
    items,
    compact,
    isLast,
    siblings,
    hasSymbols,
    fileContent,
    onOpenHome,
    onSelectPath,
    onSelectLine,
    openIdx,
    onToggleOpen,
  } = props;

  const dropdownOpen = openIdx === idx;
  const showSymbols = isLast && hasSymbols && fileContent;

  return (
    <Row style={{ alignItems: 'center', gap: compact ? 2 : 4, flexShrink: 0 }}>
      {idx > 0 ? (
        <Text fontSize={9} color={COLORS.textDim}>{'>'}</Text>
      ) : null}

      <Pressable
        onPress={() => {
          if (crumb.kind === 'home' || crumb.kind === 'workspace') {
            if (onOpenHome) onOpenHome();
          } else {
            onToggleOpen(idx);
          }
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingLeft: compact ? 4 : 6,
          paddingRight: compact ? 4 : 6,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: dropdownOpen ? COLORS.panelHover : 'transparent',
        }}
      >
        <Glyph icon={crumb.icon} tone={crumb.tone} backgroundColor={COLORS.panelAlt} tiny={true} />
        <Text fontSize={11} color={crumb.active ? COLORS.textBright : COLORS.text}>
          {crumb.label}
        </Text>
        {crumb.meta ? <Text fontSize={10} color={COLORS.textDim}>{crumb.meta}</Text> : null}
        {(siblings.length > 0 || showSymbols) && !dropdownOpen ? (
          <Text fontSize={8} color={COLORS.textDim}>{'▾'}</Text>
        ) : null}
      </Pressable>

      {dropdownOpen && !showSymbols && onSelectPath ? (
        <BreadcrumbDropdown
          siblings={siblings}
          onSelectPath={onSelectPath}
          onClose={() => onToggleOpen(idx)}
        />
      ) : null}

      {dropdownOpen && showSymbols ? (
        <BreadcrumbSymbols
          fileContent={fileContent!}
          onSelectLine={onSelectLine}
          onClose={() => onToggleOpen(idx)}
        />
      ) : null}
    </Row>
  );
}
