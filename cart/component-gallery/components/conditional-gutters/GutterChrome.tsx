import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { Icon, type IconData } from '@reactjit/runtime/icons/Icon';
import {
  Bell,
  Check,
  Circle,
  Command,
  FileText,
  GitBranch,
  Layers,
  Search,
  Terminal,
  X,
} from '@reactjit/runtime/icons/icons';

const SHELL = {
  bg: '#0c0b09',
  panel: '#13100d',
  panel2: '#1c1712',
  rule: '#2d271f',
  ruleBright: '#5a4b3a',
  ink: '#f2e8dc',
  muted: '#9a8c78',
  faint: '#665c50',
  amber: '#f2b35d',
  green: '#79d891',
  teal: '#6bd6d1',
  pink: '#d98cac',
};

function Mono({
  children,
  color = SHELL.muted,
  size = 10,
  bold,
}: {
  children: any;
  color?: string;
  size?: number;
  bold?: boolean;
}) {
  return (
    <Text
      style={{
        color,
        fontSize: size,
        lineHeight: size + 3,
        fontFamily: 'monospace',
        fontWeight: bold ? 'bold' : 'normal',
      }}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Box
        style={{
          width: 26,
          height: 26,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          borderWidth: 1,
          borderColor: SHELL.rule,
          backgroundColor: '#17130f',
        }}
      >
        <Icon icon={X} size={13} color={SHELL.muted} strokeWidth={2.2} />
      </Box>
    </Pressable>
  );
}

function GutterPanel({
  title,
  kicker,
  icon,
  color,
  onClose,
  children,
}: {
  title: string;
  kicker: string;
  icon: IconData;
  color: string;
  onClose: () => void;
  children: any;
}) {
  return (
    <Col
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        backgroundColor: SHELL.panel,
        borderWidth: 1,
        borderColor: SHELL.rule,
      }}
    >
      <Row
        style={{
          height: 46,
          flexShrink: 0,
          alignItems: 'center',
          gap: 9,
          paddingLeft: 10,
          paddingRight: 10,
          borderBottomWidth: 1,
          borderBottomColor: SHELL.rule,
          backgroundColor: SHELL.panel2,
        }}
      >
        <Icon icon={icon} size={15} color={color} strokeWidth={2.2} />
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 1 }}>
          <Mono color={SHELL.faint} size={8}>{kicker}</Mono>
          <Mono color={SHELL.ink} size={11} bold>{title}</Mono>
        </Col>
        <CloseButton onPress={onClose} />
      </Row>
      <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 10, gap: 8 }}>
        {children}
      </Col>
    </Col>
  );
}

function NavItem({ icon, label, active, color }: { icon: IconData; label: string; active?: boolean; color: string }) {
  return (
    <Row
      style={{
        height: 30,
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: active ? color : SHELL.rule,
        backgroundColor: active ? '#201a12' : '#100e0b',
      }}
    >
      <Icon icon={icon} size={13} color={active ? color : SHELL.faint} strokeWidth={2.2} />
      <Mono color={active ? SHELL.ink : SHELL.muted} size={10} bold={active}>{label}</Mono>
    </Row>
  );
}

function MetricRail({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Row
      style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 7,
        paddingBottom: 7,
        borderWidth: 1,
        borderColor: SHELL.rule,
        backgroundColor: '#0f0d0a',
      }}
    >
      <Mono color={SHELL.muted} size={9}>{label}</Mono>
      <Mono color={color} size={10} bold>{value}</Mono>
    </Row>
  );
}

function ConsoleLine({ prompt, children }: { prompt: string; children: any }) {
  return (
    <Row style={{ gap: 8, alignItems: 'center' }}>
      <Mono color={SHELL.green} size={10}>{prompt}</Mono>
      <Mono color={SHELL.ink} size={10}>{children}</Mono>
    </Row>
  );
}

export function NavigationGutter({ onClose }: { onClose: () => void }) {
  return (
    <GutterPanel title="Workspace" kicker="LEFT GUTTER" icon={Layers} color={SHELL.teal} onClose={onClose}>
      <NavItem icon={FileText} label="Editor" active color={SHELL.teal} />
      <NavItem icon={Search} label="Search" color={SHELL.teal} />
      <NavItem icon={GitBranch} label="Changes" color={SHELL.green} />
      <NavItem icon={Bell} label="Events" color={SHELL.amber} />
      <Box style={{ height: 1, backgroundColor: SHELL.rule, marginTop: 2, marginBottom: 2 }} />
      {['cart', 'runtime', 'framework', 'scripts'].map((name, index) => (
        <Row key={name} style={{ gap: 7, alignItems: 'center', paddingLeft: 8, height: 24 }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: index === 1 ? SHELL.green : SHELL.faint }} />
          <Mono color={index === 1 ? SHELL.ink : SHELL.muted} size={10}>{name}</Mono>
        </Row>
      ))}
    </GutterPanel>
  );
}

