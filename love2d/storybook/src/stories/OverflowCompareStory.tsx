/**
 * OverflowCompare — side-by-side view of three overflow strategies.
 *
 * Same row of cards, same container width, three different behaviors:
 *   Left:   Default (overflow — cards escape the box)
 *   Middle: Wrap    (flexWrap: 'wrap' — cards fold to next row)
 *   Right:  Scale   (scaleToFit — cards shrink uniformly to fit)
 */

import React from 'react';
import { Box, Text, ScrollView, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7',
];

const CARD_W = 64;
const CARD_H = 64;
const CARD_GAP = 8;
const CARD_COUNT = 7;

function CardRow({ wrap, scaleToFit }: { wrap?: boolean; scaleToFit?: boolean }) {
  const c = useThemeColors();
  return (
    // rjit-ignore-next-line
    <Box style={{
      flexDirection: 'row',
      gap: CARD_GAP,
      flexWrap: wrap ? 'wrap' : 'nowrap',
      // @ts-ignore — scaleToFit is a painter-level prop
      scaleToFit: scaleToFit || undefined,
    }}>
      {COLORS.map((color, i) => (
        <Box key={i} style={{
          width: CARD_W,
          height: CARD_H,
          backgroundColor: color,
          borderRadius: 6,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
            {String(i + 1)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function Panel({ label, subtitle, children }: { label: string; subtitle: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <S.Half style={{ gap: 12, padding: 16 }}>
      <Box style={{ gap: 4 }}>
        <S.BoldText style={{ fontSize: 14 }}>{label}</S.BoldText>
        <S.StoryMuted>{subtitle}</S.StoryMuted>
      </Box>
      {/* Container — deliberately narrower than card row content */}
      <Box style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderWidth: 2,
        borderColor: c.border,
        borderRadius: 8,
        padding: 10,
        overflow: 'hidden',
      }}>
        {children}
      </Box>
      <Box style={{ gap: 3 }}>
        <S.StoryCap>
          {`${CARD_COUNT} cards × ${CARD_W}px + gaps = ${CARD_COUNT * CARD_W + (CARD_COUNT - 1) * CARD_GAP}px total`}
        </S.StoryCap>
        <S.StoryCap>{'Container: fills panel width'}</S.StoryCap>
      </Box>
    </S.Half>
  );
}

function Divider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ alignSelf: 'stretch' }} />;
}

export function OverflowCompareStory() {
  const c = useThemeColors();

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      {/* Header */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 12 }}>
        <S.BoldText style={{ fontSize: 18 }}>{'Overflow Strategies'}</S.BoldText>
        <S.StoryBtnSm style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}>
          <Text style={{ color: '#6366f1', fontSize: 10 }}>{'Layouts'}</Text>
        </S.StoryBtnSm>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Same cards, same container, three different answers'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* Three panels */}
      <Box style={{ flexShrink: 0, flexDirection: 'row' }}>
        <Panel
          label="Default"
          subtitle="overflow: hidden clips — cards beyond the edge vanish"
        >
          <CardRow />
        </Panel>

        <Divider />

        <Panel
          label="Wrap"
          subtitle="flexWrap: 'wrap' — cards fold to the next row"
        >
          <CardRow wrap />
        </Panel>

        <Divider />

        <Panel
          label="Scale to Fit"
          subtitle="scaleToFit — all cards shrink uniformly to fit the box"
        >
          <CardRow scaleToFit />
        </Panel>
      </Box>

      {/* Horizontal section divider */}
      <S.StoryDivider />

      {/* Scale to fit — full width */}
      <Box style={{ flexShrink: 0, gap: 10, paddingLeft: 20, paddingRight: 20, paddingTop: 14, paddingBottom: 14, backgroundColor: c.bgElevated }}>
        <S.RowCenter style={{ gap: 10 }}>
          <S.StoryHeadline>{'Scale to Fit'}</S.StoryHeadline>
          <S.StoryMuted>{'full width — all cards visible, proportional, one row'}</S.StoryMuted>
        </S.RowCenter>
        <Box style={{ width: '100%', paddingLeft: 10, paddingRight: 10, paddingTop: 10, paddingBottom: 10, overflow: 'hidden' }}>
          <CardRow scaleToFit />
        </Box>
      </Box>
      <S.StoryDivider />

      {/* Footer note */}
      <Box style={{
        flexShrink: 0,
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20, paddingRight: 20,
        paddingTop: 8, paddingBottom: 8,
      }}>
        <S.StoryCap>
          {'scaleToFit is a painter-level transform — layout engine sees natural sizes, painter scales the result to fill the container width.'}
        </S.StoryCap>
      </Box>
    </ScrollView>
  );
}
