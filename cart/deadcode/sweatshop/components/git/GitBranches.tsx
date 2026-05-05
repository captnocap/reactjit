
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';

interface GitBranchesProps {
  branches: string[];
  currentBranch: string;
  aheadBehind: Record<string, { ahead: number; behind: number }>;
  onCheckout: (branch: string) => void;
  onDelete: (branch: string) => void;
  onCreate: (name: string) => void;
}

export function GitBranches(props: GitBranchesProps) {
  const [newBranch, setNewBranch] = useState('');

  return (
    <Col style={{ flexGrow: 1, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      <ScrollView showScrollbar={true} style={{ flexGrow: 1, padding: 8 }}>
        <Col style={{ gap: 4 }}>
          {props.branches.filter((b) => !b.startsWith('remotes/')).map((b) => {
            const ab = props.aheadBehind[b] || { ahead: 0, behind: 0 };
            const isCurrent = b === props.currentBranch;
            return (
              <Row
                key={b}
                style={{
                  alignItems: 'center',
                  gap: 6,
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: isCurrent ? COLORS.panelHover : 'transparent',
                }}
              >
                <Pressable onPress={() => props.onCheckout(b)} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
                  <Text fontSize={11} color={isCurrent ? COLORS.green : COLORS.text}>
                    {isCurrent ? '* ' + b : b}
                  </Text>
                </Pressable>
                {ab.ahead > 0 ? <Pill label={'↑' + ab.ahead} color={COLORS.blue} tiny={true} /> : null}
                {ab.behind > 0 ? <Pill label={'↓' + ab.behind} color={COLORS.orange} tiny={true} /> : null}
                {!isCurrent ? (
                  <Pressable onPress={() => props.onDelete(b)}>
                    <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, borderWidth: 1, borderColor: COLORS.red }}>
                      <Text fontSize={8} color={COLORS.red} style={{ fontWeight: 'bold' }}>✕</Text>
                    </Box>
                  </Pressable>
                ) : null}
              </Row>
            );
          })}

          <Box style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 4 }} />

          <Row style={{ gap: 8, alignItems: 'center', padding: 6 }}>
            <Box style={{ flexGrow: 1 }}>
              <TextInput
                value={newBranch}
                onChangeText={setNewBranch}
                placeholder="New branch..."
                fontSize={11}
                color={COLORS.text}
                style={{
                  height: 30,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 6,
                  paddingLeft: 8,
                  backgroundColor: COLORS.panelBg,
                }}
              />
            </Box>
            <Pressable
              onPress={() => {
                if (newBranch.trim()) {
                  props.onCreate(newBranch.trim());
                  setNewBranch('');
                }
              }}
            >
              <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 6, backgroundColor: COLORS.greenDeep, borderWidth: 1, borderColor: COLORS.green }}>
                <Text fontSize={9} color={COLORS.green} style={{ fontWeight: 'bold' }}>Create</Text>
              </Box>
            </Pressable>
          </Row>
        </Col>
      </ScrollView>
    </Col>
  );
}
