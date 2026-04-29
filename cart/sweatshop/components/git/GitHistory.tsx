
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { GitCommitRow } from './GitCommitRow';
import { GitGraphLane } from './GitGraphLane';
import { GitCherryPickMenu } from './GitCherryPickMenu';
import { GitRevertConfirm } from './GitRevertConfirm';
import type { GitCommitInfo, GitGraphLine } from './useGitOps';

interface GitHistoryProps {
  logs: GitCommitInfo[];
  graph: GitGraphLine[];
  branches: string[];
  currentBranch: string;
  onCherryPick: (hash: string, branch: string) => void;
  onRevert: (hash: string) => void;
}

export function GitHistory(props: GitHistoryProps) {
  const [showGraph, setShowGraph] = useState(true);
  const [dateFormat, setDateFormat] = useState<'relative' | 'short'>('relative');
  const [authorFilter, setAuthorFilter] = useState('');
  const [pickHash, setPickHash] = useState<string | null>(null);
  const [revertHash, setRevertHash] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = props.graph;
    if (authorFilter.trim()) {
      const needle = authorFilter.trim().toLowerCase();
      rows = rows.filter((g) => !g.hash || (g.author || '').toLowerCase().includes(needle));
    }
    return rows;
  }, [props.graph, authorFilter]);

  return (
    <Col style={{ flexGrow: 1, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      {/* Controls */}
      <Row
        style={{
          alignItems: 'center',
          gap: 8,
          padding: 10,
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <Pressable
          onPress={() => setShowGraph((v: boolean) => !v)}
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: showGraph ? COLORS.blue : COLORS.border,
            backgroundColor: showGraph ? COLORS.blueDeep : COLORS.panelRaised,
          }}
        >
          <Text fontSize={9} color={showGraph ? COLORS.blue : COLORS.textDim}>Graph</Text>
        </Pressable>
        <Pressable
          onPress={() => setDateFormat((v: string) => v === 'relative' ? 'short' : 'relative')}
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
          }}
        >
          <Text fontSize={9} color={COLORS.textDim}>{dateFormat === 'relative' ? 'Relative' : 'Short'}</Text>
        </Pressable>
        <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <TextInput
            value={authorFilter}
            onChangeText={setAuthorFilter}
            placeholder="Filter author..."
            fontSize={10}
            color={COLORS.text}
            style={{
              height: 26,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 6,
              paddingLeft: 8,
              backgroundColor: COLORS.panelBg,
            }}
          />
        </Box>
      </Row>

      <ScrollView showScrollbar={true} style={{ flexGrow: 1, padding: 8 }}>
        <Col style={{ gap: 2 }}>
          {filtered.map((g, i) => {
            if (!g.hash) {
              return showGraph ? (
                <Row key={'gfx-' + i} style={{ alignItems: 'center', paddingLeft: 8 }}>
                  <GitGraphLane graph={g.graph || ' '} />
                </Row>
              ) : null;
            }
            const isHead = g.hash === (props.logs[0]?.hash || '');
            const isPickOpen = pickHash === g.hash;
            const isRevertOpen = revertHash === g.hash;
            return (
              <Col key={g.hash} style={{ gap: 2 }}>
                <Row style={{ alignItems: 'center', gap: 6 }}>
                  {showGraph ? <GitGraphLane graph={g.graph || '*'} /> : null}
                  <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
                    <GitCommitRow
                      hash={g.hash}
                      shortHash={g.shortHash}
                      message={g.message}
                      author={g.author}
                      date={g.date}
                      isHead={isHead}
                      onPick={() => setPickHash(isPickOpen ? null : g.hash)}
                      onRevert={() => setRevertHash(isRevertOpen ? null : g.hash)}
                    />
                  </Box>
                </Row>
                {isPickOpen ? (
                  <GitCherryPickMenu
                    hash={g.shortHash}
                    branches={props.branches}
                    currentBranch={props.currentBranch}
                    onPick={(b) => { props.onCherryPick(g.hash, b); setPickHash(null); }}
                    onCancel={() => setPickHash(null)}
                  />
                ) : null}
                {isRevertOpen ? (
                  <GitRevertConfirm
                    hash={g.shortHash}
                    onConfirm={() => { props.onRevert(g.hash); setRevertHash(null); }}
                    onCancel={() => setRevertHash(null)}
                  />
                ) : null}
              </Col>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}
