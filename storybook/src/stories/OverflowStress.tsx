import React from 'react';
import { Box, Text, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// RGBA test colors — decorative, kept hardcoded
const rgbaTest = {
  accent: [0.35, 0.55, 0.95, 1] as [number, number, number, number],
  green: [0.2, 0.75, 0.4, 1] as [number, number, number, number],
  orange: [0.95, 0.65, 0.15, 1] as [number, number, number, number],
  red: [0.9, 0.3, 0.3, 1] as [number, number, number, number],
  purple: [0.6, 0.4, 0.9, 1] as [number, number, number, number],
};

function RGBADebugBar() {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 10, color: c.textDim }}>RGBA:</Text>
      {Object.entries(rgbaTest).map(([name, color]) => (
        <Box key={name} style={{ backgroundColor: color, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
          <Text style={{ fontSize: 9, color: '#ffffff' }}>{name}</Text>
        </Box>
      ))}
      <Text style={{ fontSize: 10, color: c.textDim }}>HEX:</Text>
      <Box style={{ backgroundColor: c.primary, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ fontSize: 9, color: '#ffffff' }}>accent</Text>
      </Box>
      <Box style={{ backgroundColor: c.success, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ fontSize: 9, color: '#ffffff' }}>green</Text>
      </Box>
      <Box style={{ backgroundColor: c.warning, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ fontSize: 9, color: '#ffffff' }}>orange</Text>
      </Box>
      <Box style={{ backgroundColor: c.error, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ fontSize: 9, color: '#ffffff' }}>red</Text>
      </Box>
      <Box style={{ backgroundColor: c.accent, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ fontSize: 9, color: '#ffffff' }}>purple</Text>
      </Box>
    </Box>
  );
}

function makeItems(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
}

function MiniCard({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 10, marginBottom: 6 }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>{title}</Text>
      </Box>
      <Text style={{ fontSize: 11, color: c.textDim, marginTop: 4 }}>{subtitle}</Text>
    </Box>
  );
}

function TallList({ items, color }: { items: string[]; color: string }) {
  const c = useThemeColors();
  return (
    <>
      {items.map((item, i) => (
        <Box key={i} style={{
          backgroundColor: i % 2 === 0 ? c.surface : c.surfaceHover,
          paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
          borderRadius: 4, marginBottom: 2,
        }}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
            <Text style={{ fontSize: 12, color: c.text }}>{item}</Text>
          </Box>
        </Box>
      ))}
    </>
  );
}

function PanelHeader({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Text style={{ fontSize: 13, color, fontWeight: 'normal' }}>{title}</Text>
      <Text style={{ fontSize: 10, color: c.textDim }}>{subtitle}</Text>
    </Box>
  );
}

function ScrollPanel({ title, subtitle, titleColor, children }: {
  title: string; subtitle: string; titleColor: string; children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ flexGrow: 1, backgroundColor: c.bgElevated, borderRadius: 8, overflow: 'hidden' }}>
      <PanelHeader title={title} subtitle={subtitle} color={titleColor} />
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 6 }}>{children}</Box>
      </ScrollView>
    </Box>
  );
}

