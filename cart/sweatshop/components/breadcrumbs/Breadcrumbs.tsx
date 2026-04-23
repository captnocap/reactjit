import { Box, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Glyph } from '../shared';
import { BreadcrumbSegment } from './BreadcrumbSegment';
import { useBreadcrumbScope, crumbPath } from './useBreadcrumbScope';
import type { Breadcrumb, FileItem } from '../../types';

export function BreadcrumbBar(props: {
  items: Breadcrumb[];
  compact?: boolean;
  onOpenHome?: () => void;
  onSelectPath?: (path: string) => void;
  onSelectLine?: (line: number) => void;
  files?: FileItem[];
  fileContent?: string;
}) {
  const { items, compact, onOpenHome, onSelectPath, onSelectLine, files, fileContent } = props;
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [pathOpen, setPathOpen] = useState(false);

  if (!items || items.length === 0) return null;

  const { scopes } = useBreadcrumbScope(items, files || []);
  const maxVisible = compact ? 3 : 5;
  const collapsed = items.length > maxVisible;

  const toggleOpen = (idx: number) => {
    setOpenIdx((prev) => (prev === idx ? null : idx));
  };

  const renderSegment = (crumb: Breadcrumb, idx: number) => (
    <BreadcrumbSegment
      key={crumb.label + '_' + idx}
      crumb={crumb}
      idx={idx}
      items={items}
      compact={compact}
      isLast={idx === items.length - 1}
      siblings={scopes[idx] || []}
      hasSymbols={!!fileContent && fileContent.length > 0}
      fileContent={fileContent}
      onOpenHome={onOpenHome}
      onSelectPath={onSelectPath}
      onSelectLine={onSelectLine}
      openIdx={openIdx}
      onToggleOpen={toggleOpen}
    />
  );

  return (
    <Row
      style={{
        paddingLeft: compact ? 10 : 12,
        paddingRight: compact ? 10 : 12,
        paddingTop: compact ? 7 : 9,
        paddingBottom: compact ? 7 : 9,
        gap: compact ? 2 : 4,
        alignItems: 'center',
        backgroundColor: COLORS.panelRaised,
        borderBottomWidth: 1,
        borderColor: COLORS.borderSoft,
      }}
    >
      {collapsed ? (
        <>
          {renderSegment(items[0], 0)}
          <Row style={{ alignItems: 'center', gap: compact ? 2 : 4, flexShrink: 0 }}>
            <Text fontSize={9} color={COLORS.textDim}>{'>'}</Text>
            <Pressable
              onPress={() => setPathOpen(!pathOpen)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingLeft: compact ? 4 : 6,
                paddingRight: compact ? 4 : 6,
                paddingTop: 3,
                paddingBottom: 3,
                borderRadius: TOKENS.radiusSm,
                backgroundColor: pathOpen ? COLORS.panelHover : 'transparent',
              }}
            >
              <Text fontSize={11} color={COLORS.textDim}>{'>>'}</Text>
            </Pressable>
            {pathOpen ? (
              <Box style={{
                position: 'absolute',
                top: 26,
                left: 0,
                backgroundColor: COLORS.panelRaised,
                borderRadius: TOKENS.radiusMd,
                borderWidth: 1,
                borderColor: COLORS.border,
                minWidth: 220,
                maxHeight: 300,
                zIndex: 20,
              }}>
                <ScrollView showScrollbar={true}>
                  {items.map((crumb: Breadcrumb, idx: number) => (
                    <Pressable
                      key={crumb.label + '_' + idx}
                      onPress={() => {
                        if (crumb.kind === 'home' || crumb.kind === 'workspace') {
                          if (onOpenHome) onOpenHome();
                        } else if (onSelectPath) {
                          onSelectPath(crumbPath(items, idx));
                        }
                        setPathOpen(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingLeft: 10,
                        paddingRight: 10,
                        paddingTop: 6,
                        paddingBottom: 6,
                      }}
                    >
                      <Glyph icon={crumb.icon} tone={crumb.tone} backgroundColor={COLORS.grayChip} tiny={true} />
                      <Text fontSize={11} color={crumb.active ? COLORS.textBright : COLORS.text}>{crumb.label}</Text>
                      {crumb.meta ? <Text fontSize={10} color={COLORS.textDim}>{crumb.meta}</Text> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </Box>
            ) : null}
          </Row>
          {renderSegment(items[items.length - 2], items.length - 2)}
          {renderSegment(items[items.length - 1], items.length - 1)}
        </>
      ) : (
        items.map((crumb: Breadcrumb, idx: number) => renderSegment(crumb, idx))
      )}
    </Row>
  );
}
