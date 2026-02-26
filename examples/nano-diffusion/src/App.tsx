import React, { useState } from 'react';
import { Box, Pressable, ScrollView, Text } from '@reactjit/core';

// Migrated from Blessed: "Nano Diffusion Control Center"
// Original: 2903 lines of Node.js + blessed TUI → 220 lines of ReactJIT

const C = {
  bg: '#000000',
  surface: '#111111',
  border: '#555555',
  text: '#FFFFFF',
  muted: '#888888',
  accent: '#3B82F6',
  tabBg: '#0000FF',
  footerBg: '#FFFFFF',
  footerText: '#000000',
};

// Sample data so the dashboard isn't empty on first render
const SAMPLE_JOBS = [
  ['001', 'queue.txt', 'cyberpunk city', 'done', '3', '12', '2m ago'],
  ['002', 'queue.txt', 'forest spirit', 'running', '2/5', '8', 'now'],
  ['003', 'manual', 'portrait study', 'pending', '0/2', '0', '—'],
];

const SAMPLE_PLAN = [
  ['1', 'cyberpunk city', 'done', '100%', 'sd-xl', '2'],
  ['2', 'forest spirit', 'running', '40%', 'sd-xl', '1'],
  ['3', 'portrait study', 'queued', '0%', 'sd-1.5', '3'],
];

const SAMPLE_PROMPTS = [
  ['cyberpunk city', '12', '1', '7.7%', 'NSFW filter'],
  ['forest spirit', '8', '0', '0%', '—'],
  ['portrait study', '0', '0', '0%', '—'],
];

const SAMPLE_REFS = [
  ['ref_cityscape.png', '10', '2', '16.7%', 'resolution mismatch'],
  ['ref_forest.png', '8', '0', '0%', '—'],
];

function TableRow({ cells }: { cells: string[] }) {
  return (
    <Box style={{ flexDirection: 'row', gap: 16, paddingBottom: 2 }}>
      {cells.map((cell, i) => (
        <Text key={i} style={{ fontSize: 11, color: C.text, minWidth: 80 }}>{cell}</Text>
      ))}
    </Box>
  );
}

