import { Box, Image, Text } from '@reactjit/runtime/primitives';
import { CircleHelp } from '@reactjit/runtime/icons/icons';
import { Icon } from '../../../sweatshop/components/icons';
import { PROVIDER_ICONS } from './providerIcons.generated';

export type ProviderIconProps = {
  providerId: string;
  size?: number;
};

// Lobe ships several mono-on-transparent logos (OpenAI, Anthropic, Grok, Groq,
// xAI, Ollama). On the card's dark surface those are invisible, so the icon
// always renders inside a light badge. Color matches the cockpit theme's warm
// paper (PAGE_SURFACE.backgroundColor / theme `previewBg`) so the badge reads
// as part of the gallery palette, not an arbitrary white square.
const BADGE_BG = '#e8dcc4';

export function ProviderIcon({ providerId, size = 24 }: ProviderIconProps) {
  const src = PROVIDER_ICONS[providerId];
  const radius = Math.round(size * 0.22);
  const inner = Math.round(size * 0.78);

  if (!src) {
    const letter = providerId[0]?.toUpperCase();
    return (
      <Box
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BADGE_BG,
          borderRadius: radius,
        }}
      >
        {letter ? (
          <Text style={{ fontSize: Math.round(size * 0.55), fontWeight: 'bold', color: '#14100d' }}>
            {letter}
          </Text>
        ) : (
          <Icon icon={CircleHelp} size={Math.round(size * 0.62)} color="#14100d" strokeWidth={2.2} />
        )}
      </Box>
    );
  }

  return (
    <Box
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BADGE_BG,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      <Image source={src} style={{ width: inner, height: inner }} />
    </Box>
  );
}
