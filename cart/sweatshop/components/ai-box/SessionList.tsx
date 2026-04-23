import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import type { AiBoxSession } from './SessionStorage';

function readKey(payload: any): string {
  if (typeof payload?.key === 'string') return payload.key.toLowerCase();
  const code = Number(payload?.keyCode ?? payload?.which ?? 0);
  if (code === 13) return 'enter';
  if (code === 27) return 'escape';
  return '';
}

export function SessionList(props: {
  sessions: AiBoxSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <Col style={{ width: 260, minWidth: 220, maxWidth: 280, minHeight: 0, gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>SESSIONS</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={props.onNew}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono }}>new</Text>
          </Box>
        </Pressable>
      </Row>
      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ gap: 8 }}>
          {props.sessions.map((session) => {
            const active = session.id === props.activeId;
            const editing = editingId === session.id;
            return (
              <Box key={session.id} style={{ gap: 8, padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: active ? COLORS.blue : COLORS.border, backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt }}>
                {editing ? (
                  <TextInput
                    value={draft}
                    onChangeText={(text: string) => setDraft(text)}
                    onKeyDown={(payload: any) => {
                      const key = readKey(payload);
                      if (key === 'enter') {
                        props.onRename(session.id, draft);
                        setEditingId(null);
                      } else if (key === 'escape') {
                        setEditingId(null);
                      }
                    }}
                    style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontFamily: TOKENS.fontMono, fontSize: 10 }}
                  />
                ) : (
                  <Pressable onPress={() => props.onSelect(session.id)}>
                    <Col style={{ gap: 3 }}>
                      <Text fontSize={10} color={active ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>{session.title}</Text>
                      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>
                        {session.provider} / {session.model || '(model)'} · {session.messages.length} msgs
                      </Text>
                    </Col>
                  </Pressable>
                )}
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Pressable onPress={() => { setDraft(session.title); setEditingId(session.id); }}>
                    <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>rename</Text>
                    </Box>
                  </Pressable>
                  <Pressable onPress={() => copyToClipboard(props.onExport(session.id))}>
                    <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>export</Text>
                    </Box>
                  </Pressable>
                  <Pressable onPress={() => props.onDelete(session.id)}>
                    <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={9} color={COLORS.red} style={{ fontFamily: TOKENS.fontMono }}>delete</Text>
                    </Box>
                  </Pressable>
                </Row>
              </Box>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}
