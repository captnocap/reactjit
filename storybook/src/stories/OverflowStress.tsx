import React from 'react';
import { Box, ScrollView, Text, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

type ReachColumnProps = {
  title: string;
  subtitle: string;
  color: string;
  rows: string[];
};

type WideLaneProps = {
  title: string;
  color: string;
  packets: string[];
};

function makeRows(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const segment = ['cache', 'layout', 'paint', 'events', 'focus'][i % 5];
    const lane = (i % 7) + 1;
    return `${prefix} ${String(i + 1).padStart(3, '0')} ${segment} lane ${lane} wraps through viewport`;
  });
}

function makePackets(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const chunk = `${prefix}_${String(i + 1).padStart(2, '0')}`;
    const repeat = 14 + (i % 6) * 6;
    return `${chunk}_${'x'.repeat(repeat)}`;
  });
}

function ReachTag({ label, color }: { label: string; color: string }) {
  const c = useThemeColors();
  return (
    <Box
      style={{
        alignSelf: 'flex-start',
        backgroundColor: color,
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
      }}
    >
      <Text style={{ fontSize: 9, color: c.bg, fontWeight: 'normal' }}>{label}</Text>
    </Box>
  );
}

function SectionBlock({
  title,
  subtitle,
  height,
  children,
}: {
  title: string;
  subtitle: string;
  height: number;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Box
      style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>{title}</Text>
        <S.StoryMuted>{subtitle}</S.StoryMuted>
      </Box>
      <Box
        style={{
          width: '100%',
          height,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function ReachColumn({ title, subtitle, color, rows }: ReachColumnProps) {
  const c = useThemeColors();
  return (
    <Box
      style={{
        flexGrow: 1,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: c.surface,
      }}
    >
      <Box
        style={{
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        <Text style={{ fontSize: 12, color, fontWeight: 'normal' }}>{title}</Text>
        <S.StoryMuted>{subtitle}</S.StoryMuted>
      </Box>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 6, paddingBottom: 6, gap: 4 }}>
          <ReachTag label="TOP REACHABLE" color={color} />
          {rows.map((line, i) => (
            <Box
              key={`${title}-row-${i}`}
              style={{
                backgroundColor: i % 2 === 0 ? c.surface : c.surfaceHover,
                borderRadius: 5,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 6,
                paddingBottom: 6,
              }}
            >
              <S.StoryMuted>{`line ${String(i + 1).padStart(3, '0')}`}</S.StoryMuted>
              <Text style={{ fontSize: 11, color: c.text }}>{line}</Text>
            </Box>
          ))}
          <ReachTag label="BOTTOM REACHABLE" color={color} />
        </Box>
      </ScrollView>
    </Box>
  );
}

function WideLane({ title, color, packets }: WideLaneProps) {
  const c = useThemeColors();
  return (
    <Box
      style={{
        width: 280,
        height: '100%',
        backgroundColor: c.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        <Text style={{ fontSize: 12, color, fontWeight: 'normal' }}>{title}</Text>
        <S.StoryMuted>Vertical and horizontal pressure in one lane</S.StoryMuted>
      </Box>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 6, paddingBottom: 6 }}>
          <ReachTag label="LANE TOP" color={color} />
          {packets.map((packet, i) => (
            <Box
              key={`${title}-packet-${i}`}
              style={{
                borderRadius: 5,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: i % 2 === 0 ? c.surface : c.surfaceHover,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 6,
                paddingBottom: 6,
                gap: 3,
              }}
            >
              <S.StoryMuted>{`packet ${String(i + 1).padStart(2, '0')}`}</S.StoryMuted>
              <ScrollView horizontal style={{ width: '100%' }}>
                <Box style={{ paddingRight: 12 }}>
                  <Text style={{ fontSize: 11, color: c.text }}>{packet}</Text>
                </Box>
              </ScrollView>
            </Box>
          ))}
          <ReachTag label="LANE BOTTOM" color={color} />
        </Box>
      </ScrollView>
    </Box>
  );
}

function ClipProbePanel({
  title,
  color,
  rows,
}: {
  title: string;
  color: string;
  rows: string[];
}) {
  const c = useThemeColors();
  return (
    <Box
      style={{
        flexGrow: 1,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: c.surface,
      }}
    >
      <Box
        style={{
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        <Text style={{ fontSize: 12, color, fontWeight: 'normal' }}>{title}</Text>
        <S.StoryMuted>Rounded clipping with nested scroll and long labels</S.StoryMuted>
      </Box>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 6, paddingBottom: 6, gap: 6 }}>
          <ReachTag label="CLIP TOP" color={color} />
          {rows.map((row, i) => (
            <Box
              key={`${title}-clip-${i}`}
              style={{
                height: 56,
                borderRadius: 6,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.bgElevated,
              }}
            >
              <Box
                style={{
                  height: 4,
                  width: `${25 + (i * 11) % 70}%`,
                  backgroundColor: color,
                }}
              />
              <Box
                style={{
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 5,
                  paddingBottom: 5,
                  gap: 2,
                }}
              >
                <S.StoryMuted>{`probe ${String(i + 1).padStart(2, '0')}`}</S.StoryMuted>
                <ScrollView horizontal style={{ width: '100%' }}>
                  <Box style={{ paddingRight: 12 }}>
                    <Text style={{ fontSize: 11, color: c.text }}>{row}</Text>
                  </Box>
                </ScrollView>
              </Box>
            </Box>
          ))}
          <ReachTag label="CLIP BOTTOM" color={color} />
        </Box>
      </ScrollView>
    </Box>
  );
}

export function OverflowStressStory() {
  const c = useThemeColors();

  const feedRows = makeRows('feed', 70);
  const taskRows = makeRows('task', 78);
  const metricRows = makeRows('metric', 72);

  const primaryPackets = makePackets('primary', 20);
  const warningPackets = makePackets('warning', 20);
  const errorPackets = makePackets('error', 20);
  const accentPackets = makePackets('accent', 20);

  const clipRowsA = makePackets('clipA', 26);
  const clipRowsB = makePackets('clipB', 26);

  return (
    <S.StoryRoot>
      <ScrollView style={{ width: '100%', height: '100%' }}>
        <Box
          style={{
            width: '100%',
            gap: 10,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 12,
            paddingBottom: 24,
          }}
        >
          <Box
            style={{
              width: '100%',
              backgroundColor: c.bgElevated,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 8,
              paddingBottom: 8,
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 14, color: c.text, fontWeight: 'normal' }}>Overflow Stress Harness</Text>
            <Text style={{ fontSize: 11, color: c.textDim }}>
              This scenario is heavy on purpose. Every panel includes top and bottom reachable markers.
            </Text>
            <Text style={{ fontSize: 11, color: c.textDim }}>
              If any marker cannot be brought into view, overflow behavior has regressed.
            </Text>
          </Box>

          <SectionBlock
            title="1) Vertical reachability under heavy row pressure"
            subtitle="Three independent columns with dense content and wrapped text"
            height={280}
          >
            <Box style={{ width: '100%', height: '100%', flexDirection: 'row', gap: 8 }}>
              <ReachColumn title="Event Feed" subtitle={`${feedRows.length} rows`} color={c.primary} rows={feedRows} />
              <ReachColumn title="Task Queue" subtitle={`${taskRows.length} rows`} color={c.success} rows={taskRows} />
              <ReachColumn title="Metrics" subtitle={`${metricRows.length} rows`} color={c.warning} rows={metricRows} />
            </Box>
          </SectionBlock>

          <SectionBlock
            title="2) Wide board with mixed-axis overflow"
            subtitle="Horizontal board overflow plus vertical lane overflow plus unbroken packets"
            height={300}
          >
            <ScrollView horizontal style={{ width: '100%', height: '100%' }}>
              <Box style={{ flexDirection: 'row', gap: 8, height: '100%', paddingRight: 12 }}>
                <WideLane title="Primary Lane" color={c.primary} packets={primaryPackets} />
                <WideLane title="Warning Lane" color={c.warning} packets={warningPackets} />
                <WideLane title="Error Lane" color={c.error} packets={errorPackets} />
                <WideLane title="Accent Lane" color={c.accent} packets={accentPackets} />
              </Box>
            </ScrollView>
          </SectionBlock>

          <SectionBlock
            title="3) Rounded clipping and nested horizontal probes"
            subtitle="Clip boundaries should stay correct while inner content remains scroll-reachable"
            height={280}
          >
            <Box style={{ width: '100%', height: '100%', flexDirection: 'row', gap: 8 }}>
              <ClipProbePanel title="Clip Probe A" color={c.accent} rows={clipRowsA} />
              <ClipProbePanel title="Clip Probe B" color={c.error} rows={clipRowsB} />
            </Box>
          </SectionBlock>
        </Box>
      </ScrollView>
    </S.StoryRoot>
  );
}
