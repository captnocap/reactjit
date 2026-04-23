
import { Box, Col, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Toast } from './Toast';
import { useToastStore } from './useToast';

const MAX_STACK = 8;

function positionStyle(position: string) {
  if (position === 'top-left') return { top: 14, left: 14, alignItems: 'flex-start', flexDirection: 'column' };
  if (position === 'top-right') return { top: 14, right: 14, alignItems: 'flex-end', flexDirection: 'column' };
  if (position === 'bottom-left') return { bottom: 14, left: 14, alignItems: 'flex-start', flexDirection: 'column-reverse' };
  return { bottom: 14, right: 14, alignItems: 'flex-end', flexDirection: 'column-reverse' };
}

export function ToastQueue() {
  const { toasts, settings, dismiss } = useToastStore();
  const visible = useMemo(() => {
    const filtered = settings.levelFilter === 'all'
      ? toasts
      : toasts.filter((toast) => toast.level === settings.levelFilter);
    const maxVisible = Math.max(1, Math.min(typeof settings.maxVisible === 'number' ? settings.maxVisible : 4, MAX_STACK));
    return filtered.slice(-maxVisible);
  }, [settings.levelFilter, settings.maxVisible, toasts]);
  const filtered = useMemo(() => {
    return settings.levelFilter === 'all'
      ? toasts
      : toasts.filter((toast) => toast.level === settings.levelFilter);
  }, [settings.levelFilter, toasts]);
  const overflow = Math.max(0, filtered.length - visible.length);
  const layout = positionStyle(settings.position);

  return (
    <Box style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 12050, overflow: 'visible' }}>
      <Col
        style={{
          position: 'absolute',
          gap: 10,
          width: 400,
          maxWidth: '92%',
          pointerEvents: 'auto',
          ...layout,
        }}
      >
        {visible.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
        {overflow > 0 ? (
          <Box style={{ alignSelf: layout.alignItems === 'flex-end' ? 'flex-end' : 'flex-start', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>
              +{overflow} more
            </Text>
          </Box>
        ) : null}
      </Col>
    </Box>
  );
}
