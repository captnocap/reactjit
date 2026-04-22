const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';

interface GitCommitComposerProps {
  message: string;
  onChange: (msg: string) => void;
  onCommit: () => void;
  onAmend: () => void;
  stagedCount: number;
  suggestions: string[];
  showSuggest: boolean;
  onToggleSuggest: (show: boolean) => void;
  output: { ok: boolean; text: string } | null;
  onDismissOutput: () => void;
  diffStats: { additions: number; deletions: number; files: number };
  ahead: number;
  behind: number;
  onPush?: () => void;
  onPull?: () => void;
}

export function GitCommitComposer(props: GitCommitComposerProps) {
  const canCommit = props.message.trim().length > 0 && props.stagedCount > 0;

  return (
    <Col style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 10, gap: 6, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text fontSize={9} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>MESSAGE</Text>
        <Text fontSize={9} color={COLORS.textDim}>{props.stagedCount} staged</Text>
      </Row>

      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <TextInput
            value={props.message}
            onChangeText={(t: string) => {
              props.onChange(t);
              props.onToggleSuggest(t.trim().length > 0);
            }}
            placeholder="Commit message (summary of staged changes)"
            fontSize={11}
            color={COLORS.text}
            style={{
              height: 34,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 8,
              paddingLeft: 10,
              backgroundColor: COLORS.panelBg,
            }}
          />
        </Box>
        <Pressable onPress={props.onCommit}>
          <Box style={{
            paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            borderRadius: 8,
            backgroundColor: canCommit ? COLORS.blueDeep : COLORS.panelRaised,
            borderWidth: 1,
            borderColor: canCommit ? COLORS.blue : COLORS.border,
          }}>
            <Text fontSize={10} color={canCommit ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>Commit</Text>
          </Box>
        </Pressable>
        <Pressable onPress={props.onAmend}>
          <Box style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
            borderRadius: 8, backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.yellow,
          }}>
            <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>Amend</Text>
          </Box>
        </Pressable>
      </Row>

      {props.showSuggest && props.suggestions.length > 0 ? (
        <Col style={{ gap: 2, padding: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: 4, paddingRight: 4 }}>
            <Text fontSize={9} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>RECENT SUBJECTS</Text>
            <Pressable onPress={() => props.onToggleSuggest(false)}>
              <Text fontSize={9} color={COLORS.textDim}>hide</Text>
            </Pressable>
          </Row>
          {props.suggestions.map((s, i) => (
            <Pressable key={i} onPress={() => { props.onChange(s); props.onToggleSuggest(false); }} style={{ padding: 6, borderRadius: 6 }}>
              <Text fontSize={10} color={COLORS.text}>{s}</Text>
            </Pressable>
          ))}
        </Col>
      ) : null}

      {props.output && props.output.text ? (
        <Col style={{ gap: 4, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: props.output.ok ? COLORS.border : COLORS.red, backgroundColor: props.output.ok ? COLORS.panelRaised : COLORS.redDeep }}>
          <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Text fontSize={9} color={props.output.ok ? COLORS.textMuted : COLORS.red} style={{ fontWeight: 'bold' }}>
              {props.output.ok ? 'COMMIT OUTPUT' : 'COMMIT REJECTED'}
            </Text>
            <Pressable onPress={props.onDismissOutput}>
              <Text fontSize={9} color={COLORS.textDim}>dismiss</Text>
            </Pressable>
          </Row>
          <Text fontSize={9} color={props.output.ok ? COLORS.textDim : COLORS.red} style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {props.output.text}
          </Text>
        </Col>
      ) : null}

      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Row style={{ gap: 6 }}>
          {props.diffStats.additions > 0 ? <Pill label={'+' + props.diffStats.additions} color={COLORS.green} tiny={true} /> : null}
          {props.diffStats.deletions > 0 ? <Pill label={'-' + props.diffStats.deletions} color={COLORS.red} tiny={true} /> : null}
          <Pill label={props.diffStats.files + ' files'} color={COLORS.textDim} tiny={true} />
        </Row>
        <Row style={{ gap: 8 }}>
          {props.ahead > 0 && props.onPush ? (
            <Pressable onPress={props.onPush}>
              <Pill label={'Push ' + props.ahead} color={COLORS.blue} tiny={true} />
            </Pressable>
          ) : null}
          {props.behind > 0 && props.onPull ? (
            <Pressable onPress={props.onPull}>
              <Pill label={'Pull ' + props.behind} color={COLORS.orange} tiny={true} />
            </Pressable>
          ) : null}
        </Row>
      </Row>
    </Col>
  );
}
