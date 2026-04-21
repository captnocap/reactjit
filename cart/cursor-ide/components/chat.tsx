const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextArea } from '../../../runtime/primitives';
import { baseName, COLORS } from '../theme';
import { Glyph, Pill } from './shared';
import { getModelIconInfo } from '../model-icons';
import { findModelById } from '../providers';
import { expandVariables, hasVariables, type ExpansionResult } from '../variables';
import { usePulse } from '../anim';
import { useComposerHistory, useMessageSearch, useTypingDots } from '../chat-hooks';
import { exportConversation, copyToClipboard, saveConversationToFile } from '../chat-export';

export function ToolCallCard(props: any) {
  const execItem = props.exec;
  const statusColor = execItem.status === 'completed' ? COLORS.green : execItem.status === 'error' ? COLORS.red : COLORS.blue;
  return (
    <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{execItem.name}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{execItem.input}</Text>
        <Pill label={execItem.status} color={statusColor} borderColor={statusColor} backgroundColor={COLORS.panelRaised} tiny={true} />
      </Row>
      <Text fontSize={10} color={COLORS.text}>{execItem.result}</Text>
    </Box>
  );
}

function ModelIconBadge(props: { modelId: string; size?: number }) {
  const info = getModelIconInfo(props.modelId);
  const size = props.size || 14;
  return (
    <Box style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: info.color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>{info.initial}</Text>
    </Box>
  );
}

function VariablePreview(props: { results: ExpansionResult[] }) {
  return (
    <Col style={{ gap: 4, padding: 8, borderRadius: 8, backgroundColor: '#0f1520' }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Variable Preview</Text>
      {props.results.map(r => (
        <Row key={r.variable} style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.blue} style={{ fontFamily: 'monospace' }}>{'{{' + r.variable + '}'}</Text>
          {r.data !== undefined ? (
            <Text fontSize={9} color={COLORS.green}>{r.data}</Text>
          ) : (
            <Text fontSize={9} color={COLORS.red}>{r.error}</Text>
          )}
        </Row>
      ))}
    </Col>
  );
}

const SLASH_COMMANDS = [
  { cmd: '/model', desc: 'Cycle through enabled models' },
  { cmd: '/plan', desc: 'Switch to plan mode' },
  { cmd: '/default', desc: 'Use default model' },
  { cmd: '/clear', desc: 'Clear conversation' },
  { cmd: '/index', desc: 'Index workspace' },
  { cmd: '/git', desc: 'Show git status' },
  { cmd: '/help', desc: 'List commands' },
];

function getActiveToken(input: string): { token: string; startIndex: number } {
  const lastSpace = input.lastIndexOf(' ');
  if (lastSpace >= 0) {
    return { token: input.slice(lastSpace + 1), startIndex: lastSpace + 1 };
  }
  return { token: input, startIndex: 0 };
}

function fuzzyMatch(query: string, path: string): boolean {
  const q = query.toLowerCase();
  const p = path.toLowerCase();
  if (p.includes(q)) return true;
  // Simple fuzzy: every char in query appears in order in path
  let pi = 0;
  for (let i = 0; i < q.length; i++) {
    const idx = p.indexOf(q[i], pi);
    if (idx < 0) return false;
    pi = idx + 1;
  }
  return true;
}

function ContextMeter(props: { messages: any[]; modelId: string }) {
  const model = findModelById(props.modelId);
  const limit = model?.contextWindow || 200000;
  // Rough token estimate: 1 token ≈ 4 chars
  const textLength = props.messages.reduce((sum: number, m: any) => sum + (m.text?.length || 0), 0);
  const tokens = Math.ceil(textLength / 4);
  const pct = Math.min(100, Math.round((tokens / limit) * 100));
  const color = pct > 80 ? COLORS.red : pct > 50 ? COLORS.yellow : COLORS.green;
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Box style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={7} color={color} style={{ fontWeight: 'bold' }}>{pct}%</Text>
      </Box>
      {!props.messages.length || props.messages.length < 2 ? null : (
        <Text fontSize={9} color={COLORS.textDim}>{tokens.toLocaleString()} / {limit.toLocaleString()}</Text>
      )}
    </Row>
  );
}

