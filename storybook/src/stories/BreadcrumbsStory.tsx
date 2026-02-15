import React, { useState } from 'react';
import { Box, Text, Breadcrumbs } from '../../../../packages/shared/src';
import type { BreadcrumbItem } from '../../../../packages/shared/src';

const SHORT_PATH: BreadcrumbItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'products', label: 'Products' },
  { id: 'widget', label: 'Widget Pro' },
];

const DEEP_PATH: BreadcrumbItem[] = [
  { id: 'root', label: 'Root' },
  { id: 'users', label: 'Users' },
  { id: 'alice', label: 'Alice' },
  { id: 'projects', label: 'Projects' },
  { id: 'webapp', label: 'Web App' },
];

export function BreadcrumbsStory() {
  const [path, setPath] = useState(DEEP_PATH);

  const handleNavigate = (id: string) => {
    const idx = path.findIndex(item => item.id === id);
    if (idx >= 0) {
      setPath(path.slice(0, idx + 1));
    }
  };

  const handleReset = () => setPath(DEEP_PATH);

  return (
    <Box style={{ gap: 20, padding: 16 }}>

      {/* Basic Breadcrumbs */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Basic Breadcrumbs</Text>
        <Breadcrumbs items={SHORT_PATH} />
      </Box>

      {/* Deep Path */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Deep Path</Text>
        <Breadcrumbs items={DEEP_PATH} />
      </Box>

      {/* Custom Separators */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Custom Separators</Text>
        <Box style={{ gap: 8 }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: '#64748b', fontSize: 10 }}>Arrow</Text>
            <Breadcrumbs items={SHORT_PATH} separator=">" />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: '#64748b', fontSize: 10 }}>Dot</Text>
            <Breadcrumbs items={SHORT_PATH} separator="." />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: '#64748b', fontSize: 10 }}>Dash</Text>
            <Breadcrumbs items={SHORT_PATH} separator="-" />
          </Box>
        </Box>
      </Box>

      {/* Interactive */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Interactive (click to navigate back)</Text>
        <Breadcrumbs items={path} onSelect={handleNavigate} />
        {path.length < DEEP_PATH.length && (
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 10 }}>
              {`Navigated to: ${path[path.length - 1].label}`}
            </Text>
            <Box
              style={{
                backgroundColor: '#334155',
                borderRadius: 4,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 3,
                paddingBottom: 3,
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 10 }} onPress={handleReset}>Reset</Text>
            </Box>
          </Box>
        )}
      </Box>

    </Box>
  );
}
