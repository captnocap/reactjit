import React, { useState } from 'react';
import { Box, Text, Pressable, Native, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

export function LoveReconcilerStory() {
  const c = useThemeColors();
  const [title, setTitle] = useState('Hello');
  const [subtitle, setSubtitle] = useState('from the Love reconciler');
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<string>('online');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      <ScrollView style={{ flexGrow: 1, padding: 24 }}>
        <Box style={{ gap: 16 }}>
          <Text style={{ fontSize: 20, color: c.text, fontWeight: 'bold' }}>
            {`Love Reconciler — Tree-Composed Capabilities`}
          </Text>
          <Text style={{ fontSize: 13, color: c.muted }}>
            {`Capabilities rendered via Tree.declareChildren() — no love.graphics draw calls. Subtrees composed from View/Text nodes, laid out and painted by the existing pipeline.`}
          </Text>

          {/* HelloCard — simple test */}
          <Native type="HelloCard" title={`${title} (${count})`} subtitle={subtitle} style={{ backgroundColor: '#2e3440', borderRadius: 10, padding: 20, gap: 8 }} />

          {/* Controls */}
          <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => setCount(n => n + 1)}
              style={{ backgroundColor: c.primary, borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}
            >
              <Text style={{ color: '#fff', fontSize: 13 }}>{`Increment`}</Text>
            </Pressable>
            <Pressable
              onPress={() => setTitle(t => t === 'Hello' ? 'Howdy' : 'Hello')}
              style={{ backgroundColor: c.surface, borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}
            >
              <Text style={{ color: c.text, fontSize: 13 }}>{`Toggle Title`}</Text>
            </Pressable>
            <Pressable
              onPress={() => setSubtitle(s => s === 'from the Love reconciler' ? 'Lua-side tree composition works!' : 'from the Love reconciler')}
              style={{ backgroundColor: c.surface, borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}
            >
              <Text style={{ color: c.text, fontSize: 13 }}>{`Toggle Subtitle`}</Text>
            </Pressable>
            <Pressable
              onPress={() => setStatus(s => { const o = ['online','away','busy','offline']; return o[(o.indexOf(s) + 1) % 4]; })}
              style={{ backgroundColor: c.surface, borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}
            >
              <Text style={{ color: c.text, fontSize: 13 }}>{`Status: ${status}`}</Text>
            </Pressable>
          </Box>

          {/* DashboardCard — the god component stress test */}
          <Native
            type="DashboardCard"
            username="siah"
            handle="@siah"
            avatarLetter="S"
            status={status}
            commits={847 + count}
            prs={63}
            issues={128}
            style={{ backgroundColor: '#2e3440', borderRadius: 12, padding: 20 }}
          />
        </Box>
      </ScrollView>
    </Box>
  );
}