function GeneratingIndicator(props: { toolExecutions: any[] }) {
  const pulse = usePulse(0.5, 1, 1200);
  return (
    <Col style={{ gap: 8 }}>
      {props.toolExecutions.length > 0 ? (
        <Box style={{ gap: 8 }}>
          <Text fontSize={10} color={COLORS.textDim}>Live tool calls</Text>
          {props.toolExecutions.map((execItem: any) => <ToolCallCard key={execItem.id} exec={execItem} />)}
        </Box>
      ) : null}
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Box style={{ opacity: pulse }}>
          <Glyph icon="bot" tone={COLORS.green} backgroundColor="#143120" tiny={true} />
        </Box>
        <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={10} color={COLORS.textDim}>
            {props.toolExecutions.some((item: any) => item.status === 'running') ? 'running tool chain' : 'thinking'}
          </Text>
        </Box>
        <Row style={{ gap: 2 }}>
          {[0, 1, 2].map(i => (
            <Box key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.green, opacity: (Date.now() / 400 + i) % 3 > 1.5 ? 1 : 0.3 }} />
          ))}
        </Row>
      </Row>
    </Col>
  );
}

export function ChatSurface(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';
  const focusLabel = props.currentFilePath === '__landing__' ? props.workspaceName : props.currentFilePath === '__settings__' ? 'Settings' : props.currentFilePath;
  const sendLabel = props.agentMode === 'agent' ? 'Launch' : props.agentMode === 'task' ? 'Run Task' : props.agentMode === 'plan' ? 'Plan' : 'Send';
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { push: pushHistory, navigate: navigateHistory, reset: resetHistory } = useComposerHistory();
  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, active: searchActive } = useMessageSearch(props.messages || []);

  // Variable expansion preview
  const varResults: ExpansionResult[] = props.variablePreview || [];
  const showVarPreview = hasVariables(props.currentInput) && varResults.length > 0;

  // ── Composer menu state ──
  const { token, startIndex } = getActiveToken(props.currentInput);
  const menuType = token.startsWith('/') ? 'slash' : token.startsWith('@') ? 'at' : null;
  const query = token.slice(1);

  let menuItems: Array<{ label: string; desc: string; value: string }> = [];
  if (menuType === 'slash') {
    menuItems = SLASH_COMMANDS
      .filter((item) => query.length === 0 || item.cmd.slice(1).toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({ label: item.cmd, desc: item.desc, value: item.cmd + ' ' }));
  } else if (menuType === 'at') {
    const files = props.workspaceFiles || [];
    menuItems = files
      .filter((path: string) => query.length === 0 || fuzzyMatch(query, path))
      .slice(0, 8)
      .map((path: string) => ({ label: path, desc: baseName(path), value: '@' + path + ' ' }));
  }

  const menuOpen = menuItems.length > 0;
  const safeHighlight = menuItems.length > 0 ? Math.min(highlightedIndex, menuItems.length - 1) : 0;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [props.currentInput]);

  function insertMenuItem(value: string) {
    const before = props.currentInput.slice(0, startIndex);
    props.onInputChange(before + value);
  }

  function handleComposerKey(payload: any) {
    const key = payload.keyCode;
    if (menuOpen) {
      // Enter = 13, Escape = 27, Up = 82 (SDLK_UP), Down = 81 (SDLK_DOWN)
      if (key === 13) {
        const item = menuItems[safeHighlight];
        if (item) insertMenuItem(item.value);
      } else if (key === 27) {
        const before = props.currentInput.slice(0, startIndex);
        props.onInputChange(before);
      } else if (key === 81) {
        setHighlightedIndex((prev) => Math.min(prev + 1, menuItems.length - 1));
      } else if (key === 82) {
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
      return;
    }
    // History navigation when not in menu
    if (key === 82) { // Up
      const { text, moved } = navigateHistory('up', props.currentInput);
      if (moved) props.onInputChange(text);
    } else if (key === 81) { // Down
      const { text, moved } = navigateHistory('down', props.currentInput);
      if (moved) props.onInputChange(text);
    }
  }

  function doSend() {
    pushHistory(props.currentInput);
    resetHistory();
    props.onSend();
  }

  return (
    <Col style={{ width: props.style?.width || '100%', height: '100%', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Agent Console</Text>
          <Row style={{ alignItems: 'center', gap: 4 }}>
            <ModelIconBadge modelId={props.selectedModel} />
            <Pill label={props.selectedModel} color={COLORS.blue} tiny={true} />
          </Row>
          <ContextMeter messages={props.messages} modelId={props.selectedModel} />
        </Row>
        <Row style={{ gap: 8 }}>
          <Pressable onPress={() => setShowSearch(!showSearch)}><Text fontSize={10} color={showSearch ? COLORS.blue : COLORS.textDim}>Search</Text></Pressable>
          <Pressable onPress={() => setShowExportMenu(!showExportMenu)}><Text fontSize={10} color={showExportMenu ? COLORS.blue : COLORS.textDim}>Export</Text></Pressable>
          <Pressable onPress={props.onNewConversation}><Text fontSize={10} color={COLORS.blue}>New</Text></Pressable>
        </Row>
      </Row>

      {showSearch ? (
        <Row style={{ padding: 10, gap: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
          <Text fontSize={10} color={COLORS.textDim}>Search:</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search messages..."
            fontSize={11}
            color={COLORS.text}
            style={{ flexGrow: 1, height: 28, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingLeft: 8 }}
          />
          <Text fontSize={10} color={COLORS.textDim}>{searchResults.length} matches</Text>
          <Pressable onPress={() => { setShowSearch(false); setSearchQuery(''); }}><Text fontSize={10} color={COLORS.textDim}>✕</Text></Pressable>
        </Row>
      ) : null}

      {showExportMenu ? (
        <Col style={{ gap: 4, padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Export Conversation</Text>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pressable onPress={() => { copyToClipboard(exportConversation(props.messages, { format: 'markdown' })); setShowExportMenu(false); }}>
              <Pill label="Copy Markdown" color={COLORS.blue} tiny={true} />
            </Pressable>
            <Pressable onPress={() => { copyToClipboard(exportConversation(props.messages, { format: 'text' })); setShowExportMenu(false); }}>
              <Pill label="Copy Text" color={COLORS.blue} tiny={true} />
            </Pressable>
            <Pressable onPress={() => { const r = saveConversationToFile(props.messages, props.workDir || '.', { format: 'markdown' }); setShowExportMenu(false); }}>
              <Pill label="Save .md" color={COLORS.green} tiny={true} />
            </Pressable>
            <Pressable onPress={() => { const r = saveConversationToFile(props.messages, props.workDir || '.', { format: 'json' }); setShowExportMenu(false); }}>
              <Pill label="Save .json" color={COLORS.green} tiny={true} />
            </Pressable>
          </Row>
        </Col>
      ) : null}

      <Row style={{ padding: compactBand ? 10 : 12, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap' }}>
        {props.widthBand !== 'narrow' && props.widthBand !== 'widget' && props.widthBand !== 'minimum' ? <Pill label={'view ' + props.activeView} color={COLORS.textMuted} tiny={true} /> : null}
        <Pill label={'branch ' + props.gitBranch} color={COLORS.green} tiny={true} />
        {props.widthBand !== 'minimum' ? <Pill label={'focus ' + (compactBand && focusLabel.includes('/') ? baseName(focusLabel) : focusLabel)} color={COLORS.blue} tiny={true} /> : null}
        <Pill label={'dirty ' + props.changedCount} color={COLORS.yellow} tiny={true} />
      </Row>

      {props.agentStatusText === 'streaming' || props.agentStatusText === 'executing' || props.activeAgentId ? (
        <Row style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, gap: 8, alignItems: 'center', backgroundColor: COLORS.panelRaised, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: props.agentStatusText === 'streaming' ? COLORS.blue : props.agentStatusText === 'executing' ? COLORS.yellow : COLORS.green }} />
          <Text fontSize={10} color={COLORS.text}>
            {props.agentStatusText === 'streaming' ? 'streaming response' : props.agentStatusText === 'executing' ? 'running tools' : 'background agent active'}
          </Text>
          {props.activeAgentId ? <Pressable onPress={props.onStopAgent}><Text fontSize={10} color={COLORS.red}>Stop</Text></Pressable> : null}
        </Row>
      ) : null}

      <ScrollView style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, padding: 12 }}>
        <Col style={{ gap: 10 }}>
          {!minimumBand ? (
            <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
                {props.workspaceName + ' agent session'}
              </Text>
              <Text fontSize={10} color={COLORS.textDim}>
                {props.gitBranch + ' / ' + props.gitRemote + ' / ' + props.changedCount + ' dirty paths'}
              </Text>
            </Box>
          ) : null}

          {props.messages.map((msg: any, idx: number) => {
            const isUser = msg.role === 'user';
            return (
              <Col key={msg.role + '_' + idx + '_' + msg.text.slice(0, 16)} style={{ gap: 6 }}>
                <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Glyph icon={isUser ? 'message' : 'bot'} tone={isUser ? COLORS.blue : COLORS.green} backgroundColor={isUser ? '#17345d' : '#143120'} tiny={true} />
                  <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{isUser ? 'You' : 'Agent'}</Text>
                  <Text fontSize={10} color={COLORS.textDim}>{msg.time}</Text>
                  {msg.mode ? <Pill label={msg.mode} color={COLORS.blue} tiny={true} /> : null}
                  {msg.model ? (
                    <Row style={{ alignItems: 'center', gap: 4 }}>
                      <ModelIconBadge modelId={msg.model} />
                      <Pill label={msg.model} color={COLORS.textMuted} tiny={true} />
                    </Row>
                  ) : null}
                </Row>
                <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isUser ? '#20324f' : '#1c2531', backgroundColor: isUser ? '#101827' : '#10141c', gap: 8 }}>
                  <Text fontSize={11} color={COLORS.text}>{msg.text}</Text>
                  {msg.attachments && msg.attachments.length > 0 ? (
                    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                      {msg.attachments.map((attachment: any) => (
                        <Pill key={attachment.id} label={attachment.name} color={COLORS.blue} tiny={true} />
                      ))}
                    </Row>
                  ) : null}
                  {msg.toolSnapshot && msg.toolSnapshot.length > 0 ? (
                    <Col style={{ gap: 8 }}>
                      {msg.toolSnapshot.map((execItem: any) => <ToolCallCard key={execItem.id} exec={execItem} />)}
                    </Col>
                  ) : null}
                </Box>
              </Col>
            );
          })}

          {props.isGenerating ? (
            <GeneratingIndicator toolExecutions={props.toolExecutions} />
          ) : null}
        </Col>
      </ScrollView>

      <Col style={{ padding: compactBand ? 10 : 12, gap: 8, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {['ask', 'plan', 'task', 'agent'].map((mode) => (
            <Pressable
              key={mode}
              onPress={() => props.onSetMode(mode)}
              style={{
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: props.agentMode === mode ? (mode === 'task' ? COLORS.green : mode === 'agent' ? COLORS.orange : COLORS.blue) : COLORS.border,
                backgroundColor: props.agentMode === mode ? (mode === 'task' ? '#182510' : mode === 'agent' ? '#26180f' : COLORS.blueDeep) : COLORS.panelAlt,
              }}
            >
              <Text fontSize={10} color={props.agentMode === mode ? (mode === 'task' ? COLORS.green : mode === 'agent' ? COLORS.orange : COLORS.blue) : COLORS.text}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </Row>

        <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.textBright}>{focusLabel}</Text>
            {props.widthBand !== 'minimum' ? <Text fontSize={10} color={COLORS.textDim}>{props.gitBranch + ' / ' + props.gitRemote}</Text> : null}
          </Row>

          {props.attachments.length > 0 ? (
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {props.attachments.map((attachment: any) => (
                <Row key={attachment.id} style={{ alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                  <Text fontSize={10} color={COLORS.blue}>{attachment.name}</Text>
                  <Pressable onPress={() => props.onRemoveAttachment(attachment.id)}><Text fontSize={10} color={COLORS.textDim}>X</Text></Pressable>
                </Row>
              ))}
              <Pressable onPress={props.onClearAttachments}><Text fontSize={10} color={COLORS.red}>Clear</Text></Pressable>
            </Row>
          ) : null}

          {menuOpen ? (
            <Col style={{
              maxHeight: 200,
              gap: 2,
              padding: 6,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelAlt,
            }}>
              <Text fontSize={9} color={COLORS.textDim} style={{ paddingLeft: 4, paddingBottom: 4 }}>
                {menuType === 'slash' ? 'Commands' : 'Files'}
              </Text>
              {menuItems.map((item, idx) => (
                <Pressable
                  key={item.label}
                  onPress={() => insertMenuItem(item.value)}
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    backgroundColor: idx === safeHighlight ? COLORS.blueDeep : 'transparent',
                  }}
                >
                  <Row style={{ gap: 8, alignItems: 'center' }}>
                    <Text fontSize={10} color={idx === safeHighlight ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.label}</Text>
                    <Text fontSize={10} color={COLORS.textDim}>{item.desc}</Text>
                  </Row>
                </Pressable>
              ))}
            </Col>
          ) : null}

          <TextArea
            value={props.currentInput}
            onChange={props.onInputChange}
            onKeyDown={handleComposerKey}
            fontSize={11}
            color={COLORS.text}
            style={{ height: 84, borderWidth: 0, backgroundColor: 'transparent' }}
          />

          {showVarPreview ? <VariablePreview results={varResults} /> : null}

          <Col style={{ gap: 8 }}>
            <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pressable onPress={props.onAttachCurrentFile}><Text fontSize={10} color={COLORS.blue}>File</Text></Pressable>
              <Pressable onPress={props.onAttachSymbol}><Text fontSize={10} color={COLORS.blue}>Symbol</Text></Pressable>
              <Pressable onPress={props.onAttachGit}><Text fontSize={10} color={COLORS.blue}>Git</Text></Pressable>
              <Pressable onPress={props.onToggleWebSearch}><Text fontSize={10} color={props.webSearch ? COLORS.blue : COLORS.textDim}>Web</Text></Pressable>
              <Pressable onPress={props.onToggleTermAccess}><Text fontSize={10} color={props.termAccess ? COLORS.blue : COLORS.textDim}>Term</Text></Pressable>
              <Pressable onPress={props.onToggleAutoApply}><Text fontSize={10} color={props.autoApply ? COLORS.blue : COLORS.textDim}>Auto</Text></Pressable>
            </Row>
            <Row style={{ gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {props.inputTokenEstimate > 0 ? <Text fontSize={10} color={props.inputTokenEstimate > 16000 ? COLORS.red : props.inputTokenEstimate > 8000 ? COLORS.yellow : COLORS.textDim}>{props.inputTokenEstimate + ' tkns'}</Text> : null}
              <Pressable onPress={props.onCycleModel}>
                <Row style={{ alignItems: 'center', gap: 4 }}>
                  <ModelIconBadge modelId={props.selectedModel} size={12} />
                  <Text fontSize={10} color={COLORS.text}>{props.modelDisplayName}</Text>
                </Row>
              </Pressable>
              <Pressable onPress={props.onSend} style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: 10, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
                <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{sendLabel}</Text>
              </Pressable>
            </Row>
          </Col>
        </Box>

        {props.agentMode === 'task' ? <Text fontSize={10} color={COLORS.yellow}>Task mode can read the workspace, inspect git, and use the terminal.</Text> : null}
        {props.agentMode === 'plan' ? <Text fontSize={10} color={COLORS.blue}>Plan mode stays descriptive first, edit second.</Text> : null}
      </Col>
    </Col>
  );
}
