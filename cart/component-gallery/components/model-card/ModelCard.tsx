import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { ProviderIcon } from './ProviderIcon';

export type ModelCapability = 'vision' | 'reasoning' | 'tools' | 'search' | 'code' | 'files';

export type ModelCardProps = {
  providerId: string;
  name: string;
  contextWindow?: number;
  capabilities?: ModelCapability[];
  accentColor?: string;
};

const CAPABILITY_LABEL: Record<ModelCapability, string> = {
  vision: 'Vision',
  reasoning: 'Reasoning',
  tools: 'Tools',
  search: 'Search',
  code: 'Code',
  files: 'Files',
};

const CAPABILITY_COLOR: Record<ModelCapability, string> = {
  vision: '#22d3ee',
  reasoning: '#a855f7',
  tools: '#f59e0b',
  search: '#22c55e',
  code: '#3b82f6',
  files: '#ec4899',
};

function formatContext(tokens?: number): string {
  if (!tokens) return '';
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return m === Math.floor(m) ? `${m}M context` : `${m.toFixed(1)}M context`;
  }
  return `${Math.round(tokens / 1000)}k context`;
}

export function ModelCard({
  providerId,
  name,
  contextWindow,
  capabilities = [],
  accentColor = '#273142',
}: ModelCardProps) {
  return (
    <Col
      style={{
        width: 220,
        padding: 14,
        gap: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: accentColor,
        backgroundColor: '#0f141c',
        alignItems: 'flex-start',
      }}
    >
      <Row style={{ gap: 10, alignItems: 'center' }}>
        <Box
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#182233',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <ProviderIcon providerId={providerId} size={26} />
        </Box>
        <Col style={{ gap: 2, flexGrow: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#e6edf3' }}>{name}</Text>
          <Text style={{ fontSize: 10, color: '#8b949e' }}>
            {formatContext(contextWindow) || providerId}
          </Text>
        </Col>
      </Row>
      {capabilities.length > 0 && (
        <Row style={{ flexWrap: 'wrap', gap: 4 }}>
          {capabilities.map((cap) => (
            <Box
              key={cap}
              style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 4,
                backgroundColor: `${CAPABILITY_COLOR[cap]}20`,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: CAPABILITY_COLOR[cap] }}>
                {CAPABILITY_LABEL[cap]}
              </Text>
            </Box>
          ))}
        </Row>
      )}
    </Col>
  );
}
