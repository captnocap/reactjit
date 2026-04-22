const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';

function StatusSegment(props: any) {
  return (
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
      }}
    >
      {props.children}
    </Pressable>
  );
}

function Dot(props: { color: string }) {
  return <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: props.color }} />;
}

export function StatusBar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';

  return (
    <Row
      style={{
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
        backgroundColor: COLORS.panelAlt,
        borderTopWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Git branch */}
        <StatusSegment onPress={props.onOpenGitPanel}>
          <Dot color={COLORS.green} />
          <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.gitRemote}</Text> : null}
        </StatusSegment>

        {/* Ahead / Behind */}
        {!compactBand ? (
          <StatusSegment onPress={props.onOpenGitPanel}>
            <Text fontSize={10} color={props.branchAhead > 0 ? COLORS.green : COLORS.textDim}>↑{props.branchAhead}</Text>
            <Text fontSize={10} color={props.branchBehind > 0 ? COLORS.red : COLORS.textDim}>↓{props.branchBehind}</Text>
          </StatusSegment>
        ) : null}

        {/* Dirty / Staged */}
        <StatusSegment onPress={props.onOpenGitPanel}>
          {props.changedCount > 0 ? <Text fontSize={10} color={COLORS.yellow}>{'M' + props.changedCount}</Text> : null}
          {!mediumBand && props.stagedCount > 0 ? <Text fontSize={10} color={COLORS.green}>{'S' + props.stagedCount}</Text> : null}
        </StatusSegment>

        {/* Indexing status */}
        {!compactBand ? (
          <StatusSegment onPress={props.onOpenSettings ? () => props.onOpenSettings('index') : undefined}>
            <Text fontSize={10} color={COLORS.blue}>
              {props.indexStats && props.indexStats.totalFiles > 0 ? `${props.indexStats.totalFiles} files` : 'idx 0'}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Tokenization */}
        {!compactBand ? (
          <StatusSegment onPress={props.onOpenSettings ? () => props.onOpenSettings('memory') : undefined}>
            <Text fontSize={10} color={COLORS.purple}>
              {props.indexStats && props.indexStats.totalTokens > 0 ? `${Math.round(props.indexStats.totalTokens / 1000)}k tok` : '0 tok'}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Memory / telemetry */}
        {!compactBand && !mediumBand ? (
          <StatusSegment onPress={props.onOpenSettings ? () => props.onOpenSettings('memory') : undefined}>
            <Text fontSize={10} color={COLORS.textDim}>
              {props.inputTokenEstimate > 0 ? `in ${props.inputTokenEstimate}` : '—'}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Cursor position */}
        <StatusSegment>
          <Text fontSize={10} color={COLORS.textDim}>Ln {props.cursorLine}</Text>
          <Text fontSize={10} color={COLORS.textDim}>Col {props.cursorColumn}</Text>
        </StatusSegment>
      </Row>

      <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {/* File name */}
        {!mediumBand ? (
          <StatusSegment>
            <Text fontSize={10} color={COLORS.textDim}>
              {props.fileName === '__landing__' ? props.workDir : props.fileName === '__settings__' ? 'Settings' : props.fileName}
            </Text>
          </StatusSegment>
        ) : null}

        {/* Line ending */}
        {!compactBand ? (
          <StatusSegment onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}>
            <Text fontSize={10} color={COLORS.textDim}>{props.lineEnding || 'LF'}</Text>
          </StatusSegment>
        ) : null}

        {/* Encoding */}
        {!compactBand ? (
          <StatusSegment onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}>
            <Text fontSize={10} color={COLORS.textDim}>{props.encoding || 'UTF-8'}</Text>
          </StatusSegment>
        ) : null}

        {/* Language */}
        <StatusSegment onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}>
          <Text fontSize={10} color={COLORS.textDim}>{props.languageMode}</Text>
        </StatusSegment>

        {/* Model */}
        {!compactBand ? (
          <StatusSegment onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}>
            <Text fontSize={10} color={COLORS.blue}>{props.selectedModel}</Text>
          </StatusSegment>
        ) : null}

        {/* Agent status */}
        <StatusSegment onPress={props.onOpenChat}>
          <Dot color={props.agentStatusText && props.agentStatusText !== 'idle' ? COLORS.yellow : COLORS.textDim} />
          <Text fontSize={10} color={props.agentStatusText && props.agentStatusText !== 'idle' ? COLORS.yellow : COLORS.textDim}>
            {props.agentStatusText || 'idle'}
          </Text>
        </StatusSegment>
      </Row>
    </Row>
  );
}
