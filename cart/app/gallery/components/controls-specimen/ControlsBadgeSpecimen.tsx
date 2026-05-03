import { Col, Row } from '@reactjit/runtime/primitives';
import { SpecimenCard, SpecimenGrid, SpecimenSection } from './ControlsSpecimenShell';
import { BracketBadge } from './BracketBadge';
import { CautionBadge } from './CautionBadge';
import { CountBadge } from './CountBadge';
import { GlyphStackBadge } from './GlyphStackBadge';
import { KeyValueBadge } from './KeyValueBadge';
import { MetricBadge } from './MetricBadge';
import { PrefixDataCard } from './PrefixDataCard';
import { SideTabCard } from './SideTabCard';
import { SpecColumn } from './SpecColumn';
import { StatusBadge } from './StatusBadge';
import { StripBadge } from './StripBadge';
import { TierBadge } from './TierBadge';
import { TotemStack } from './TotemStack';
import { UnitRail } from './UnitRail';
import { VerticalBadge } from './VerticalBadge';
import { VerticalCautionBadge } from './VerticalCautionBadge';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

function BadgeRow(props: { children: any }) {
  return <S.InlineX5 style={{ flexWrap: 'wrap' }}>{props.children}</S.InlineX5>;
}

export function ControlsBadgeSpecimen() {
  return (
    <SpecimenSection code="B · G" title="Badge + Token Atoms" tag="status chips · mixed-axis markers">
      <SpecimenGrid>
        <SpecimenCard
          name="Status family"
          code="BG-01"
          caption="outline · solid · led · pill · dot"
          width={CTRL.cardWide}
          readoutLabel="variants"
          readoutValue="5"
        >
          <S.StackX6>
            <BadgeRow>
              <StatusBadge label="RUNNING" tone="accent" />
              <StatusBadge label="READY" tone="ok" variant="solid" />
              <StatusBadge label="ACTIVE" tone="accent" variant="led" />
              <StatusBadge label="verified" tone="ok" variant="pill" />
              <StatusBadge label="degraded" tone="warn" variant="dot" />
            </BadgeRow>
            <BadgeRow>
              <KeyValueBadge label="PID" value="0482" tone="accent" />
              <BracketBadge left="[" right="]" value="128k" />
              <TierBadge label="CRIT" tone="flag" />
              <CountBadge label="WORKERS" value="08" tone="accent" />
            </BadgeRow>
            <BadgeRow>
              <StripBadge segments={[{ label: 'W·02', tone: 'accent' }, { label: 'THINKING' }, { label: '4m12s' }]} />
              <CautionBadge label="CAUTION" />
              <MetricBadge label="lat" value="118" unit="ms" />
            </BadgeRow>
          </S.StackX6>
        </SpecimenCard>

        <SpecimenCard
          name="Vertical markers"
          code="BG-02"
          caption="spines · glyph stacks"
          width={CTRL.cardMedium}
          readoutLabel="axis"
          readoutValue="mixed"
        >
          <Row style={{ gap: 10, alignItems: 'stretch' }}>
            <VerticalBadge label="PRIMARY" tone="accent" />
            <VerticalBadge label="ACTIVE" tone="accent" solid={true} />
            <GlyphStackBadge glyphs={['W', '0', '2', 'sep', '●']} accent={true} />
            <VerticalCautionBadge label="CAUTION" />
          </Row>
        </SpecimenCard>

        <SpecimenCard
          name="Readout badges"
          code="BG-03"
          caption="side tab · rail · stack"
          width={CTRL.cardWide}
          readoutLabel="cards"
          readoutValue="3"
        >
          <S.StackX5>
            <SideTabCard spine="WORKER" title="focus" value="W·02" sub="4m 12s" />
            <UnitRail unit="TOKENS" value="128k" sub="ctx · 84%" />
            <TotemStack segments={[{ label: 'LIVE', tone: 'accent' }, { label: 'W · 02' }, { label: '4m12s' }]} />
          </S.StackX5>
        </SpecimenCard>

        <SpecimenCard
          name="Prefix + column"
          code="BG-04"
          caption="archival identifiers"
          width={CTRL.cardMedium}
          readoutLabel="stack"
          readoutValue="2 atoms"
        >
          <S.StackX5>
            <PrefixDataCard prefix="RUN" headline="#8241 · auth-flow" subline="STARTED · 14:02Z · 4m12s" />
            <SpecColumn head="ID" value="0482" tail="SWEATSHOP · CORE" />
          </S.StackX5>
        </SpecimenCard>
      </SpecimenGrid>
    </SpecimenSection>
  );
}
