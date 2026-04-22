const React: any = require('react');
const { useMemo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import { register } from '../../panel-registry';
import { useToastStore, type ToastFilterLevel, type ToastLevel, type ToastPosition } from './useToast';

const LEVELS: Array<{ value: ToastFilterLevel; label: string; tone: string }> = [
  { value: 'all', label: 'All', tone: COLORS.textMuted },
  { value: 'info', label: 'Info', tone: COLORS.blue },
  { value: 'success', label: 'Success', tone: COLORS.green },
  { value: 'warn', label: 'Warn', tone: COLORS.yellow },
  { value: 'error', label: 'Error', tone: COLORS.red },
];

const POSITIONS: Array<{ value: ToastPosition; label: string }> = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

const MAX_VISIBLE_OPTIONS = [1, 2, 3, 4, 6, 8];
const AUTO_DISMISS_OPTIONS = [0, 2000, 3500, 4500, 6000, 10000];

function toneForLevel(level: ToastLevel): string {
  if (level === 'success') return COLORS.green;
  if (level === 'warn') return COLORS.yellow;
  if (level === 'error') return COLORS.red;
  return COLORS.blue;
}

function surfaceForLevel(level: ToastLevel): string {
  if (level === 'success') return COLORS.greenDeep;
  if (level === 'warn') return COLORS.yellowDeep;
  if (level === 'error') return COLORS.redDeep;
  return COLORS.blueDeep;
}

function timeLabel(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function ToneChip(props: { active?: boolean; label: string; tone: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 5,
        paddingBottom: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: props.active ? props.tone : COLORS.border,
        backgroundColor: props.active ? surfaceForLevel('info') : COLORS.panelAlt,
      }}
    >
      <Text fontSize={9} color={props.active ? props.tone : COLORS.textMuted} style={{ fontWeight: 'bold' }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function OptionRow(props: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: props.active ? COLORS.blue : COLORS.border,
        backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelRaised,
      }}
    >
      <Text fontSize={9} color={props.active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function ToastHistoryPanel() {
  const { history, settings, setSettings, clearHistory } = useToastStore();
  const filteredHistory = useMemo(() => {
    return settings.levelFilter === 'all'
      ? history
      : history.filter((item) => item.level === settings.levelFilter);
  }, [history, settings.levelFilter]);
  const visibleHistory = filteredHistory.slice(0, 48);

  return (
    <Col style={{ gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Icon name="clock" size={14} color={COLORS.blue} />
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            Notifications
          </Text>
          <Text fontSize={10} color={COLORS.textDim}>
            Last {visibleHistory.length} toast{visibleHistory.length === 1 ? '' : 's'} shown here
          </Text>
        </Col>
        <Pressable
          onPress={clearHistory}
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
          }}
        >
          <Text fontSize={9} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
            Clear
          </Text>
        </Pressable>
      </Row>

      <Col style={{ gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          FILTER
        </Text>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {LEVELS.map((level) => (
            <ToneChip
              key={level.value}
              active={settings.levelFilter === level.value}
              label={level.label}
              tone={level.tone}
              onPress={() => setSettings({ levelFilter: level.value })}
            />
          ))}
        </Row>
      </Col>

      <Col style={{ gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          POSITION
        </Text>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {POSITIONS.map((position) => (
            <OptionRow
              key={position.value}
              label={position.label}
              active={settings.position === position.value}
              onPress={() => setSettings({ position: position.value })}
            />
          ))}
        </Row>
      </Col>

      <Col style={{ gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          MAX VISIBLE
        </Text>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {MAX_VISIBLE_OPTIONS.map((count) => (
            <OptionRow
              key={count}
              label={String(count)}
              active={settings.maxVisible === count}
              onPress={() => setSettings({ maxVisible: count })}
            />
          ))}
        </Row>
      </Col>

      <Col style={{ gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          AUTO DISMISS
        </Text>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {AUTO_DISMISS_OPTIONS.map((ms) => (
            <OptionRow
              key={ms}
              label={ms === 0 ? 'Off' : String(Math.round(ms / 1000)) + 's'}
              active={settings.autoDismissMs === ms}
              onPress={() => setSettings({ autoDismissMs: ms })}
            />
          ))}
        </Row>
      </Col>

      <Col style={{ gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          HISTORY
        </Text>
        <ScrollView showScrollbar={true} style={{ maxHeight: 520 }}>
          <Col style={{ gap: 8 }}>
            {visibleHistory.length === 0 ? (
              <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
                <Text fontSize={10} color={COLORS.textDim}>
                  No toast history yet.
                </Text>
              </Box>
            ) : null}
            {visibleHistory.map((item) => (
              <Box
                key={item.id}
                style={{
                  padding: 10,
                  borderRadius: TOKENS.radiusMd,
                  borderWidth: 1,
                  borderColor: toneForLevel(item.level),
                  backgroundColor: COLORS.panelRaised,
                  gap: 6,
                }}
              >
                <Row style={{ alignItems: 'center', gap: 8 }}>
                  <Box
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: toneForLevel(item.level),
                    }}
                  />
                  <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }}>
                    {item.title}
                  </Text>
                  <Text fontSize={9} color={COLORS.textDim}>
                    {timeLabel(item.createdAt)}
                  </Text>
                </Row>
                <Text fontSize={10} color={COLORS.textDim} style={{ lineHeight: 14 }}>
                  {item.body}
                </Text>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  <OptionRow label={item.level.toUpperCase()} active={false} onPress={() => setSettings({ levelFilter: item.level })} />
                  <OptionRow label={item.actions.length ? String(item.actions.length) + ' actions' : 'no actions'} active={false} onPress={() => {}} />
                </Row>
              </Box>
            ))}
          </Col>
        </ScrollView>
      </Col>
    </Col>
  );
}

register({
  id: 'toast-history',
  title: 'Notifications',
  defaultSlot: 'center',
  icon: 'clock',
  component: ToastHistoryPanel,
  userVisible: true,
  defaultOpen: false,
});
