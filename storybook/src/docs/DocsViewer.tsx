import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable } from '../../../../packages/shared/src';
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
  const { scale, increase, decrease, reset } = useDocsFontScale();
  const pct = Math.round(scale * 100);
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 2, width: 200,
      paddingTop: 6, paddingBottom: 6,
      borderTopWidth: 1, borderTopColor: '#1e293b',
      backgroundColor: '#0c0c14',
    }}>
      <Pressable onPress={decrease} style={{
        width: 22, height: 22, borderRadius: 4,
        backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 16 }}>{`-`}</Text>
      </Pressable>
      <Pressable onPress={reset} style={{
        width: 36, height: 22, borderRadius: 4,
        backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#64748b', fontSize: 9, lineHeight: 14 }}>{`${pct}%`}</Text>
      </Pressable>
      <Pressable onPress={increase} style={{
        width: 22, height: 22, borderRadius: 4,
        backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 16 }}>{`+`}</Text>
      </Pressable>
    </Box>
  );
}

function DocsViewerInner({ content }: DocsViewerProps) {
  const [activeSectionId, setActiveSectionId] = useState('01-getting-started');
  const [activeFileKey, setActiveFileKey] = useState('index');

  const handleSelect = useCallback((sectionId: string, fileKey: string) => {
    setActiveSectionId(sectionId);
    setActiveFileKey(fileKey);
  }, []);

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
      <Box style={{ flexGrow: 1, backgroundColor: '#08080f', overflow: 'scroll' }}>
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
