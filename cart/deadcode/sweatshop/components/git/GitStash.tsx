
import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';
import type { GitStashEntry } from './useGitOps';

interface GitStashProps {
  stashes: GitStashEntry[];
  onApply: (ref: string) => void;
  onDrop: (ref: string) => void;
  onPop: () => void;
  onStash: () => void;
}

export function GitStash(props: GitStashProps) {
  return (
    <Col style={{ flexGrow: 1, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      <ScrollView showScrollbar={true} style={{ flexGrow: 1, padding: 8 }}>
        <Col style={{ gap: 4 }}>
          {props.stashes.map((s) => (
            <Row
              key={s.ref}
              style={{
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 8,
                backgroundColor: COLORS.panelRaised,
              }}
            >
              <Text fontSize={9} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>{s.ref}</Text>
              <Text fontSize={10} color={COLORS.text} style={{ flexShrink: 1, flexBasis: 0 }}>{s.message}</Text>
              <Box style={{ flexGrow: 1 }} />
              <Pressable onPress={() => props.onApply(s.ref)}>
                <Pill label="apply" color={COLORS.green} tiny={true} />
              </Pressable>
              <Pressable onPress={() => props.onDrop(s.ref)}>
                <Pill label="drop" color={COLORS.red} tiny={true} />
              </Pressable>
            </Row>
          ))}
        </Col>
      </ScrollView>

      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: 10,
          borderTopWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <Pressable onPress={props.onPop}>
          <Text fontSize={10} color={COLORS.orange}>Stash Pop</Text>
        </Pressable>
        <Pressable onPress={props.onStash}>
          <Text fontSize={10} color={COLORS.yellow}>Stash</Text>
        </Pressable>
      </Row>
    </Col>
  );
}
