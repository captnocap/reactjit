import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { StepCardShell } from './TranscriptFlow';
import type { RailBadgeName } from './RailBadge';
import { CHAT_CARD } from './tokens';

export type CounterTask = {
  kind: 'counter';
  title: string;
  count: number;
  target: number;
  progress: number;
  command: string;
};

export type ChecklistTask = {
  kind: 'checklist';
  title: string;
  steps: { label: string; done: boolean }[];
};

export type TaskPanelData = CounterTask | ChecklistTask;

function TaskStep({
  title,
  children,
  color,
  connectTop = false,
  showConnector,
  badgeName,
}: {
  title?: string;
  children: any;
  color: string;
  connectTop?: boolean;
  showConnector: boolean;
  badgeName?: RailBadgeName;
}) {
  return (
    <StepCardShell color={color} connectTop={connectTop} showConnector={showConnector} badgeName={badgeName}>
      <Col style={{ flexGrow: 1, gap: 4 }}>
        {title ? <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>{title}</Text> : null}
        {children}
      </Col>
    </StepCardShell>
  );
}

function CounterPen({ task }: { task: CounterTask }) {
  const fill = Math.round(Math.max(0, Math.min(1, task.progress)) * 320);

  return (
    <Col style={{ gap: 0 }}>
      <TaskStep color={CHAT_CARD.green} showConnector={true} badgeName="target">
        <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Box style={{ width: 10, height: 10, borderWidth: 1, borderColor: CHAT_CARD.green, borderRadius: 99 }} />
            <Text style={{ fontFamily: 'monospace', fontSize: 10, color: CHAT_CARD.text }}>{task.title}</Text>
          </Row>
          <Text style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold', color: CHAT_CARD.cyan }}>{task.count}</Text>
        </Row>
      </TaskStep>
      <TaskStep color={CHAT_CARD.green} connectTop={true} showConnector={true} badgeName="list">
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, backgroundColor: '#54351d', borderRadius: 3 }}>
            <Text style={{ fontFamily: 'monospace', fontSize: 7, fontWeight: 'bold', color: CHAT_CARD.gold }}>DRAFT 2</Text>
          </Box>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, backgroundColor: '#18382f', borderRadius: 3 }}>
            <Text style={{ fontFamily: 'monospace', fontSize: 7, fontWeight: 'bold', color: CHAT_CARD.green }}>COUNTER SLOT</Text>
          </Box>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ fontFamily: 'monospace', fontSize: 7, color: CHAT_CARD.faint }}>TARGET: {task.target}</Text>
        </Row>
        <Box style={{ width: 320, height: 5, backgroundColor: '#26364a' }}>
          <Box style={{ width: fill, height: 5, backgroundColor: '#13c996' }} />
        </Box>
      </TaskStep>
      <TaskStep color={CHAT_CARD.green} connectTop={true} showConnector={false} title="verification command" badgeName="terminal">
        <Box style={{ padding: 8, backgroundColor: CHAT_CARD.panelDeep, borderWidth: 1, borderColor: CHAT_CARD.borderSoft, borderRadius: 4 }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.mint }}>{task.command}</Text>
        </Box>
      </TaskStep>
    </Col>
  );
}

function ChecklistTracker({ task }: { task: ChecklistTask }) {
  return (
    <Col style={{ gap: 0 }}>
      <TaskStep color={CHAT_CARD.cyan} showConnector={task.steps.length > 0} badgeName="list">
        <Text style={{ fontFamily: 'monospace', fontSize: 10, color: CHAT_CARD.text }}>{task.title}</Text>
      </TaskStep>
      {task.steps.map((step, index) => (
        <TaskStep
          key={`${step.label}-${index}`}
          color={step.done ? CHAT_CARD.green : CHAT_CARD.border}
          connectTop={true}
          showConnector={index < task.steps.length - 1}
          badgeName={step.done ? 'check' : 'target'}
        >
          <Text style={{ fontFamily: 'monospace', fontSize: 9, color: step.done ? CHAT_CARD.text : CHAT_CARD.muted }}>{step.label}</Text>
        </TaskStep>
      ))}
    </Col>
  );
}

export function ConsoleTaskPanel({ task, attached = false }: { task: TaskPanelData; attached?: boolean }) {
  return (
    <Box
      style={{
        minHeight: attached ? 0 : 112,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: attached ? 8 : 10,
        paddingBottom: attached ? 10 : 10,
        backgroundColor: attached ? 'transparent' : '#1c2232',
        borderWidth: attached ? 0 : 1,
        borderColor: task.kind === 'counter' ? '#54413a' : CHAT_CARD.borderSoft,
        borderRadius: attached ? 0 : 4,
      }}
    >
      {task.kind === 'counter' ? <CounterPen task={task} /> : <ChecklistTracker task={task} />}
    </Box>
  );
}
