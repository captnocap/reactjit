import { Box, Image, Text } from '../../../../runtime/primitives';
import { PROVIDER_ICONS } from './providerIcons.generated';

export type ProviderIconProps = {
  providerId: string;
  size?: number;
};

export function ProviderIcon({ providerId, size = 24 }: ProviderIconProps) {
  const src = PROVIDER_ICONS[providerId];
  if (!src) {
    const letter = (providerId[0] ?? '?').toUpperCase();
    return (
      <Box
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#182233',
          borderRadius: Math.round(size * 0.25),
        }}
      >
        <Text style={{ fontSize: Math.round(size * 0.55), fontWeight: 'bold', color: '#d7dde8' }}>
          {letter}
        </Text>
      </Box>
    );
  }
  return <Image source={src} style={{ width: size, height: size }} />;
}
