import React, { useState } from 'react';
import { Box, Pressable, ScrollView, Select, Slider, Switch, Text } from '../../../../packages/core/src';
import { ActionChip, CREATIVE_COLORS, MeterBar, Panel, SectionEyebrow, StatTile } from './shared';

const RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
];

const WORKSPACE_OPTIONS = [
  { label: 'All workspaces', value: 'all' },
  { label: 'reactjit', value: 'reactjit' },
  { label: 'llm-studio', value: 'llm-studio' },
  { label: 'oni-lab', value: 'oni-lab' },
];

const RANGE_METRICS = {
  today: {
    tokens: '284k',
    requests: '64',
    spend: '$2.84',
    renderTime: '38m',
    memory: '42 maps',
  },
  week: {
    tokens: '1.4M',
    requests: '382',
    spend: '$12.44',
    renderTime: '3h 18m',
    memory: '126 maps',
  },
  month: {
    tokens: '4.8M',
    requests: '1493',
    spend: '$46.20',
    renderTime: '11h 04m',
    memory: '418 maps',
  },
};

const PROJECTS = [
  {
    id: 'reactjit',
    name: 'reactjit',
    workspace: 'reactjit',
    status: 'shipping storybook concepts',
    velocity: 0.84,
    threads: 24,
    sync: 'clean',
    note: 'Preview work is deep in the storybook layer with no framework sync required.',
  },
  {
    id: 'llm-studio',
    name: 'llm-studio',
    workspace: 'llm-studio',
    status: 'editor controls in review',
    velocity: 0.66,
    threads: 12,
    sync: 'watching',
    note: 'A good fit for selector and dashboard widgets after story validation.',
  },
  {
    id: 'oni-lab',
    name: 'oni-lab',
    workspace: 'oni-lab',
    status: 'concept pipeline active',
    velocity: 0.9,
    threads: 16,
    sync: 'clean',
    note: 'Visual outputs are driving prompt iteration and asset batching.',
  },
];

const ASSETS = [
  { id: 'frame-a', label: 'Frame A', tint: CREATIVE_COLORS.accent, note: 'High contrast portrait' },
  { id: 'frame-b', label: 'Frame B', tint: CREATIVE_COLORS.cyan, note: 'Wide greenhouse scene' },
  { id: 'frame-c', label: 'Frame C', tint: CREATIVE_COLORS.gold, note: 'Ritual drift bay' },
  { id: 'frame-d', label: 'Frame D', tint: CREATIVE_COLORS.violet, note: 'Blueprint mode cutaway' },
];

const MEMORIES = [
  { id: 'layout', label: 'Layout invariants', relevance: 0.93, color: CREATIVE_COLORS.green },
  { id: 'compiler', label: 'TSLX compiler', relevance: 0.77, color: CREATIVE_COLORS.blue },
  { id: 'masks', label: 'Mask architecture', relevance: 0.71, color: CREATIVE_COLORS.violet },
  { id: 'git', label: 'Git discipline', relevance: 0.52, color: CREATIVE_COLORS.gold },
];

function ProjectRow({
  name,
  status,
  velocity,
  active,
  onPress,
}: {
  name: string;
  status: string;
  velocity: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Box
        style={{
          borderRadius: 10,
          borderWidth: 1,
          borderColor: active ? CREATIVE_COLORS.accent : CREATIVE_COLORS.stroke,
          backgroundColor: active ? CREATIVE_COLORS.accentSoft : 'rgba(255,255,255,0.02)',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 6,
        }}
      >
        <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: CREATIVE_COLORS.text, fontSize: 12, fontWeight: 'bold' }}>{name}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{`${Math.round(velocity * 100)}%`}</Text>
        </Box>
        <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{status}</Text>
        <MeterBar value={velocity} color={active ? CREATIVE_COLORS.accent : CREATIVE_COLORS.blue} />
      </Box>
    </Pressable>
  );
}

