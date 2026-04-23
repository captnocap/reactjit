import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { ClientList } from './ClientList';
import { ToolCard } from './ToolCard';
import { ToolLog } from './ToolLog';
import { useMcpServer } from '../../hooks/useMcpServer';
import { useToolRegistry } from '../../hooks/useToolRegistry';

export function McpServerPanel() {
  const [port, setPort] = useState('3333');
  const server = useMcpServer();
  const registry = useToolRegistry();
  const tools = registry.tools;
  const calls = registry.calls;
  const canStart = server.capabilities.httpListen || (server.capabilities.execAsync && server.capabilities.fsRead && server.capabilities.fsWrite);
  const running = server.state.running;
  const transportLabel = running ? `${server.state.transport} · ${server.state.url || 'localhost'}` : (server.state.capabilityBanner || 'tools stay local until a host listener is available');
  const toolList = tools.length ? tools.map((tool) => (
    <ToolCard
      key={tool.name}
      tool={tool}
      recentCalls={calls.filter((call) => call.tool === tool.name)}
    />
  )) : (
    <Box style={{ padding: 10, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
      <Text fontSize={9} color={COLORS.textDim}>No tools registered yet. Use `registerTool(...)` from code.</Text>
    </Box>
  );

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>MCP Server</Text>
          <Text fontSize={9} color={COLORS.textDim}>{transportLabel}</Text>
        </Col>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <TextInput value={port} onChangeText={setPort} style={{ width: 72, height: 28, paddingLeft: 8, paddingRight: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontFamily: TOKENS.fontMono, fontSize: 10 }} />
          <Pressable onPress={() => running ? server.stopServer() : server.startServer(Number(port) || 3333)}>
            <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: running ? COLORS.red : COLORS.blue, backgroundColor: running ? COLORS.redDeep : COLORS.blueDeep }}>
              <Text fontSize={10} color={running ? COLORS.red : COLORS.blue} style={{ fontWeight: 'bold' }}>{running ? 'stop' : 'start'}</Text>
            </Box>
          </Pressable>
        </Row>
      </Row>

      {server.state.lastError || server.state.capabilityBanner ? (
        <Box style={{ margin: 12, padding: 10, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
          <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>
            {server.state.lastError || server.state.capabilityBanner}
          </Text>
        </Box>
      ) : null}

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 12, padding: 12 }}>
        <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <Col style={{ gap: 10, paddingRight: 2 }}>
            <Text fontSize={10} color={COLORS.purple} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>REGISTERED TOOLS</Text>
            {toolList}
          </Col>
        </ScrollView>

        <ScrollView showScrollbar={true} style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
          <Col style={{ gap: 12, paddingLeft: 2 }}>
            <ClientList clients={server.snapshot.state.clients} onDisconnect={server.disconnectClient} />
            <ToolLog calls={calls} />
            {!canStart ? (
              <Box style={{ padding: 10, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
                <Text fontSize={9} color={COLORS.yellow}>No supported transport is available yet. The panel is ready, but the host still needs `__http_listen` or the bridge pair (`__exec_async` + `__fs_readfile` + `__fs_writefile`) before external clients can connect.</Text>
              </Box>
            ) : null}
          </Col>
        </ScrollView>
      </Row>
    </Col>
  );
}

export default McpServerPanel;
