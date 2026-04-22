const React: any = require('react');
import { Box, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { getModelIconInfo } from '../../model-icons';

function ModelIconBadge(props: { modelId: string; size?: number }) {
  const info = getModelIconInfo(props.modelId);
  const size = props.size || 14;
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: info.color,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>
        {info.initial}
      </Text>
    </Box>
  );
}

export function RoleAvatar(props: { role: string; modelId?: string; size?: number }) {
  const size = props.size || 20;
  if (props.role === 'user') {
    return (
      <Box style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.blueDeep,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.blue,
      }}>
        <Text fontSize={size * 0.45} color={COLORS.blue} style={{ fontWeight: 'bold' }}>U</Text>
      </Box>
    );
  }
  if (props.role === 'system') {
    return (
      <Box style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.grayDeep,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
      }}>
        <Text fontSize={size * 0.45} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>S</Text>
      </Box>
    );
  }
  return <ModelIconBadge modelId={props.modelId || 'unknown'} size={size} />;
}