export function DashboardStatsPreview() {
  const [range, setRange] = useState('week');
  const [workspace, setWorkspace] = useState('all');
  const [liveSync, setLiveSync] = useState(true);
  const [focusLoad, setFocusLoad] = useState(0.72);
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [assetId, setAssetId] = useState(ASSETS[0].id);
  const [pinnedMemories, setPinnedMemories] = useState<string[]>([MEMORIES[0].id]);

  const metrics = RANGE_METRICS[range as keyof typeof RANGE_METRICS];
  const visibleProjects = PROJECTS.filter((project) => workspace === 'all' || project.workspace === workspace);
  const activeProject = visibleProjects.find((project) => project.id === projectId) || visibleProjects[0] || PROJECTS[0];
  const activeAsset = ASSETS.find((asset) => asset.id === assetId) || ASSETS[0];

  function toggleMemory(memoryId: string) {
    setPinnedMemories((current) =>
      current.includes(memoryId) ? current.filter((item) => item !== memoryId) : [...current, memoryId]
    );
  }

  return (
    <ScrollView style={{ flexGrow: 1, backgroundColor: CREATIVE_COLORS.ink }}>
      <Box style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 20, paddingBottom: 20, gap: 16 }}>
        <Panel style={{ backgroundColor: '#08111f' }}>
          <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, gap: 14 }}>
            <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Box style={{ gap: 4 }}>
                <SectionEyebrow label="Session cockpit" color={CREATIVE_COLORS.accent} />
                <Text style={{ color: CREATIVE_COLORS.text, fontSize: 24, fontWeight: 'bold' }}>{'Creative work is live and measurable'}</Text>
                <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 11 }}>
                  {'Everything here responds to range, workspace, project focus, and memory pins.'}
                </Text>
              </Box>
              <Box style={{ flexGrow: 1 }} />
              <Box style={{ gap: 8, width: 220 }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Live sync'}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Switch value={liveSync} onValueChange={setLiveSync} width={44} height={24} />
                </Box>
                <Select value={workspace} onValueChange={setWorkspace} options={WORKSPACE_OPTIONS} color={CREATIVE_COLORS.blue} />
              </Box>
            </Box>

            <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {RANGE_OPTIONS.map((option) => (
                <ActionChip
                  key={option.value}
                  label={option.label}
                  active={range === option.value}
                  onPress={() => setRange(option.value)}
                  color={range === option.value ? CREATIVE_COLORS.accent : CREATIVE_COLORS.blue}
                />
              ))}
            </Box>

            <Box style={{ gap: 8 }}>
              <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Focus load'}</Text>
                <Box style={{ flexGrow: 1 }} />
                <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{focusLoad.toFixed(2)}</Text>
              </Box>
              <Slider
                style={{ width: 480 }}
                value={focusLoad}
                onValueChange={setFocusLoad}
                minimumValue={0.1}
                maximumValue={1}
                step={0.01}
                activeTrackColor={CREATIVE_COLORS.accent}
              />
            </Box>

            <Box style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile label="Tokens" value={metrics.tokens} note="input and output combined" color={CREATIVE_COLORS.green} />
              <StatTile label="Requests" value={metrics.requests} note="chat, tools, and image turns" color={CREATIVE_COLORS.blue} />
              <StatTile label="Spend" value={metrics.spend} note="current range total" color={CREATIVE_COLORS.gold} />
              <StatTile label="Render time" value={metrics.renderTime} note="streaming and tool wall time" color={CREATIVE_COLORS.accent} />
              <StatTile label="Memory maps" value={metrics.memory} note="retrieval snapshots built" color={CREATIVE_COLORS.violet} />
            </Box>
          </Box>
        </Panel>

        <Box style={{ flexDirection: 'row', gap: 14 }}>
          <Panel style={{ flexGrow: 1, flexBasis: 0 }}>
            <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
              <SectionEyebrow label="Recent outputs" color={CREATIVE_COLORS.cyan} />
              <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ASSETS.map((asset) => {
                  const active = asset.id === activeAsset.id;
                  return (
                    <Pressable key={asset.id} onPress={() => setAssetId(asset.id)}>
                      <Box
                        style={{
                          width: 150,
                          height: 100,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: active ? asset.tint : CREATIVE_COLORS.stroke,
                          backgroundColor: active ? `${asset.tint}18` : 'rgba(255,255,255,0.02)',
                          paddingLeft: 10,
                          paddingRight: 10,
                          paddingTop: 10,
                          paddingBottom: 10,
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: `${asset.tint}22` }} />
                        <Box>
                          <Text style={{ color: CREATIVE_COLORS.text, fontSize: 11, fontWeight: 'bold' }}>{asset.label}</Text>
                          <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{asset.note}</Text>
                        </Box>
                      </Box>
                    </Pressable>
                  );
                })}
              </Box>
            </Box>
          </Panel>

          <Panel style={{ flexGrow: 1.1, flexBasis: 0 }}>
            <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
              <SectionEyebrow label="Active projects" color={CREATIVE_COLORS.accent} />
              {visibleProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  name={project.name}
                  status={project.status}
                  velocity={Math.min(1, project.velocity * (0.55 + focusLoad * 0.6))}
                  active={project.id === activeProject.id}
                  onPress={() => setProjectId(project.id)}
                />
              ))}
            </Box>
          </Panel>

          <Panel style={{ flexGrow: 0.9, flexBasis: 0 }}>
            <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
              <SectionEyebrow label="Research memory" color={CREATIVE_COLORS.violet} />
              {MEMORIES.map((memory) => {
                const pinned = pinnedMemories.includes(memory.id);
                return (
                  <Pressable key={memory.id} onPress={() => toggleMemory(memory.id)}>
                    <Box
                      style={{
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: pinned ? memory.color : CREATIVE_COLORS.stroke,
                        backgroundColor: pinned ? `${memory.color}16` : 'rgba(255,255,255,0.02)',
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingTop: 10,
                        paddingBottom: 10,
                        gap: 6,
                      }}
                    >
                      <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: CREATIVE_COLORS.text, fontSize: 11, fontWeight: 'bold' }}>{memory.label}</Text>
                        <Box style={{ flexGrow: 1 }} />
                        <Text style={{ color: memory.color, fontSize: 9 }}>{`${Math.round(memory.relevance * 100)}%`}</Text>
                      </Box>
                      <MeterBar value={memory.relevance} color={memory.color} />
                    </Box>
                  </Pressable>
                );
              })}
            </Box>
          </Panel>
        </Box>

        <Panel style={{ backgroundColor: CREATIVE_COLORS.panelRaised }}>
          <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, gap: 10 }}>
            <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SectionEyebrow label="Focus detail" color={activeAsset.tint} />
              <Box style={{ flexGrow: 1 }} />
              <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 10 }}>{liveSync ? 'syncing live' : 'manual snapshot'}</Text>
            </Box>
            <Text style={{ color: CREATIVE_COLORS.text, fontSize: 16, fontWeight: 'bold' }}>{activeProject.name}</Text>
            <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 11 }}>{activeProject.note}</Text>
            <Box style={{ flexDirection: 'row', gap: 10 }}>
              <Panel style={{ flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 5 }}>
                  <SectionEyebrow label="Threads" color={CREATIVE_COLORS.blue} />
                  <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{String(activeProject.threads)}</Text>
                  <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{`sync state: ${activeProject.sync}`}</Text>
                </Box>
              </Panel>
              <Panel style={{ flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 5 }}>
                  <SectionEyebrow label="Selected output" color={activeAsset.tint} />
                  <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{activeAsset.label}</Text>
                  <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{activeAsset.note}</Text>
                </Box>
              </Panel>
              <Panel style={{ flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 5 }}>
                  <SectionEyebrow label="Pinned memory" color={CREATIVE_COLORS.violet} />
                  <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{String(pinnedMemories.length)}</Text>
                  <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{'entries driving prompt context'}</Text>
                </Box>
              </Panel>
            </Box>
          </Box>
        </Panel>
      </Box>
    </ScrollView>
  );
}
