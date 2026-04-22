const React: any = require('react');

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

interface GitRevertConfirmProps {
  hash: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GitRevertConfirm(props: GitRevertConfirmProps) {
  return (
    <Row
      style={{
        alignItems: 'center',
        gap: 8,
        paddingLeft: 24,
        paddingRight: 8,
        paddingBottom: 6,
      }}
    >
      <Text fontSize={9} color={COLORS.orange}>
        Revert {props.hash}?
      </Text>
      <Pressable
        onPress={props.onConfirm}
        style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: 6,
          backgroundColor: COLORS.orangeDeep,
          borderWidth: 1,
          borderColor: COLORS.orange,
        }}
      >
        <Text fontSize={9} color={COLORS.orange} style={{ fontWeight: 'bold' }}>Revert</Text>
      </Pressable>
      <Pressable
        onPress={props.onCancel}
        style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: 6,
          backgroundColor: COLORS.panelAlt,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text fontSize={9} color={COLORS.textDim}>Cancel</Text>
      </Pressable>
    </Row>
  );
}