function TableHeader({ headers }: { headers: string[] }) {
  return (
    <Box style={{ flexDirection: 'row', gap: 16, paddingBottom: 8 }}>
      {headers.map((h, i) => (
        <Text key={i} style={{ fontWeight: 'bold', fontSize: 11, color: C.accent, minWidth: 80 }}>{h}</Text>
      ))}
    </Box>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [summaryBoxContent] = useState<string>(
    'Nano Diffusion Control Center v1.0\n\nJobs: 3 total (1 running, 1 done, 1 pending)\nImages: 20 generated\nQueue: 2 remaining\nUptime: 4h 22m'
  );
  const [activeBoxContent] = useState<string>(
    'Job #002 — forest spirit\n  Model: sd-xl | Batch 2/5 | ETA: ~3m\n  Seed: 42891 | Steps: 30 | CFG: 7.5'
  );
  const [queueInfoBoxContent] = useState<string>(
    'Queue Status: RUNNING\nProcessing: Job #002 (batch 2 of 5)\nRemaining: 1 job (portrait study)\nETA: ~8 minutes'
  );
  const [queueFileBoxContent] = useState<string>(
    'forest spirit, ethereal, volumetric lighting --ar 16:9\nportrait study, oil painting, rembrandt lighting --ar 1:1'
  );
  const [assetsBoxContent] = useState<string>(
    'Prompts: 3 loaded\nReferences: 2 loaded\nModels: sd-xl, sd-1.5\nOutput dir: ./output/ (20 images, 142MB)'
  );
  const [logBoxContent] = useState<string>(
    '[14:22:01] Queue started\n[14:22:01] Job #001 — cyberpunk city — starting\n[14:22:15] Job #001 — batch 1/3 complete (4 images)\n[14:22:30] Job #001 — batch 2/3 complete (4 images)\n[14:22:44] Job #001 — batch 3/3 complete (4 images)\n[14:22:44] Job #001 — done (12 images)\n[14:22:45] Job #002 — forest spirit — starting\n[14:23:01] Job #002 — batch 1/5 complete (4 images)\n[14:23:16] Job #002 — batch 2/5 in progress...'
  );
  const [footerContent] = useState<string>(
    ' n: Start Queue | Ctrl+X: Cancel All | r: Refresh Assets | Tab: Switch Tab'
  );

  const tabs = ['Dashboard', 'Queue', 'Telemetry', 'Logs'];

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      backgroundColor: C.bg,
    }}>
      {/* Tab Bar */}
      <Box style={{
        width: '100%',
        height: 24,
        backgroundColor: C.tabBg,
        flexDirection: 'row',
      }}>
        {tabs.map((tab, i) => (
          <Pressable key={i} style={{ paddingLeft: 8, paddingRight: 8 }} onPress={() => setActiveTab(i)}>
            <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#FFFFFF' }}>
              {activeTab === i ? `[ ${tab} ]` : ` ${tab} `}
            </Text>
          </Pressable>
        ))}
      </Box>

      {/* Tab Content */}
      <Box style={{ flexGrow: 1, flexDirection: 'column', backgroundColor: C.bg }}>

        {/* Dashboard Tab */}
        {activeTab === 0 && (
          <Box style={{ width: '100%', flexGrow: 1, flexDirection: 'column', gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Overview"}</Text>
            <Box style={{
              width: '100%',
              height: '30%',
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <Text style={{ fontSize: 12, color: C.text }}>{summaryBoxContent}</Text>
            </Box>

            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Jobs"}</Text>
            <ScrollView style={{
              width: '100%',
              height: '30%',
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <TableHeader headers={['ID', 'Source', 'Prompt', 'Status', 'Batches', 'Images', 'Last']} />
              {SAMPLE_JOBS.map((row, i) => <TableRow key={i} cells={row} />)}
            </ScrollView>

            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Active Jobs"}</Text>
            <Box style={{
              width: '100%',
              flexGrow: 1,
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <Text style={{ fontSize: 12, color: C.text }}>{activeBoxContent}</Text>
            </Box>
          </Box>
        )}

        {/* Queue Tab */}
        {activeTab === 1 && (
          <Box style={{ width: '100%', flexGrow: 1, flexDirection: 'column', gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Queue Plan"}</Text>
            <ScrollView style={{
              width: '100%',
              height: '50%',
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <TableHeader headers={['#', 'Prompt', 'Status', 'Progress', 'Model', 'Refs']} />
              {SAMPLE_PLAN.map((row, i) => <TableRow key={i} cells={row} />)}
            </ScrollView>

            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Queue Status"}</Text>
            <Box style={{
              width: '100%',
              height: '20%',
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <Text style={{ fontSize: 12, color: C.text }}>{queueInfoBoxContent}</Text>
            </Box>

            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"queue.txt Preview"}</Text>
            <Box style={{
              width: '100%',
              flexGrow: 1,
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <Text style={{ fontSize: 12, color: C.text }}>{queueFileBoxContent}</Text>
            </Box>
          </Box>
        )}

        {/* Telemetry Tab */}
        {activeTab === 2 && (
          <Box style={{ width: '100%', flexGrow: 1, flexDirection: 'column', gap: 4 }}>
            <Box style={{ flexDirection: 'row', gap: 8, flexGrow: 1 }}>
              <Box style={{ width: '50%', flexDirection: 'column' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Prompt Health"}</Text>
                <ScrollView style={{
                  width: '100%',
                  flexGrow: 1,
                  borderWidth: 1,
                  borderColor: C.border,
                  padding: 8,
                }}>
                  <TableHeader headers={['Prompt', '✅', '❌', 'Fail %', 'Last error']} />
                  {SAMPLE_PROMPTS.map((row, i) => <TableRow key={i} cells={row} />)}
                </ScrollView>
              </Box>

              <Box style={{ width: '50%', flexDirection: 'column' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Reference Health"}</Text>
                <ScrollView style={{
                  width: '100%',
                  flexGrow: 1,
                  borderWidth: 1,
                  borderColor: C.border,
                  padding: 8,
                }}>
                  <TableHeader headers={['Reference', '✅', '❌', 'Fail %', 'Last error']} />
                  {SAMPLE_REFS.map((row, i) => <TableRow key={i} cells={row} />)}
                </ScrollView>
              </Box>
            </Box>

            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Assets"}</Text>
            <Box style={{
              width: '100%',
              height: '25%',
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <Text style={{ fontSize: 12, color: C.text }}>{assetsBoxContent}</Text>
            </Box>
          </Box>
        )}

        {/* Logs Tab */}
        {activeTab === 3 && (
          <Box style={{ width: '100%', flexGrow: 1, flexDirection: 'column', gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted, paddingBottom: 4 }}>{"Event Log"}</Text>
            <ScrollView style={{
              width: '100%',
              flexGrow: 1,
              borderWidth: 1,
              borderColor: C.border,
              padding: 8,
            }}>
              <Text style={{ fontSize: 11, color: C.text }}>{logBoxContent}</Text>
            </ScrollView>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box style={{
        width: '100%',
        height: 24,
        backgroundColor: C.footerBg,
        justifyContent: 'center',
        paddingLeft: 8,
      }}>
        <Text style={{ fontSize: 12, color: C.footerText }}>{footerContent}</Text>
      </Box>
    </Box>
  );
}
