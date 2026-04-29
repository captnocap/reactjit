import { Col, Row } from '@reactjit/runtime/primitives';
import { SpecimenCard, SpecimenGrid, SpecimenSection } from './ControlsSpecimenShell';
import { BipolarSlider } from './BipolarSlider';
import { DiscreteSlider } from './DiscreteSlider';
import { FilledRailSlider } from './FilledRailSlider';
import { HairlineSlider } from './HairlineSlider';
import { MeterSlider } from './MeterSlider';
import { RangeSlider } from './RangeSlider';
import { StepSlider } from './StepSlider';
import { VerticalBipolarFader } from './VerticalBipolarFader';
import { VerticalNotchFader } from './VerticalNotchFader';
import { VerticalStripFader } from './VerticalStripFader';
import { VerticalThinFader } from './VerticalThinFader';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export function ControlsSliderSpecimen() {
  return (
    <SpecimenSection code="S · G" title="Slider + Fader Atoms" tag="interactive rails · steps · meters">
      <SpecimenGrid>
        <SpecimenCard
          name="Horizontal rails"
          code="SL-01"
          caption="hairline · filled · bipolar"
          width={CTRL.cardWide}
          readoutLabel="set"
          readoutValue="3 live"
        >
          <S.StackX5>
            <HairlineSlider value={62} width={384} label="GAIN" />
            <FilledRailSlider value={45} width={384} label="DRIVE" />
            <BipolarSlider value={65} width={384} label="OFFSET" />
          </S.StackX5>
        </SpecimenCard>

        <SpecimenCard
          name="Windows + metrics"
          code="SL-02"
          caption="range · meter"
          width={CTRL.cardMedium}
          readoutLabel="window"
          readoutValue="28 · 74"
        >
          <S.StackX6>
            <RangeSlider low={28} high={74} width={240} />
            <MeterSlider value={68} label="068 · IOPS" width={240} />
          </S.StackX6>
        </SpecimenCard>

        <SpecimenCard
          name="Discrete controls"
          code="SL-03"
          caption="slot · ruler · named stops"
          width={CTRL.cardWide}
          readoutLabel="state"
          readoutValue="MID"
        >
          <S.StackX6>
            <DiscreteSlider steps={10} active={4} />
            <DiscreteSlider steps={8} active={5} slot={true} />
            <StepSlider labels={['OFF', 'LO', 'MID', 'HI', 'MAX']} active={2} />
          </S.StackX6>
        </SpecimenCard>

        <SpecimenCard
          name="Vertical bank"
          code="SL-04"
          caption="thin · strip · notch · bipolar"
          width={CTRL.cardWide}
          readoutLabel="channels"
          readoutValue="4 active"
        >
          <Row style={{ gap: 12, alignItems: 'flex-end' }}>
            <VerticalThinFader value={72} label="A" />
            <VerticalStripFader value={55} label="0dB" />
            <VerticalNotchFader active={9} label="L" />
            <VerticalNotchFader active={8} label="R" />
            <VerticalNotchFader active={10} label="M" />
            <VerticalBipolarFader value={28} label="−22" />
          </Row>
        </SpecimenCard>
      </SpecimenGrid>
    </SpecimenSection>
  );
}
