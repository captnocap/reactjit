import { Col, Row } from '@reactjit/runtime/primitives';
import { AxisReadout } from './AxisReadout';
import { ChronologyTrail } from './ChronologyTrail';
import { FileTabCard } from './FileTabCard';
import { LadderTrail } from './LadderTrail';
import { MarginaliaPanel } from './MarginaliaPanel';
import { ScaleLabelCard } from './ScaleLabelCard';
import { SideSpineCrumbs } from './SideSpineCrumbs';
import { SpecimenCard, SpecimenGrid, SpecimenSection } from './ControlsSpecimenShell';
import { TabularHierarchy } from './TabularHierarchy';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export function ControlsMixedAxisSpecimen() {
  return (
    <SpecimenSection code="M · X" title="Mixed Axis Marginalia" tag="vertical spines · horizontal bodies">
      <SpecimenGrid>
        <SpecimenCard
          name="Marginalia block"
          code="MX-01"
          caption="section spine · horizontal body"
          width={CTRL.cardWide}
          tall={true}
        >
          <S.StackX6>
            <MarginaliaPanel />
            <MarginaliaPanel
              spine="§ 05 · AUDIT"
              tone="flag"
              title="Commit velocity window"
              body="Trailing 24h commits compared to team baseline; a running total is surfaced when a worker exceeds 2σ."
              stats={[
                { label: 'Δ', value: '+126' },
                { label: 'σ', value: '2.4' },
                { label: 'BASE', value: '62/d' },
              ]}
            />
          </S.StackX6>
        </SpecimenCard>

        <SpecimenCard
          name="Rotated axis"
          code="MX-02"
          caption="vertical axis title · horizontal bars"
          width={CTRL.cardWide}
          tall={true}
        >
          <AxisReadout />
        </SpecimenCard>

        <SpecimenCard
          name="File-tab leaf"
          code="MX-03"
          caption="vertical tag · horizontal card"
          width={CTRL.cardWide}
        >
          <S.StackX6>
            <FileTabCard />
            <FileTabCard
              leaf="RAT · 02"
              tone="flag"
              title="Rat lock incident review"
              meta={[
                { label: 'OWNER', value: 'safety' },
                { label: 'v', value: '0.4' },
                { label: 'TOUCHED', value: '14:07Z' },
              ]}
            />
          </S.StackX6>
        </SpecimenCard>

        <SpecimenCard
          name="Scale-labelled card"
          code="MX-04"
          caption="vertical units · horizontal readout"
          width={CTRL.cardWide}
        >
          <ScaleLabelCard />
        </SpecimenCard>

        <SpecimenCard
          name="Trail set"
          code="MX-05"
          caption="ladders · logs · chronology"
          width={CTRL.cardWide}
        >
          <Row style={{ gap: 12, alignItems: 'flex-start' }}>
            <LadderTrail />
            <SideSpineCrumbs />
          </Row>
        </SpecimenCard>

        <SpecimenCard
          name="Hierarchy set"
          code="MX-06"
          caption="rows · timestamps"
          width={CTRL.cardWide}
        >
          <S.StackX6>
            <TabularHierarchy />
            <ChronologyTrail />
          </S.StackX6>
        </SpecimenCard>
      </SpecimenGrid>
    </SpecimenSection>
  );
}
