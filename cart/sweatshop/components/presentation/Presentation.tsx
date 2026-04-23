import React, { useEffect, useState } from 'react';
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { ParsedDeck } from '../../lib/presentation/parseSlides';
import { Slide } from './Slide';
import { Timer } from './Timer';
import { SlideOverview } from './SlideOverview';
import { SpeakerNotes } from './SpeakerNotes';
import { PresenterControls } from './PresenterControls';
import type { PresentationState } from '../../hooks/usePresentationState';

export function Presentation(props: {
  deck: ParsedDeck;
  state: PresentationState;
  onSelectSlide: (index: number) => void;
  onFirstSlide: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onLastSlide: () => void;
  onToggleNotes: () => void;
  onResetTimer: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const slideCount = props.deck.slides.length;
  const activeIndex = Math.max(0, Math.min(props.state.slideIndex, Math.max(0, slideCount - 1)));
  const activeSlide = props.deck.slides[activeIndex];
  const elapsedMs = props.state.startedAtMs > 0 ? Math.max(0, nowMs - props.state.startedAtMs) : 0;

  if (!activeSlide) {
    return <Box style={{ width: '100%', height: '100%', padding: 16, backgroundColor: COLORS.panelBg }}><Text fontSize={12} color={COLORS.textDim}>No slides parsed from {props.deck.sourcePath}.</Text></Box>;
  }

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, gap: 12, padding: 12, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 220 }}>
          <Text fontSize={11} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>PRESENTATION</Text>
          <Text fontSize={18} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.deck.title}</Text>
          <Text fontSize={10} color={COLORS.textDim}>{props.deck.sourcePath} · {slideCount} slide{slideCount === 1 ? '' : 's'} · {props.deck.kind}</Text>
        </Col>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Timer elapsedMs={elapsedMs} durationMinutes={props.state.durationMinutes} warningMinutes={props.state.warningMinutes} />
          <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textDim}>slide {String(activeIndex + 1).padStart(2, '0')} / {String(slideCount).padStart(2, '0')}</Text>
          </Box>
          <Pressable onPress={props.onResetTimer} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Reset timer</Text>
          </Pressable>
        </Row>
      </Row>

      <Row style={{ gap: 12, flexGrow: 1, flexBasis: 0, minHeight: 0, flexWrap: 'wrap' }}>
        <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 420, minHeight: 0 }}>
          <Slide
            title={activeSlide.title}
            indexLabel={`Slide ${String(activeIndex + 1).padStart(2, '0')}`}
            body={activeSlide.body}
            notes={props.state.notesOpen ? activeSlide.notes : ''}
            active={true}
          >
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                <Text fontSize={9} color={COLORS.textDim}>keyboard driven</Text>
              </Box>
              <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                <Text fontSize={9} color={COLORS.textDim}>{props.deck.kind}</Text>
              </Box>
            </Row>
          </Slide>
        </Box>

        <Col style={{ width: 300, minWidth: 260, gap: 12, minHeight: 0 }}>
          <SlideOverview slides={props.deck.slides} activeIndex={activeIndex} onSelectSlide={props.onSelectSlide} />
          <Box style={{ padding: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.panelRaised, gap: 6 }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>SESSION</Text>
            <Text fontSize={10} color={COLORS.textDim}>started {props.state.startedAtMs > 0 ? new Date(props.state.startedAtMs).toLocaleTimeString() : 'not started'}</Text>
            <Text fontSize={10} color={COLORS.textDim}>notes {props.state.notesOpen ? 'open' : 'hidden'} · warn at {props.state.warningMinutes}m</Text>
            <Text fontSize={10} color={COLORS.textDim}>timer resets when the deck is loaded.</Text>
          </Box>
        </Col>
      </Row>

      <SpeakerNotes visible={props.state.notesOpen} title={activeSlide.title} notes={activeSlide.notes} slideIndex={activeIndex} slideCount={slideCount} />
      <PresenterControls onFirst={props.onFirstSlide} onPrev={props.onPrevSlide} onNext={props.onNextSlide} onLast={props.onLastSlide} onToggleNotes={props.onToggleNotes} />
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textDim}>Press space or right arrow for the next slide. Left arrow goes back.</Text>
        <Text fontSize={10} color={COLORS.textDim}>Rendering from live workspace data.</Text>
      </Row>
    </Col>
  );
}
