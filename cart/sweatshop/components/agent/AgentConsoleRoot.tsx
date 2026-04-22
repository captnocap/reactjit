const React: any = require('react');
const { useState, useEffect } = React;
import { Box, Col, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable, Pill } from '../shared';
import { baseName } from '../../theme';
import { exportConversation, copyToClipboard } from '../../chat-export';
import { useComposerHistory, useMessageSearch, useConversationList, useScrollBottomStub } from '../../chat-hooks';
import { expandVariables, hasVariables } from '../../variables';
import { AgentHeader } from './AgentHeader';
import { ExportMenu } from './ExportMenu';
import { SessionSwitcher } from './SessionSwitcher';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { Tooltip } from '../tooltip';

function SearchBar(props: {
  query: string;
  onChange: (q: string) => void;
  matches: number;
  onClose: () => void;
}) {
  return (
    <Row style={{ padding: 10, gap: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Text fontSize={10} color={COLORS.textDim}>Search:</Text>
      <TextInput
        value={props.query}
        onChangeText={props.onChange}
        placeholder="Search messages..."
        fontSize={11}
        color={COLORS.text}
        style={{ flexGrow: 1, height: 28, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingLeft: 8 }}
      />
      <Text fontSize={10} color={COLORS.textDim}>{props.matches} matches</Text>
      <Tooltip label="Close search" side="bottom">
        <HoverPressable onPress={props.onClose} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
          <Text fontSize={10} color={COLORS.textDim}>✕</Text>
        </HoverPressable>
      </Tooltip>
    </Row>
  );
}

function ContextPills(props: {
  widthBand: string;
  activeView: string;
  gitBranch: string;
  focusLabel: string;
  changedCount: number;
  compactBand: boolean;
}) {
  return (
    <Row style={{ padding: props.compactBand ? 10 : 12, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap' }}>
      {props.widthBand !== 'narrow' && props.widthBand !== 'widget' && props.widthBand !== 'minimum' ? (
        <Pill label={'view ' + props.activeView} color={COLORS.textMuted} tiny={true} />
      ) : null}
      <Pill label={'branch ' + props.gitBranch} color={COLORS.green} tiny={true} />
      {props.widthBand !== 'minimum' ? (
        <Pill label={'focus ' + (props.compactBand && props.focusLabel.includes('/') ? baseName(props.focusLabel) : props.focusLabel)} color={COLORS.blue} tiny={true} />
      ) : null}
      <Pill label={'dirty ' + props.changedCount} color={COLORS.yellow} tiny={true} />
    </Row>
  );
}

function AgentStatusBar(props: {
  agentStatusText: string;
  activeAgentId?: string;
  onStopAgent?: () => void;
}) {
  if (props.agentStatusText !== 'streaming' && props.agentStatusText !== 'executing' && !props.activeAgentId) return null;
  return (
    <Row style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, gap: 8, alignItems: 'center', backgroundColor: COLORS.panelRaised, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
      <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: props.agentStatusText === 'streaming' ? COLORS.blue : props.agentStatusText === 'executing' ? COLORS.yellow : COLORS.green }} />
      <Text fontSize={10} color={COLORS.text}>
        {props.agentStatusText === 'streaming' ? 'streaming response' : props.agentStatusText === 'executing' ? 'running tools' : 'background agent active'}
      </Text>
      {props.activeAgentId ? (
        <Tooltip label="Stop the active agent" side="bottom">
          <HoverPressable onPress={props.onStopAgent} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Text fontSize={10} color={COLORS.red}>Stop</Text>
          </HoverPressable>
        </Tooltip>
      ) : null}
    </Row>
  );
}

export function AgentConsoleRoot(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';
  const messages = Array.isArray(props.messages) ? props.messages : [];
  const attachments = Array.isArray(props.attachments) ? props.attachments : [];
  const toolExecutions = Array.isArray(props.toolExecutions) ? props.toolExecutions : [];
  const workspaceFiles = Array.isArray(props.workspaceFiles) ? props.workspaceFiles : [];
  const variablePreview = Array.isArray(props.variablePreview) ? props.variablePreview : [];
  const currentInput = typeof props.currentInput === 'string' ? props.currentInput : '';
  const currentFilePath = typeof props.currentFilePath === 'string' ? props.currentFilePath : '';
  const workspaceName = typeof props.workspaceName === 'string' ? props.workspaceName : 'workspace';
  const gitBranch = typeof props.gitBranch === 'string' ? props.gitBranch : 'main';
  const gitRemote = typeof props.gitRemote === 'string' ? props.gitRemote : 'origin';
  const selectedModel = typeof props.selectedModel === 'string' && props.selectedModel ? props.selectedModel : 'unknown';
  const modelDisplayName = typeof props.modelDisplayName === 'string' && props.modelDisplayName ? props.modelDisplayName : selectedModel;
  const agentMode = typeof props.agentMode === 'string' ? props.agentMode : 'ask';
  const activeView = typeof props.activeView === 'string' ? props.activeView : 'landing';
  const changedCount = typeof props.changedCount === 'number' ? props.changedCount : 0;
  const inputTokenEstimate = typeof props.inputTokenEstimate === 'number' ? props.inputTokenEstimate : 0;
  const focusLabel = currentFilePath === '__landing__' ? workspaceName : currentFilePath === '__settings__' ? 'Settings' : currentFilePath;
  const sendLabel = agentMode === 'agent' ? 'Launch' : agentMode === 'task' ? 'Run Task' : agentMode === 'plan' ? 'Plan' : 'Send';

  const [showSearch, setShowSearch] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const { push: pushHistory, navigate: navigateHistory, reset: resetHistory } = useComposerHistory();
  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults } = useMessageSearch(messages);
  const { conversations, addConversation, deleteConversation } = useConversationList();
  const { showScrollButton, scrollToBottom } = useScrollBottomStub(messages, props.isGenerating);

  const varResults = variablePreview;
  const showVarPreview = hasVariables(currentInput) && varResults.length > 0;

  function doSend() {
    pushHistory(currentInput);
    resetHistory();
    props.onSend();
  }

  return (
    <Col style={{ width: props.style?.width || '100%', height: '100%', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <AgentHeader
        selectedModel={selectedModel}
        messages={messages}
        showSidebar={showSidebar}
        showSearch={showSearch}
        showExportMenu={showExportMenu}
        compactBand={compactBand}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onToggleSearch={() => setShowSearch(!showSearch)}
        onToggleExportMenu={() => setShowExportMenu(!showExportMenu)}
        onNewConversation={props.onNewConversation}
        onExportMarkdown={() => copyToClipboard(exportConversation(messages, { format: 'markdown' }))}
      />

      {showSearch ? (
        <SearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          matches={searchResults.length}
          onClose={() => { setShowSearch(false); setSearchQuery(''); }}
        />
      ) : null}

      {showExportMenu ? (
        <ExportMenu messages={messages} workDir={props.workDir} onClose={() => setShowExportMenu(false)} />
      ) : null}

      <ContextPills
        widthBand={props.widthBand}
        activeView={activeView}
        gitBranch={gitBranch}
        focusLabel={focusLabel}
        changedCount={changedCount}
        compactBand={compactBand}
      />

      <AgentStatusBar
        agentStatusText={props.agentStatusText}
        activeAgentId={props.activeAgentId}
        onStopAgent={props.onStopAgent}
      />

      <Row style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        <SessionSwitcher
          conversations={conversations}
          onSelect={(id) => props.onLoadConversation?.(id)}
          onDelete={deleteConversation}
          onNew={props.onNewConversation}
          onSave={() => addConversation(messages)}
          visible={showSidebar && !compactBand}
        />
        <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <MessageList
            messages={messages}
            workspaceName={workspaceName}
            gitBranch={gitBranch}
            gitRemote={gitRemote}
            changedCount={changedCount}
            compactBand={compactBand}
            minimumBand={minimumBand}
            isGenerating={props.isGenerating}
            toolExecutions={toolExecutions}
            showScrollButton={showScrollButton}
            onScrollToBottom={scrollToBottom}
          />
          <Composer
            currentInput={currentInput}
            agentMode={agentMode}
            compactBand={compactBand}
            attachments={attachments}
            inputTokenEstimate={inputTokenEstimate}
            showVarPreview={showVarPreview}
            varResults={varResults}
            workspaceFiles={workspaceFiles}
            onInputChange={props.onInputChange}
            onSend={doSend}
            onSetMode={props.onSetMode}
            onAttachCurrentFile={props.onAttachCurrentFile}
            onAttachSymbol={props.onAttachSymbol}
            onAttachGit={props.onAttachGit}
            onToggleWebSearch={props.onToggleWebSearch}
            onToggleTermAccess={props.onToggleTermAccess}
            onToggleAutoApply={props.onToggleAutoApply}
            onRemoveAttachment={props.onRemoveAttachment}
            onClearAttachments={props.onClearAttachments}
            onCycleModel={props.onCycleModel}
            modelDisplayName={modelDisplayName}
            sendLabel={sendLabel}
            handleComposerKey={(payload: any) => {
              const key = payload.keyCode;
              if (key === 82) {
                const { text, moved } = navigateHistory('up', currentInput);
                if (moved) props.onInputChange(text);
              } else if (key === 81) {
                const { text, moved } = navigateHistory('down', currentInput);
                if (moved) props.onInputChange(text);
              }
            }}
          />
        </Col>
      </Row>
    </Col>
  );
}
