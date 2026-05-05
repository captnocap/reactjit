import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { Icon } from '@reactjit/runtime/icons/Icon';
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
  'theme:ink', // parchment
  'theme:accent', // sand
  'theme:atch', // mauve
  'theme:ok', // mint
  'theme:accentHot', // coral
  'theme:accent', // tan
  'theme:tool', // sky
  'theme:lilac', // lavender
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
          backgroundColor: 'theme:bg1',
          borderWidth: 1,
          borderColor: 'theme:rule',
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
          backgroundColor: 'theme:bg1',
          borderWidth: 1,
          borderColor: 'theme:rule',
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
        backgroundColor: 'theme:bg',
        borderWidth: 1,
        borderColor: 'theme:rule',
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
          borderBottomColor: 'theme:rule',
        }}
      >
        <Text style={{ fontSize: 14, fontFamily: 'monospace', color: 'theme:ink' }}>
          ICON CATALOG
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: 'theme:inkDimmer' }}>
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
