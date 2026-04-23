
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Icon } from '../icons';
import { ToastActions } from './ToastActions';

import type { ToastItem } from './useToast';

function levelTone(level: ToastItem['level']): string {
  if (level === 'success') return COLORS.green;
  if (level === 'warn') return COLORS.yellow;
  if (level === 'error') return COLORS.red;
  return COLORS.blue;
}

function levelSurface(level: ToastItem['level']): string {
  if (level === 'success') return COLORS.greenDeep;
  if (level === 'warn') return COLORS.yellowDeep;
  if (level === 'error') return COLORS.redDeep;
  return COLORS.blueDeep;
}

function levelIcon(level: ToastItem['level']): string {
  if (level === 'success') return 'check';
  if (level === 'warn') return 'warn';
  if (level === 'error') return 'error';
  return 'question-mark';
}

export function Toast(props: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (!props.toast.duration || props.toast.duration <= 0) return;
    const id = setTimeout(() => props.onDismiss(props.toast.id), props.toast.duration);
    return () => clearTimeout(id);
  }, [props.toast.duration, props.toast.id, props.onDismiss]);

  const tone = levelTone(props.toast.level);
  const surface = levelSurface(props.toast.level);

  return (
    <Box
      style={{
        minWidth: 280,
        maxWidth: 380,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tone,
        backgroundColor: COLORS.panelRaised,
        gap: 10,
        shadowColor: tone,
        shadowOpacity: 0.24,
        shadowRadius: 18,
      }}
    >
      <Row style={{ alignItems: 'flex-start', gap: 10 }}>
        <Box style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: surface,
          borderWidth: 1,
          borderColor: tone,
          flexShrink: 0,
        }}>
          <Icon name={levelIcon(props.toast.level)} size={14} color={tone} />
        </Box>
        <Col style={{ gap: 4, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {props.toast.title}
          </Text>
          <Text fontSize={10} color={COLORS.textDim} style={{ lineHeight: 14 }}>
            {props.toast.body}
          </Text>
          <ToastActions actions={props.toast.actions} />
        </Col>
        <Pressable
          onPress={() => props.onDismiss(props.toast.id)}
          style={{
            padding: 4,
            borderRadius: 8,
            backgroundColor: COLORS.panelAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>x</Text>
        </Pressable>
      </Row>
    </Box>
  );
}
