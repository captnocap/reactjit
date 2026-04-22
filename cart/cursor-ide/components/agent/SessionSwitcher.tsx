const React: any = require('react');
import { Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';
import { Icon } from '../icons';
import { Tooltip } from '../tooltip';

export function SessionSwitcher(props: {
  conversations: any[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onSave: () => void;
  visible: boolean;
}) {
  if (!props.visible) return null;
  return (
    <Col style={{ width: 180, borderRightWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, padding: 8, gap: 6 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Conversations</Text>
        <Tooltip label="New conversation" side="right">
          <HoverPressable onPress={props.onNew} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 6, backgroundColor: COLORS.blueDeep }}>
            <Icon name="plus" size={12} color={COLORS.blue} />
          </HoverPressable>
        </Tooltip>
      </Row>
      <Tooltip label="Save the current conversation" side="right">
        <HoverPressable onPress={props.onSave} style={{ padding: 6, borderRadius: 6, backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={9} color={COLORS.blue}>Save current</Text>
        </HoverPressable>
      </Tooltip>
      <Col style={{ gap: 4, flexGrow: 1 }}>
        {props.conversations.length === 0 ? (
          <Text fontSize={9} color={COLORS.textDim}>No saved chats</Text>
        ) : (
          props.conversations.map((conv: any) => (
            <Tooltip key={conv.id} label={'Open ' + conv.title} side="right">
              <HoverPressable
                onPress={() => props.onSelect(conv.id)}
                style={{ padding: 6, borderRadius: 6, backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.border }}
              >
                <Col style={{ gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{conv.title}</Text>
                    <Tooltip label="Delete conversation" side="left">
                      <HoverPressable onPress={() => props.onDelete(conv.id)} style={{ paddingLeft: 2, paddingRight: 2, paddingTop: 1, paddingBottom: 1, borderRadius: 4, backgroundColor: 'transparent' }}>
                        <Text fontSize={8} color={COLORS.textDim}>×</Text>
                      </HoverPressable>
                    </Tooltip>
                  </Row>
                  <Text fontSize={8} color={COLORS.textDim}>{conv.preview || conv.messageCount + ' msgs'}</Text>
                </Col>
              </HoverPressable>
            </Tooltip>
          ))
        )}
      </Col>
    </Col>
  );
}