export function InspectorGutter({ onClose }: { onClose: () => void }) {
  return (
    <GutterPanel title="Inspector" kicker="RIGHT GUTTER" icon={Command} color={SHELL.pink} onClose={onClose}>
      <MetricRail label="selection" value="CodeEditor.tsx" color={SHELL.pink} />
      <MetricRail label="symbols" value="18" color={SHELL.teal} />
      <MetricRail label="refs" value="42" color={SHELL.amber} />
      <Col style={{ gap: 6, marginTop: 3 }}>
        {['layout pass', 'dirty nodes', 'host flush', 'paint budget'].map((label, index) => (
          <Row key={label} style={{ gap: 7, alignItems: 'center' }}>
            <Icon icon={index < 2 ? Check : Circle} size={11} color={index < 2 ? SHELL.green : SHELL.faint} strokeWidth={2.4} />
            <Mono color={index < 2 ? SHELL.ink : SHELL.muted} size={10}>{label}</Mono>
          </Row>
        ))}
      </Col>
    </GutterPanel>
  );
}

export function CommandGutter({ onClose }: { onClose: () => void }) {
  return (
    <Row
      style={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 12,
        paddingRight: 12,
        borderWidth: 1,
        borderColor: SHELL.rule,
        backgroundColor: SHELL.panel2,
      }}
    >
      <Icon icon={Command} size={17} color={SHELL.amber} strokeWidth={2.2} />
      <Box
        style={{
          flexGrow: 1,
          flexBasis: 0,
          minWidth: 0,
          height: 34,
          justifyContent: 'center',
          paddingLeft: 12,
          paddingRight: 12,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: SHELL.ruleBright,
          backgroundColor: '#0f0d0a',
        }}
      >
        <Mono color={SHELL.ink} size={11}>Command palette / quick switcher</Mono>
      </Box>
      <Mono color={SHELL.faint} size={9}>CTRL K</Mono>
      <CloseButton onPress={onClose} />
    </Row>
  );
}

export function ConsoleGutter({ onClose }: { onClose: () => void }) {
  return (
    <GutterPanel title="Console" kicker="BOTTOM GUTTER" icon={Terminal} color={SHELL.green} onClose={onClose}>
      <ScrollView showScrollbar={false} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ gap: 5 }}>
          <ConsoleLine prompt="$">scripts/ship component-gallery</ConsoleLine>
          <ConsoleLine prompt=">">bundle updated in 84ms</ConsoleLine>
          <ConsoleLine prompt=">">left gutter closed: keeping exit frame</ConsoleLine>
          <ConsoleLine prompt=">">right gutter open: measuring 248px</ConsoleLine>
        </Col>
      </ScrollView>
    </GutterPanel>
  );
}

export function EditorMock() {
  const rows = [
    ['01', 'export function AppShell() {'],
    ['02', '  return <ConditionalGutters />;'],
    ['03', '}'],
    ['04', ''],
    ['05', 'const gutter = edge.open ? edge.size : 0;'],
    ['06', 'const eased = easeInOutCubic(progress);'],
    ['07', ''],
    ['08', 'render same node pool, mutate layout'],
  ];

  return (
    <Col
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        padding: 14,
        gap: 10,
        backgroundColor: SHELL.bg,
      }}
    >
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Box style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: SHELL.pink }} />
        <Box style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: SHELL.amber }} />
        <Box style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: SHELL.green }} />
        <Mono color={SHELL.faint} size={10}>cart/sweatshop/index.tsx</Mono>
      </Row>
      <Col
        style={{
          flexGrow: 1,
          flexBasis: 0,
          minHeight: 0,
          borderWidth: 1,
          borderColor: SHELL.rule,
          backgroundColor: '#090806',
          padding: 12,
          gap: 7,
        }}
      >
        {rows.map((row) => (
          <Row key={row[0]} style={{ gap: 12, alignItems: 'center' }}>
            <Mono color={SHELL.faint} size={10}>{row[0]}</Mono>
            <Mono color={row[1].includes('Conditional') ? SHELL.teal : row[1].includes('ease') ? SHELL.amber : SHELL.ink} size={11}>
              {row[1]}
            </Mono>
          </Row>
        ))}
      </Col>
    </Col>
  );
}

