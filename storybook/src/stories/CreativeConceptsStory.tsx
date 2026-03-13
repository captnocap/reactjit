import React, { useState } from 'react';
import { Box, CodeBlock, Pressable, ScrollView, Text, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { DashboardStatsPreview } from './creative-concepts/DashboardStatsPreview';
import { ModelSelectorPreview } from './creative-concepts/ModelSelectorPreview';
import { ResponseCardPreview } from './creative-concepts/ResponseCardPreview';
import { CREATIVE_COLORS } from './creative-concepts/shared';
import { CREATIVE_TABS } from './creative-concepts/tabs';
import { WidgetGridPreview } from './creative-concepts/WidgetGridPreview';

function renderPreview(tabId: string) {
  switch (tabId) {
    case 'response-card':
      return <ResponseCardPreview />;
    case 'model-selector':
      return <ModelSelectorPreview />;
    case 'dashboard-stats':
      return <DashboardStatsPreview />;
    case 'widget-grid':
      return <WidgetGridPreview />;
    default:
      return null;
  }
}

function VerticalDivider() {
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

export function CreativeConceptsStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(CREATIVE_TABS[0].id);
  const tab = CREATIVE_TABS.find((item) => item.id === activeId) || CREATIVE_TABS[0];

  return (
    <S.StoryRoot>
      <S.RowCenterBorder
        style={{
          flexShrink: 0,
          backgroundColor: c.bgElevated,
          borderBottomWidth: 1,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 12,
          paddingBottom: 12,
          gap: 14,
        }}
      >
        <S.StoryHeaderIcon src="sparkles" tintColor={CREATIVE_COLORS.accent} />
        <S.StoryTitle>{'CreativeConcepts'}</S.StoryTitle>
        <Box
          style={{
            backgroundColor: CREATIVE_COLORS.accentSoft,
            borderRadius: 4,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 3,
            paddingBottom: 3,
          }}
        >
          <Text style={{ color: CREATIVE_COLORS.accent, fontSize: 10 }}>{'@reactjit/creativeconcepts'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Interactive AI interface concepts built as reusable story components'}</S.StoryMuted>
      </S.RowCenterBorder>

      <S.BorderBottom style={{ flexGrow: 1 }}>{renderPreview(tab.id)}</S.BorderBottom>

      <Box
        style={{
          height: 140,
          flexShrink: 0,
          flexDirection: 'row',
          borderTopWidth: 1,
          borderColor: c.border,
          backgroundColor: c.bgElevated,
          overflow: 'hidden',
        }}
      >
        <S.Half
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 12,
            paddingBottom: 12,
            gap: 6,
          }}
        >
          <S.BoldText style={{ fontSize: 14 }}>{tab.label}</S.BoldText>
          <S.StoryMuted>{tab.desc}</S.StoryMuted>
        </S.Half>

        <VerticalDivider />

        <S.Half
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 12,
            paddingBottom: 12,
            gap: 6,
          }}
        >
          <S.StoryLabelText>{'USAGE'}</S.StoryLabelText>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </S.Half>

        <VerticalDivider />

        <S.Half
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 12,
            paddingBottom: 12,
            gap: 6,
          }}
        >
          <S.StoryLabelText>{'PROPS'}</S.StoryLabelText>
          <Box style={{ gap: 4 }}>
            {tab.props.map(([name, type]) => (
              <S.RowCenterG5 key={name}>
                <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                <S.StoryCap>{type}</S.StoryCap>
              </S.RowCenterG5>
            ))}
          </Box>
          {tab.callbacks.length > 0 ? (
            <>
              <S.StoryDivider />
              <S.StoryLabelText>{'CALLBACKS'}</S.StoryLabelText>
              <Box style={{ gap: 4 }}>
                {tab.callbacks.map(([name, type]) => (
                  <S.RowCenterG5 key={name}>
                    <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                    <S.StoryCap>{type}</S.StoryCap>
                  </S.RowCenterG5>
                ))}
              </Box>
            </>
          ) : null}
        </S.Half>
      </Box>

      <ScrollView
        style={{
          height: 86,
          flexShrink: 0,
          borderTopWidth: 1,
          borderColor: c.border,
          backgroundColor: c.bgElevated,
        }}
      >
        <S.RowG8
          style={{
            flexWrap: 'wrap',
            justifyContent: 'center',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          {CREATIVE_TABS.map((item) => {
            const active = item.id === activeId;

            return (
              <Pressable key={item.id} onPress={() => setActiveId(item.id)}>
                <Box
                  style={{
                    width: 116,
                    height: 50,
                    backgroundColor: active ? CREATIVE_COLORS.accentSoft : c.surface,
                    borderRadius: 8,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? CREATIVE_COLORS.accent : c.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: active ? CREATIVE_COLORS.accent : c.muted,
                      fontSize: 10,
                      fontWeight: active ? 'bold' : 'normal',
                    }}
                  >
                    {item.label}
                  </Text>
                </Box>
              </Pressable>
            );
          })}
        </S.RowG8>
      </ScrollView>

      <S.RowCenterBorder
        style={{
          flexShrink: 0,
          backgroundColor: c.bgElevated,
          borderTopWidth: 1,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 6,
          paddingBottom: 6,
          gap: 12,
        }}
      >
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Demos'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.DimIcon12 src="sparkles" />
        <S.StoryCap>{'CreativeConcepts'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.StoryBreadcrumbActive>{tab.label}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${CREATIVE_TABS.indexOf(tab) + 1} of ${CREATIVE_TABS.length}`}</S.StoryCap>
      </S.RowCenterBorder>
    </S.StoryRoot>
  );
}
