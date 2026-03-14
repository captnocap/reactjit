import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { DocsSidebar } from './DocsSidebar';
import { DocPage } from './DocPage';
import { FontScaleProvider, useDocsFontScale } from './DocsFontScale';

interface ContentData {
  sections: Record<string, Record<string, any>>;
  allFiles: any[];
}

interface DocsViewerProps {
  content: ContentData;
}

function ZoomControls() {
  const c = useThemeColors();
  const { scale, increase, decrease, reset } = useDocsFontScale();
  const pct = Math.round(scale * 100);
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 2, width: 200,
      paddingTop: 6, paddingBottom: 6,
      borderTopWidth: 1, borderTopColor: c.border,
      backgroundColor: c.bg,
    }}>
      <Pressable onPress={decrease} style={{
        width: 22, height: 22, borderRadius: 4,
        backgroundColor: c.border, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 16 }}>{`-`}</Text>
      </Pressable>
      <Pressable onPress={reset} style={{
        width: 36, height: 22, borderRadius: 4,
        backgroundColor: c.border, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: c.textDim, fontSize: 9, lineHeight: 14 }}>{`${pct}%`}</Text>
      </Pressable>
      <Pressable onPress={increase} style={{
        width: 22, height: 22, borderRadius: 4,
        backgroundColor: c.border, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 16 }}>{`+`}</Text>
      </Pressable>
    </Box>
  );
}

function DocsViewerInner({ content }: DocsViewerProps) {
  const c = useThemeColors();
  const [activeSectionId, setActiveSectionId] = useState('01-getting-started');
  const [activeFileKey, setActiveFileKey] = useState('index');

  const handleSelect = (sectionId: string, fileKey: string) => {
    setActiveSectionId(sectionId);
    setActiveFileKey(fileKey);
  };

  const activeContent = content.sections[activeSectionId]?.[activeFileKey];

  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
      {/* Sidebar + zoom controls */}
      <Box style={{ width: 200, height: '100%' }}>
        <Box style={{ flexGrow: 1, overflow: 'scroll' }}>
          <DocsSidebar
            sections={content.sections}
            activeSectionId={activeSectionId}
            activeFileKey={activeFileKey}
            onSelect={handleSelect}
          />
        </Box>
        <ZoomControls />
      </Box>

      {/* Content area */}
      <Box style={{ flexGrow: 1, backgroundColor: c.bgElevated, overflow: 'scroll' }}>
        {activeContent ? (
          <DocPage content={activeContent} onNavigate={handleSelect} currentSectionId={activeSectionId} />
        ) : (
          <Box style={{ padding: 20 }}>
            <Box style={{ height: 0 }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function DocsViewer({ content }: DocsViewerProps) {
  return (
    <FontScaleProvider>
      <DocsViewerInner content={content} />
    </FontScaleProvider>
  );
}
