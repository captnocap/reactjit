import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { Icon } from '../../../sweatshop/components/icons';
import {
  getRegisteredIconNames,
  getAliasesForName,
} from '@reactjit/runtime/icons/registry';
import { PROVIDER_ICONS } from '../model-card/providerIcons.generated';
import { ProviderIcon } from '../model-card/ProviderIcon';

const CANONICAL_NAMES = getRegisteredIconNames().sort((a, b) =>
  a.toLowerCase().localeCompare(b.toLowerCase())
);
const PROVIDER_IDS = Object.keys(PROVIDER_ICONS);

// Warm palette for demonstrating vector icons render in arbitrary colors.
const COLOR_PALETTE = [
  '#f2e8dc', // parchment
  '#d26a2a', // sand
  '#d48aa7', // mauve
  '#6aa390', // mint
  '#e8501c', // coral
  '#d26a2a', // tan
  '#6ac3d6', // sky
  '#8a7fd4', // lavender
];

function iconColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

function buildTooltip(name: string, aliases: string[]): string {
  if (aliases.length === 0) return name;
  return `${name}  ·  ${aliases.join(', ')}`;
}

function copyName(name: string) {
  const fn = (globalThis as any).__clipboard_set;
  if (typeof fn === 'function') {
    fn(name);
  }
}

function VectorIconItem({ name }: { name: string }) {
  const aliases = getAliasesForName(name);
  const tooltip = buildTooltip(name, aliases);
  return (
    <Pressable
      onPress={() => copyName(name)}
      tooltip={tooltip}
    >
      <Box
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          backgroundColor: '#14100d',
          borderWidth: 1,
          borderColor: '#3a2a1e',
        }}
      >
        <Icon name={name} size={20} color={iconColor(name)} />
      </Box>
    </Pressable>
  );
}

function ProviderIconItem({ providerId }: { providerId: string }) {
  return (
    <Pressable
      onPress={() => copyName(providerId)}
      tooltip={providerId}
    >
      <Box
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          backgroundColor: '#14100d',
          borderWidth: 1,
          borderColor: '#3a2a1e',
        }}
      >
        <ProviderIcon providerId={providerId} size={24} />
      </Box>
    </Pressable>
  );
}

export function IconCatalog() {
  return (
    <Col
      style={{
        width: '100%',
        gap: 20,
        padding: 20,
        backgroundColor: '#0e0b09',
        borderWidth: 1,
        borderColor: '#3a2a1e',
        borderRadius: 14,
      }}
    >
      <Row
        style={{
          width: '100%',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: '#3a2a1e',
        }}
      >
        <Text style={{ fontSize: 14, fontFamily: 'monospace', color: '#f2e8dc' }}>
          ICON CATALOG
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: '#7a6e5d' }}>
          {CANONICAL_NAMES.length} vector icons · {PROVIDER_IDS.length} provider icons
        </Text>
      </Row>

      <Row style={{ width: '100%', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
        {CANONICAL_NAMES.map((name) => (
          <VectorIconItem key={name} name={name} />
        ))}
        {PROVIDER_IDS.map((providerId) => (
          <ProviderIconItem key={providerId} providerId={providerId} />
        ))}
      </Row>
    </Col>
  );
}
