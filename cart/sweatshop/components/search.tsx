const React: any = require('react');
const { memo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { Pill } from './shared';

function SearchSurfaceImpl(props: any) {
  (globalThis as any).__hostLog?.(0, "[render] SearchSurface");
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';
  return (
    <Col style={{ width: props.style?.width || '100%', height: '100%', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Col style={{ padding: compactBand ? 12 : 14, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Project Search</Text>
          {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{props.workspaceName + ' / ' + props.gitBranch}</Text> : null}
          <Pressable onPress={props.onClose}><Text fontSize={11} color={COLORS.textDim}>X</Text></Pressable>
        </Row>
        <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <TextInput value={props.query} onChange={props.onQuery} placeholder="rg query" fontSize={11} color={COLORS.text} style={{ borderWidth: 0, backgroundColor: 'transparent' }} />
        </Box>
        {!minimumBand ? (
          <Row style={{ gap: 8 }}>
            <Pill label="repo" color={COLORS.blue} tiny={true} />
            <Pill label="case" color={COLORS.textDim} tiny={true} />
            <Pill label="regex" color={COLORS.textDim} tiny={true} />
          </Row>
        ) : null}
      </Col>
      <ScrollView style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, padding: 12 }}>
        <Col style={{ gap: 8 }}>
          {props.results.map((result: any) => (
            <Pressable key={result.file + ':' + result.line + ':' + result.text} onPress={() => props.onOpenResult(result.file, result.line)} style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
              <Row style={{ alignItems: 'center', gap: 6 }}>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{result.file}</Text>
                <Text fontSize={10} color={COLORS.textDim}>:{result.line}</Text>
                <Box style={{ flexGrow: 1 }} />
                <Pill label={String(result.matches)} color={COLORS.blue} tiny={true} />
              </Row>
              <Text fontSize={10} color={COLORS.text}>{result.text}</Text>
            </Pressable>
          ))}
        </Col>
      </ScrollView>
      {!minimumBand ? (
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textDim}>results in workspace</Text>
          <Pressable onPress={() => props.onQuery(props.query)}><Text fontSize={10} color={COLORS.blue}>Refresh</Text></Pressable>
        </Row>
      ) : null}
    </Col>
  );
}

export const SearchSurface = memo(SearchSurfaceImpl);
