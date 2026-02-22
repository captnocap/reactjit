import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Box style={{
      width: '100%',
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      gap: 6,
    }}>
      <Text style={{ fontSize: 14, color: c.text }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 11, color: c.muted }}>{subtitle}</Text>}
      {children}
    </Box>
  );
}

function Badge({ label, color }: { label: string; color?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
      borderRadius: 999,
      backgroundColor: color ?? c.primary,
    }}>
      <Text style={{ fontSize: 10, color: '#fff' }}>{label}</Text>
    </Box>
  );
}

function Divider() {
  const c = useThemeColors();
  return <Box style={{ width: '100%', height: 1, backgroundColor: c.border }} />;
}

export function CompositionStory() {
  const c = useThemeColors();
  const [count, setCount] = useState(0);

  return (
    <Box style={{ width: '100%', padding: 16, alignItems: 'center' }}>
      <Box style={{ width: '100%', maxWidth: 760, gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 12 }}>1. Card</Text>
        <Card title="Basic Card" subtitle="Cards wrap content with elevation and a border">
          <Text style={{ fontSize: 11, color: c.muted }}>Any content goes inside.</Text>
        </Card>

        <Text style={{ color: c.text, fontSize: 12 }}>2. Badge</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          flexDirection: 'row',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <Badge label="default" />
          <Badge label="success" color="#22c55e" />
          <Badge label="warning" color="#f97316" />
          <Badge label="danger" color="#ef4444" />
          <Badge label="info" color="#3b82f6" />
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>3. Divider</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 10,
        }}>
          <Text style={{ fontSize: 12, color: c.text }}>Section A</Text>
          <Divider />
          <Text style={{ fontSize: 12, color: c.text }}>Section B</Text>
          <Divider />
          <Text style={{ fontSize: 12, color: c.text }}>Section C</Text>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>4. Composed (Card + Badge + Divider)</Text>
        <Card title="Notification" subtitle="3 unread items">
          <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge label="new" color="#22c55e" />
            <Badge label="urgent" color="#ef4444" />
          </Box>
          <Divider />
          <Box style={{ gap: 6 }}>
            {['Alert: system ready', 'Update available', 'Build passed'].map((msg, i) => (
              <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                <Text style={{ fontSize: 11, color: c.text }}>{msg}</Text>
              </Box>
            ))}
          </Box>
        </Card>

        <Text style={{ color: c.text, fontSize: 12 }}>5. Interactive counter</Text>
        <Card title="Counter">
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable
              onPress={() => setCount(v => v - 1)}
              style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 18, color: c.text }}>-</Text>
            </Pressable>
            <Text style={{ fontSize: 20, color: c.text, width: 40 }}>{String(count)}</Text>
            <Pressable
              onPress={() => setCount(v => v + 1)}
              style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 18, color: '#fff' }}>+</Text>
            </Pressable>
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
