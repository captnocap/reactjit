import { ConsoleHeader, type ConsoleHeaderProps } from './ConsoleHeader';
import { ConsoleTelemetryBar, type ConsoleTelemetryProps } from './ConsoleTelemetryBar';
import { ConsoleTile } from './ConsoleTile';
import { ConsoleTranscript } from './ConsoleTranscript';
import { ContextCliffGutter } from './ContextCliffGutter';
import { LaneGutter, type LaneToken } from './LaneGutter';
import type { TranscriptBlock } from './MessageBlocks';
import { ConsoleTaskPanel, type TaskPanelData } from './TaskPanel';

export type GenericChatCardProps = {
  header?: ConsoleHeaderProps;
  telemetry?: ConsoleTelemetryProps;
  laneTokens?: LaneToken[];
  transcript?: TranscriptBlock[];
  task?: TaskPanelData | null;
  contextFill?: number;
};

const DEFAULT_LANE_TOKENS: LaneToken[] = [
  { label: '7', tone: 'warm', active: true },
  { label: 'M', tone: 'warm' },
  { label: '6', tone: 'warm' },
  { label: 'S', tone: 'amber' },
  { label: 'H', tone: 'amber' },
  { label: 'K', tone: 'soft' },
  { label: 'C', tone: 'cool' },
  { label: 'G', tone: 'cool' },
  { label: 'm', tone: 'cool' },
  { label: 'P', tone: 'cool' },
  { label: 'F', tone: 'cool' },
  { label: 'L', tone: 'cool' },
  { label: 'M', tone: 'cyan' },
  { label: 'H', tone: 'cyan', active: true },
  { label: 'A', tone: 'soft' },
  { label: '2', tone: 'cool', active: true },
  { label: '1', tone: 'soft' },
  { label: 'R', tone: 'danger' },
];

const DEFAULT_TRANSCRIPT: TranscriptBlock[] = [
  {
    kind: 'user',
    author: 'YOU',
    lines: ['Execute the next section.', 'Use the verified patterns.'],
  },
  {
    kind: 'agent',
    id: 'agent-1',
    author: 'AGENT',
    meta: 'model-neutral',
    lines: [
      'Understood. Before doing the mechanical',
      'replacement, I will create a runtime counterpart',
      'to handle the tree traversal dynamically.',
    ],
    markable: true,
  },
  {
    kind: 'thinking',
    title: 'THINKING',
    timer: '6m 12s',
    lines: ['Plan: isolate gutters, header,', 'telemetry, stream, and signal slot.'],
  },
  {
    kind: 'diff',
    title: 'src/App.jsx',
    meta: 'patch',
    lines: [
      { prefix: ' ', text: 'return (' },
      { prefix: '-', text: '<SingleCard />' },
      { prefix: '+', text: '<ConsoleTile>' },
      { prefix: '+', text: '  <ConsoleTranscript />' },
      { prefix: '+', text: '</ConsoleTile>' },
    ],
  },
  {
    kind: 'tool',
    title: 'verification command',
    meta: '142ms',
    command: "grep -c 'pattern' src/**/*",
  },
];

const DEFAULT_HEADER: ConsoleHeaderProps = {
  title: 'Session-01',
  pathology: 'COUNTERFEITER',
  achievement: 'The Pane 6 Special',
  trust: 'F',
  note: 'Trust: 0.3 | model-neutral',
  mode: 'stuck',
};

const DEFAULT_TELEMETRY: ConsoleTelemetryProps = {
  progress: 0.47,
  rate: '85k / 100k',
  time: '14:24',
  state: 'evaluating_plan',
  alert: 'STUCK: thinking 6m 12s',
};

export function GenericChatCard({
  header = DEFAULT_HEADER,
  telemetry = DEFAULT_TELEMETRY,
  laneTokens = DEFAULT_LANE_TOKENS,
  transcript = DEFAULT_TRANSCRIPT,
  task = null,
  contextFill = 0.84,
}: GenericChatCardProps) {
  return (
    <ConsoleTile lane={<LaneGutter tokens={laneTokens} />} cliff={<ContextCliffGutter fill={contextFill} />}>
      <ConsoleHeader {...header} />
      <ConsoleTelemetryBar {...telemetry} />
      <ConsoleTranscript blocks={transcript} attachment={task ? <ConsoleTaskPanel task={task} attached={true} /> : null} />
    </ConsoleTile>
  );
}