export function OverflowStressStory() {
  const c = useThemeColors();
  const tagColors = [c.primary, c.success, c.warning, c.accent, c.error];

  const navItems = makeItems('Nav Link', 40);
  const logEntries = makeItems('Log entry', 60);
  const notifications = makeItems('Notification', 30);
  const fileList = makeItems('document_', 50).map((f, i) =>
    `${f}.${['tsx', 'lua', 'json', 'md', 'ts'][i % 5]}`
  );
  const chatMessages = makeItems('User message', 45);
  const tags = makeItems('Tag #', 80);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      {/* RGBA vs HEX comparison bar */}
      <RGBADebugBar />

      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>

      {/* Left sidebar */}
      <Box style={{ width: 160, height: '100%', backgroundColor: c.bgElevated, borderRightWidth: 1, borderRightColor: c.border }}>
        <PanelHeader title="Navigation" subtitle={`${navItems.length} items`} color={c.primary} />
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ padding: 4 }}>
            <TallList items={navItems} color={c.primary} />
          </Box>
        </ScrollView>
      </Box>

      {/* Center content */}
      <Box style={{ flexGrow: 1, height: '100%', padding: 8, gap: 8 }}>

        {/* Top row */}
        <Box style={{ flexDirection: 'row', gap: 8, flexGrow: 1 }}>
          <ScrollPanel title="System Logs" subtitle={`${logEntries.length} entries`} titleColor={c.success}>
            {logEntries.map((entry, i) => (
              <Box key={i} style={{
                paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
                marginBottom: 1,
                backgroundColor: i % 2 === 0 ? c.surface : c.surfaceHover,
                borderRadius: 3,
              }}>
                <Box style={{ flexDirection: 'row', gap: 6 }}>
                  <Text style={{ fontSize: 10, color: c.textDim }}>{String(i).padStart(3, '0')}</Text>
                  <Text style={{ fontSize: 11, color: i % 7 === 0 ? c.warning : c.text }}>{entry}</Text>
                </Box>
              </Box>
            ))}
          </ScrollPanel>

          <ScrollPanel title="Chat" subtitle={`${chatMessages.length} messages`} titleColor={c.accent}>
            {chatMessages.map((msg, i) => (
              <MiniCard
                key={i}
                title={`User ${(i % 5) + 1}`}
                subtitle={msg}
                color={tagColors[i % 5]}
              />
            ))}
          </ScrollPanel>
        </Box>

        {/* Bottom row */}
        <Box style={{ flexDirection: 'row', gap: 8, flexGrow: 1 }}>
          <ScrollPanel title="Files" subtitle={`${fileList.length} files`} titleColor={c.warning}>
            <TallList items={fileList} color={c.warning} />
          </ScrollPanel>

          <ScrollPanel title="Notifications" subtitle={`${notifications.length} alerts`} titleColor={c.error}>
            {notifications.map((n, i) => (
              <MiniCard
                key={i}
                title={n}
                subtitle={`Priority: ${['Low', 'Medium', 'High', 'Critical'][i % 4]}`}
                color={[c.textDim, c.warning, c.error, c.error][i % 4]}
              />
            ))}
          </ScrollPanel>
        </Box>

        {/* Tag bar */}
        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, overflow: 'hidden', height: 50 }}>
          <Box style={{ padding: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ fontSize: 10, color: c.textDim }}>{`Tags (${tags.length})`}</Text>
          </Box>
          <ScrollView style={{ flexGrow: 1 }} horizontal>
            <Box style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
              {tags.map((tag, i) => (
                <Box key={i} style={{
                  backgroundColor: tagColors[i % 5],
                  borderRadius: 10,
                  paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
                }}>
                  <Text style={{ fontSize: 10, color: '#ffffff' }}>{tag}</Text>
                </Box>
              ))}
            </Box>
          </ScrollView>
        </Box>
      </Box>

      {/* Right sidebar */}
      <Box style={{ width: 150, height: '100%', backgroundColor: c.bgElevated, borderLeftWidth: 1, borderLeftColor: c.border }}>
        <PanelHeader title="Details" subtitle="" color={c.success} />
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ padding: 6 }}>
            {Array.from({ length: 25 }, (_, i) => (
              <Box key={i} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: c.primary, fontWeight: 'normal' }}>{`Section ${i + 1}`}</Text>
                <Text style={{ fontSize: 10, color: c.textDim }}>Lorem ipsum dolor sit amet consectetur adipiscing elit</Text>
                <Box style={{ height: 3, backgroundColor: c.border, borderRadius: 1, marginTop: 4 }}>
                  <Box style={{ height: 3, width: `${20 + (i * 13) % 80}%`, backgroundColor: c.success, borderRadius: 1 }} />
                </Box>
              </Box>
            ))}
          </Box>
        </ScrollView>
      </Box>

      </Box>{/* close row wrapper */}
    </Box>
  );
}
