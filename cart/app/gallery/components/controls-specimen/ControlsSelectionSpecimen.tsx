import { Col, Row } from '@reactjit/runtime/primitives';
import { SpecimenCard, SpecimenGrid, SpecimenSection } from './ControlsSpecimenShell';
import { ChoiceList } from './ChoiceList';
import { DiodeSelector } from './DiodeSelector';
import { KeycapSelector } from './KeycapSelector';
import { PipeSelector } from './PipeSelector';
import { SegmentedControl } from './SegmentedControl';
import { StackSelector } from './StackSelector';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export function ControlsSelectionSpecimen() {
  return (
    <SpecimenSection code="S · E" title="Selection Atoms" tag="radio groups · compact selectors">
      <SpecimenGrid>
        <SpecimenCard
          name="Choice rows"
          code="SE-01"
          caption="square · round · bracket"
          width={CTRL.cardWide}
          readoutLabel="marker"
          readoutValue="3 modes"
        >
          <Row style={{ gap: 12 }}>
            <ChoiceList />
            <ChoiceList
              marker="round"
              items={[
                { label: 'thinking' },
                { label: 'tool-use', active: true },
                { label: 'editing' },
                { label: 'idle' },
              ]}
            />
            <ChoiceList
              marker="bracket"
              items={[
                { label: 'brainstorm' },
                { label: 'enforce', active: true },
                { label: 'freeform' },
                { label: 'paused' },
              ]}
            />
          </Row>
        </SpecimenCard>

        <SpecimenCard
          name="Segmented + keycaps"
          code="SE-02"
          caption="switch groups"
          width={CTRL.cardMedium}
          readoutLabel="active"
          readoutValue="2x"
        >
          <S.StackX6>
            <SegmentedControl options={['DAY', 'WEEK', 'MONTH', 'YEAR']} active={1} />
            <KeycapSelector options={['1×', '2×', '4×', '8×', '16×']} active={1} />
          </S.StackX6>
        </SpecimenCard>

        <SpecimenCard
          name="Selector stacks"
          code="SE-03"
          caption="diodes · models · pipe spine"
          width={CTRL.cardWide}
          readoutLabel="focus"
          readoutValue="sonnet"
        >
          <S.StackX6>
            <DiodeSelector
              active={1}
              options={[
                { number: '01', label: 'TIER' },
                { number: '02', label: 'TIER' },
                { number: '03', label: 'TIER' },
                { number: '04', label: 'TIER' },
              ]}
            />
            <StackSelector
              active={1}
              options={[
                { label: 'haiku · 1.4k', cost: '$0.01' },
                { label: 'sonnet · 18k', cost: '$0.06' },
                { label: 'opus · 42k', cost: '$0.22' },
              ]}
            />
          </S.StackX6>
        </SpecimenCard>

        <SpecimenCard
          name="Pipe selector"
          code="SE-04"
          caption="vertical spine selection"
          width={CTRL.cardMedium}
          readoutLabel="stream"
          readoutValue="tool"
        >
          <PipeSelector
            active={1}
            options={[
              'context · kernel',
              'tool invocations',
              'worker streams',
              'file edits',
              'git audit',
            ]}
          />
        </SpecimenCard>
      </SpecimenGrid>
    </SpecimenSection>
  );
}
