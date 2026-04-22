const React: any = require('react');
import { Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';
import { Icon } from '../icons';
import { Tooltip } from '../tooltip';

export function MessageActions(props: {
  isUser: boolean;
  isAssistant: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Row style={{ gap: 10, alignItems: 'center', paddingLeft: 4 }}>
      <Tooltip label="Copy message" side="bottom">
        <HoverPressable onPress={props.onCopy} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
          <Row style={{ gap: 4, alignItems: 'center' }}>
            <Icon name="copy" size={12} color={COLORS.textDim} />
            <Text fontSize={9} color={COLORS.textDim}>Copy</Text>
          </Row>
        </HoverPressable>
      </Tooltip>
      {props.isAssistant && props.onRetry ? (
        <Tooltip label="Regenerate assistant reply" side="bottom">
          <HoverPressable onPress={props.onRetry} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Row style={{ gap: 4, alignItems: 'center' }}>
              <Icon name="refresh" size={12} color={COLORS.textDim} />
              <Text fontSize={9} color={COLORS.textDim}>Retry</Text>
            </Row>
          </HoverPressable>
        </Tooltip>
      ) : null}
      {props.isUser && props.onEdit ? (
        <Tooltip label="Edit message" side="bottom">
          <HoverPressable onPress={props.onEdit} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Row style={{ gap: 4, alignItems: 'center' }}>
              <Icon name="pencil" size={12} color={COLORS.textDim} />
              <Text fontSize={9} color={COLORS.textDim}>Edit</Text>
            </Row>
          </HoverPressable>
        </Tooltip>
      ) : null}
      {props.onDelete ? (
        <Tooltip label="Delete message" side="bottom">
          <HoverPressable onPress={props.onDelete} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Row style={{ gap: 4, alignItems: 'center' }}>
              <Icon name="trash" size={12} color={COLORS.textDim} />
              <Text fontSize={9} color={COLORS.textDim}>Delete</Text>
            </Row>
          </HoverPressable>
        </Tooltip>
      ) : null}
    </Row>
  );
}
