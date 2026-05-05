import React, { useCallback, useEffect, useState } from 'react';
import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS, baseName, inferFileType } from '../../theme';
import { readFile } from '../../host';
import { parseSlides, type ParsedDeck } from '../../lib/presentation/parseSlides';
import { usePresentationState } from '../../hooks/usePresentationState';
import { Presentation } from './Presentation';

function isDeckPath(path: string): boolean {
  const type = inferFileType(path);
  return type === 'md' || type === 'markdown' || type === 'mdx' || type === 'ts' || type === 'tsx';
}

export function PresentationPanel(props: {
  currentFilePath: string;
  onOpenPath?: (path: string) => void;
  onClose?: () => void;
}) {
  const session = usePresentationState();
  const [draftPath, setDraftPath] = useState(session.state.deckPath);
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [banner, setBanner] = useState('Load a .md or .tsx slide deck from the workspace.');
  const [bannerTone, setBannerTone] = useState<'info' | 'warn' | 'error'>('info');

  const loadDeck = useCallback((path: string) => {
    const trimmed = String(path || '').trim();
    if (!trimmed) {
      setBanner('Enter a presentation path before loading.');
      setBannerTone('warn');
      return;
    }
    const source = readFile(trimmed);
    if (!source) {
      setBanner(`No readable presentation found at ${trimmed}.`);
      setBannerTone('error');
      return;
    }
    const parsed = parseSlides(source, trimmed);
    if (parsed.error) {
      setBanner(parsed.error);
      setBannerTone('error');
      setDraftPath(trimmed);
      return;
    }
    setDeck(parsed);
    setDraftPath(trimmed);
    session.setDeckPath(trimmed);
    session.resetTimer();
    session.setSlideIndex(0);
    setBanner(`Loaded ${parsed.slides.length} slide${parsed.slides.length === 1 ? '' : 's'} from ${trimmed}.`);
    setBannerTone('info');
  }, [session]);

  useEffect(() => {
    loadDeck(session.state.deckPath);
  }, []);

  const useCurrentFile = useCallback(() => {
    if (!isDeckPath(props.currentFilePath)) {
      setBanner(`Current file is not a markdown or TSX slide deck: ${props.currentFilePath || '(none)'}.`);
      setBannerTone('warn');
      return;
    }
    setDraftPath(props.currentFilePath);
    loadDeck(props.currentFilePath);
  }, [loadDeck, props.currentFilePath]);

  const loadFromDraft = useCallback(() => loadDeck(draftPath), [draftPath, loadDeck]);

  const slideCount = deck?.slides.length || 0;
  const activeIndex = slideCount > 0 ? Math.max(0, Math.min(session.state.slideIndex, slideCount - 1)) : 0;

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg, gap: 12, padding: 12 }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ gap: 3, flexGrow: 1, flexBasis: 0, minWidth: 220 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Presentation Panel</Text>
          <Text fontSize={10} color={COLORS.textDim}>{banner}</Text>
        </Col>
        <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextInput value={draftPath} onChangeText={setDraftPath} placeholder="path/to/presentation.md" style={{ minWidth: 260, flexGrow: 1, flexBasis: 260, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, paddingRight: 8, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontSize: 10, fontFamily: 'monospace' }} />
          <TextInput value={String(session.state.durationMinutes)} onChangeText={(v: string) => session.setDurationMinutes(Number(v))} placeholder="duration" style={{ width: 74, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, paddingRight: 8, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontSize: 10, fontFamily: 'monospace' }} />
          <TextInput value={String(session.state.warningMinutes)} onChangeText={(v: string) => session.setWarningMinutes(Number(v))} placeholder="warn" style={{ width: 64, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, paddingRight: 8, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontSize: 10, fontFamily: 'monospace' }} />
          <Pressable onPress={loadFromDraft} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Load presentation</Text>
          </Pressable>
          <Pressable onPress={useCurrentFile} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Use current file</Text>
          </Pressable>
          {props.onOpenPath ? (
            <Pressable onPress={() => props.onOpenPath?.(session.state.deckPath)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Open source</Text>
            </Pressable>
          ) : null}
          {props.onClose ? (
            <Pressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
            </Pressable>
          ) : null}
        </Row>
      </Row>

      {bannerTone !== 'info' ? (
        <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: bannerTone === 'error' ? COLORS.red : COLORS.yellow, backgroundColor: bannerTone === 'error' ? COLORS.redDeep : COLORS.yellowDeep }}>
          <Text fontSize={10} color={bannerTone === 'error' ? COLORS.red : COLORS.yellow} style={{ fontWeight: 'bold' }}>{banner}</Text>
        </Box>
      ) : null}

      {deck ? (
        <Presentation
          deck={deck}
          state={session.state}
          onSelectSlide={session.setSlideIndex}
          onFirstSlide={session.firstSlide}
          onPrevSlide={session.prevSlide}
          onNextSlide={() => session.setSlideIndex(Math.min(slideCount - 1, activeIndex + 1))}
          onLastSlide={() => session.setSlideIndex(Math.max(0, slideCount - 1))}
          onToggleNotes={session.toggleNotes}
          onResetTimer={session.resetTimer}
        />
      ) : (
        <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.panelRaised }}>
          <Col style={{ gap: 6, alignItems: 'center' }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>No deck loaded</Text>
            <Text fontSize={10} color={COLORS.textDim}>Load the workspace markdown deck or pick a TSX slide array.</Text>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{baseName(session.state.deckPath) || session.state.deckPath}</Text>
          </Col>
        </Box>
      )}
    </Col>
  );
}
