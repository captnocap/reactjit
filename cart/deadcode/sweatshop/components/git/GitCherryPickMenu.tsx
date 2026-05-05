
import { Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';

interface GitCherryPickMenuProps {
  hash: string;
  branches: string[];
  currentBranch: string;
  onPick: (branch: string) => void;
  onCancel: () => void;
}

export function GitCherryPickMenu(props: GitCherryPickMenuProps) {
  return (
    <Row
      style={{
        alignItems: 'center',
        gap: 6,
        paddingLeft: 24,
        paddingRight: 8,
        paddingBottom: 6,
        flexWrap: 'wrap',
      }}
    >
      <Text fontSize={9} color={COLORS.textMuted}>
        Cherry-pick {props.hash} onto:
      </Text>
      {props.branches.filter((b) => !b.startsWith('remotes/')).map((b) => (
        <Pressable key={b} onPress={() => props.onPick(b)}>
          <Pill label={b} color={b === props.currentBranch ? COLORS.green : COLORS.blue} tiny={true} />
        </Pressable>
      ))}
      <Pressable onPress={props.onCancel}>
        <Pill label="cancel" color={COLORS.textDim} tiny={true} />
      </Pressable>
    </Row>
  );
}
