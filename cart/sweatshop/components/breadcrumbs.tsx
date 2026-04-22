const React: any = require('react');
const { useState } = React;

import { Box, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS, fileGlyph, fileTone } from '../theme';
import { Glyph } from './shared';

function crumbPath(items: any[], idx: number): string {
  if (items[idx].kind === 'home') return '__landing__';
  if (items[idx].kind === 'workspace') return '.';
  if (items[idx].kind === 'settings') return '__settings__';
  const parts: string[] = [];
  for (let i = 2; i <= idx; i++) {
    parts.push(items[i].label);
  }
  return parts.join('/');
}

function parentPath(path: string): string {
  if (!path || path === '.' || path === '__landing__' || path === '__settings__') return '.';
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx) : '.';
}

function siblingsForPath(path: string, files?: any[]): any[] {
  if (!files || files.length === 0) return [];
  const parent = parentPath(path);
  const out: any[] = [];
  const seen: Record<string, boolean> = {};
  for (const f of files) {
    const p = parentPath(f.path);
    if (p === parent && f.path !== path) {
      if (!seen[f.path]) {
        seen[f.path] = true;
        out.push(f);
      }
    }
  }
  return out.sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export function BreadcrumbBar(props: any) {
  const { items, compact, onOpenHome, onSelectPath, files, symbols } = props;
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [pathOpen, setPathOpen] = useState(false);

  if (!items || items.length === 0) return null;

  const maxVisible = compact ? 3 : 5;
  const collapsed = items.length > maxVisible;

  const renderSegment = (crumb: any, idx: number) => {
    const isLast = idx === items.length - 1;
    const path = crumbPath(items, idx);
    const siblings = siblingsForPath(path, files);
    const showSymbols = isLast && symbols && symbols.length > 0;
    const dropdownOpen = openIdx === idx;

    return (
      <Row key={crumb.label + '_' + idx} style={{ alignItems: 'center', gap: compact ? 2 : 4, flexShrink: 0 }}>
        {idx > 0 ? <Text fontSize={9} color={COLORS.textDim}>{'>'}</Text> : null}
        <Pressable
          onPress={() => {
            if (crumb.kind === 'home' || crumb.kind === 'workspace') {
              if (onOpenHome) onOpenHome();
            } else {
              setOpenIdx(dropdownOpen ? null : idx);
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
        </Pressable>

        {dropdownOpen && !showSymbols ? (
          <Box style={{
            position: 'absolute',
            top: 26,
            left: 0,
            backgroundColor: COLORS.panelRaised,
            borderRadius: TOKENS.radiusMd,
            borderWidth: 1,
            borderColor: COLORS.border,
            minWidth: 180,
            maxHeight: 260,
          }}>
            <ScrollView>
              {siblings.length > 0 ? (
                siblings.map((sib: any) => (
                  <Pressable
                    key={sib.path}
                    onPress={() => {
                      if (onSelectPath) onSelectPath(sib.path);
                      setOpenIdx(null);
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
                    <Glyph icon={fileGlyph(sib.type)} tone={fileTone(sib.type)} backgroundColor={COLORS.grayChip} tiny={true} />
                    <Text fontSize={11} color={COLORS.text}>{sib.name}</Text>
                  </Pressable>
                ))
              ) : (
                <Box style={{ padding: 10 }}>
                  <Text fontSize={10} color={COLORS.textDim}>No siblings</Text>
                </Box>
              )}
            </ScrollView>
          </Box>
        ) : null}

        {dropdownOpen && showSymbols ? (
          <Box style={{
            position: 'absolute',
            top: 26,
            left: 0,
            backgroundColor: COLORS.panelRaised,
            borderRadius: TOKENS.radiusMd,
            borderWidth: 1,
            borderColor: COLORS.border,
            minWidth: 200,
            maxHeight: 260,
          }}>
            <ScrollView>
              <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
                <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>SYMBOLS</Text>
              </Box>
              {symbols.map((sym: string, sidx: number) => (
                <Pressable key={sidx} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
                  <Text fontSize={11} color={COLORS.text}>{sym}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Box>
        ) : null}
      </Row>
    );
  };

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
              }}>
                <ScrollView>
                  {items.map((crumb: any, idx: number) => (
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
        items.map((crumb: any, idx: number) => renderSegment(crumb, idx))
      )}
    </Row>
  );
}
