import { useEffect } from 'react';
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

function ControlButton(props: { label: string; shortcut?: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text>
        {props.shortcut ? <Text fontSize={9} color={COLORS.textDim}>{props.shortcut}</Text> : null}
      </Row>
    </Pressable>
  );
}

function isEditableTarget(target: any): boolean {
  const tag = String(target?.tagName || target?.nodeName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!target?.isContentEditable;
}

export function PresenterControls(props: {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onToggleNotes: () => void;
}) {
  useEffect(() => {
    const handler = (event: any) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault?.();
        props.onPrev();
      } else if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault?.();
        props.onNext();
      } else if (event.key === 'Home') {
        event.preventDefault?.();
        props.onFirst();
      } else if (event.key === 'End') {
        event.preventDefault?.();
        props.onLast();
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault?.();
        props.onToggleNotes();
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [props]);

  return (
    <Box style={{ paddingTop: 4 }}>
      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <ControlButton label="First" shortcut="Home" onPress={props.onFirst} />
        <ControlButton label="Prev" shortcut="←" onPress={props.onPrev} />
        <ControlButton label="Next" shortcut="→ / space" onPress={props.onNext} />
        <ControlButton label="Last" shortcut="End" onPress={props.onLast} />
        <ControlButton label="Toggle Notes" shortcut="N" onPress={props.onToggleNotes} />
        <Text fontSize={10} color={COLORS.textDim}>Keyboard: ← → space, Home, End, N.</Text>
      </Row>
    </Box>
  );
}
