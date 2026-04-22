const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Icon } from './icons';
import { Tooltip } from './tooltip';
import {
  Sparkline,
  XPBar,
  useSparklineSampler,
  useDeltaSampler,
  useFPSSampler,
} from './sparkline';

// ── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string): void {
  const host: any = globalThis;
  if (typeof host.__clipboard_set === 'function') {
    try { host.__clipboard_set(text); } catch {}
  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try { navigator.clipboard.writeText(text); } catch {}
  }
}

function StatusSegment(props: any) {
  const content = (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 2,
        paddingBottom: 2,
        borderRadius: 4,
        position: 'relative',
        backgroundColor: 'transparent',
      }}
    >
      {props.children}
    </Pressable>
  );
  if (!props.tooltip) return content;
  return <Tooltip label={props.tooltip} side={props.side || 'top'}>{content}</Tooltip>;
}

function Dot(props: { color: string }) {
  return <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: props.color }} />;
}

// ── Component ────────────────────────────────────────────────────────────────

export function StatusBar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';

  const indexStats = props.indexStats || { totalFiles: 0, totalTokens: 0 };
  const agentActive = props.agentStatusText && props.agentStatusText !== 'idle';
  const agentColor = agentActive ? COLORS.yellow : COLORS.textDim;

  // Sparkline samplers (last 60 samples)
  const fpsSamples = useFPSSampler(60);
  const memSamples = useSparklineSampler(() => {
    const h = globalThis as any;
    return h.__heapSize || 0;
  }, 1000, 60);
  const bridgeSamples = useDeltaSampler(() => {
    const h = globalThis as any;
    return h.__cmdCount || 0;
  }, 1000, 60);

  return (
    <Row
      style={{
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 0,
        backgroundColor: COLORS.panelAlt,
        borderTopWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Git branch — click copies name */}
        <StatusSegment
          onPress={() => copyToClipboard(props.gitBranch)}
          tooltip="Click to copy branch"
        >
          <Icon name="git-branch" size={12} color={COLORS.green} />
          <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.gitRemote}</Text> : null}
        </StatusSegment>

        {/* Ahead / Behind */}
        {!compactBand ? (
          <StatusSegment onPress={props.onOpenGitPanel} tooltip="Ahead / behind upstream">
            <Text fontSize={10} color={props.branchAhead > 0 ? COLORS.green : COLORS.textDim}>↑{props.branchAhead}</Text>
            <Text fontSize={10} color={props.branchBehind > 0 ? COLORS.red : COLORS.textDim}>↓{props.branchBehind}</Text>
          </StatusSegment>
        ) : null}

        {/* Dirty / Staged */}
        <StatusSegment onPress={props.onOpenGitPanel} tooltip="Modified / staged files">
          {props.changedCount > 0 ? <Icon name="warn" size={12} color={COLORS.yellow} /> : null}
          {props.changedCount > 0 ? <Text fontSize={10} color={COLORS.yellow}>{props.changedCount}</Text> : null}
          {!mediumBand && props.stagedCount > 0 ? <Icon name="error" size={12} color={COLORS.green} /> : null}
          {!mediumBand && props.stagedCount > 0 ? <Text fontSize={10} color={COLORS.green}>{props.stagedCount}</Text> : null}
        </StatusSegment>

        {/* FPS sparkline */}
        {!compactBand ? (
          <StatusSegment tooltip="FPS (last 60s)">
            <Sparkline data={fpsSamples} color={COLORS.green} width={20} height={12} gap={0} />
            <Text fontSize={9} color={COLORS.green}>{fpsSamples.length > 0 ? fpsSamples[fpsSamples.length - 1] : '—'}</Text>
          </StatusSegment>
        ) : null}

        {/* Memory sparkline */}
        {!compactBand ? (
          <StatusSegment tooltip="Heap size (last 60s)">
            <Sparkline data={memSamples} color={COLORS.orange} width={20} height={12} gap={0} />
            <Text fontSize={9} color={COLORS.orange}>
              {memSamples.length > 0 ? `${Math.round((memSamples[memSamples.length - 1] / 1024 / 1024))}M` : '—'}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Bridge traffic sparkline */}
        {!compactBand ? (
          <StatusSegment tooltip="Bridge commands/sec (last 60s)">
            <Sparkline data={bridgeSamples} color={COLORS.blue} width={20} height={12} gap={0} />
            <Text fontSize={9} color={COLORS.blue}>
              {bridgeSamples.length > 0 ? bridgeSamples[bridgeSamples.length - 1] : '—'}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Indexing — XP/level-style bar */}
        {!compactBand ? (
          <StatusSegment
            onPress={props.onOpenSettings ? () => props.onOpenSettings('index') : undefined}
            tooltip={`Indexed: ${indexStats.totalFiles} files`}
          >
            <XPBar
              fill={Math.min(1, indexStats.totalFiles / 500)}
              color={COLORS.blue}
              glow={indexStats.totalFiles > 0}
              width={50}
              height={6}
              label={`LV${Math.floor(indexStats.totalFiles / 50)}`}
            />
          </StatusSegment>
        ) : null}

        {/* Tokenization — thin bar */}
        {!compactBand ? (
          <StatusSegment
            onPress={props.onOpenSettings ? () => props.onOpenSettings('memory') : undefined}
            tooltip={`Tokens: ${indexStats.totalTokens.toLocaleString()}`}
          >
            <Box style={{ width: 36, height: 3, backgroundColor: COLORS.grayChip, borderRadius: 2, overflow: 'hidden' }}>
              <Box style={{ width: `${Math.min(1, indexStats.totalTokens / 100000) * 100}%`, height: 3, backgroundColor: COLORS.purple }} />
            </Box>
            <Text fontSize={9} color={COLORS.purple}>
              {indexStats.totalTokens > 0 ? `${Math.round(indexStats.totalTokens / 1000)}k` : '0'}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Memory / telemetry */}
        {!compactBand && !mediumBand ? (
          <StatusSegment
            onPress={props.onOpenSettings ? () => props.onOpenSettings('memory') : undefined}
            tooltip={`Input token estimate: ${props.inputTokenEstimate || 0}`}
          >
            <Text fontSize={10} color={COLORS.textDim}>
              {props.inputTokenEstimate > 0 ? `in ${props.inputTokenEstimate}` : '—'}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Cursor position */}
        <StatusSegment tooltip={`Ln ${props.cursorLine}, Col ${props.cursorColumn}`}>
          <Text fontSize={10} color={COLORS.textDim}>Ln {props.cursorLine}</Text>
          <Text fontSize={10} color={COLORS.textDim}>Col {props.cursorColumn}</Text>
        </StatusSegment>
      </Row>

      <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {/* File name */}
        {!mediumBand ? (
          <StatusSegment tooltip="Current file">
            <Text fontSize={10} color={COLORS.textDim}>
              {props.fileName === '__landing__' ? props.workDir : props.fileName === '__settings__' ? 'Settings' : props.fileName}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Line ending */}
        {!compactBand ? (
          <StatusSegment
            onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
            tooltip="Line ending"
          >
            <Text fontSize={10} color={COLORS.textDim}>{props.lineEnding || 'LF'}</Text>
          </StatusSegment>
        ) : null}

        {/* Encoding */}
        {!compactBand ? (
          <StatusSegment
            onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
            tooltip="Encoding"
          >
            <Text fontSize={10} color={COLORS.textDim}>{props.encoding || 'UTF-8'}</Text>
          </StatusSegment>
        ) : null}

        {/* Language */}
        <StatusSegment
          onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
          tooltip="Language mode"
        >
          <Text fontSize={10} color={COLORS.textDim}>{props.languageMode}</Text>
        </StatusSegment>

        {/* Model */}
        {!compactBand ? (
          <StatusSegment
            onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
            tooltip="Active model"
          >
            <Text fontSize={10} color={COLORS.blue}>{props.selectedModel}</Text>
          </StatusSegment>
        ) : null}

        {/* Agent status */}
        <StatusSegment onPress={props.onOpenChat} tooltip={`Agent status — click to open chat`}>
          <Dot color={agentColor} />
          <Text fontSize={10} color={agentColor}>
            {props.agentStatusText || 'idle'}
          </Text>
        </StatusSegment>

        {props.onOpenSettings ? (
          <StatusSegment onPress={() => props.onOpenSettings('providers')} tooltip="Settings">
            <Icon name="settings" size={12} color={COLORS.textDim} />
            {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>Settings</Text> : null}
          </StatusSegment>
        ) : null}
      </Row>
    </Row>
  );
}
