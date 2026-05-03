import { Col, Row } from '@reactjit/runtime/primitives';
import { ProviderIcon } from './ProviderIcon';
import { GenericCardDataRow } from '../generic-card/GenericCardDataRow';
import { GenericCardHeader } from '../generic-card/GenericCardHeader';
import { GenericCardShell } from '../generic-card/GenericCardShell';
import { GenericCardTitleBlock } from '../generic-card/GenericCardTitleBlock';
import { GENERIC_CARD, type GenericCardRow } from '../generic-card/genericCardShared';

export type ModelCapability = 'vision' | 'reasoning' | 'tools' | 'search' | 'code' | 'files';

export type ModelCardProps = {
  providerId: string;
  name: string;
  contextWindow?: number;
  capabilities?: ModelCapability[];
  /** Ignored — retained for prop compatibility with the prior island version. */
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

const CAPABILITY_TONE: Record<ModelCapability, GenericCardRow['tone']> = {
  vision: 'cool',
  reasoning: 'cool',
  tools: 'warm',
  search: 'cool',
  code: 'soft',
  files: 'warm',
};

function formatContext(tokens?: number): string {
  if (!tokens) return '—';
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return m === Math.floor(m) ? `${m}M ctx` : `${m.toFixed(1)}M ctx`;
  }
  return `${Math.round(tokens / 1000)}k ctx`;
}

export function ModelCard({
  providerId,
  name,
  contextWindow,
  capabilities = [],
}: ModelCardProps) {
  const rows: GenericCardRow[] = capabilities.map((cap) => ({
    label: CAPABILITY_LABEL[cap],
    value: 'on',
    tone: CAPABILITY_TONE[cap],
  }));

  return (
    <GenericCardShell>
      <GenericCardHeader eyebrow={providerId.toUpperCase()} score={formatContext(contextWindow)} />
      <Row style={{ alignItems: 'center', gap: 12 }}>
        <ProviderIcon providerId={providerId} size={36} />
        <GenericCardTitleBlock title={name} subtitle={providerId} />
      </Row>
      {rows.length > 0 && (
        <Col
          style={{
            padding: 10,
            gap: 7,
            backgroundColor: GENERIC_CARD.surface,
            borderWidth: 1,
            borderColor: GENERIC_CARD.dataPanelBorder,
            borderRadius: 4,
          }}
        >
          {rows.map((row, index) => (
            <GenericCardDataRow key={row.label} row={row} index={index} />
          ))}
        </Col>
      )}
    </GenericCardShell>
  );
}
