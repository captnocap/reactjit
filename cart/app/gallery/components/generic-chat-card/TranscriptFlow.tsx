import { Box, Col } from '@reactjit/runtime/primitives';
import { Bot, Braces, CircleHelp, Terminal, User } from '@reactjit/runtime/icons/icons';
import { Icon, type IconData } from '../../../sweatshop/components/icons';
import { RailBadge, type RailBadgeName } from './RailBadge';
import { CHAT_CARD, type ChatTone } from './tokens';
import { classifiers as S } from '@reactjit/core';

const FLOW_RAIL_WIDTH = 16;
const RAIL_SLOT_SIZE = 16;
const TURN_BADGE_SIZE = 16;
const TURN_BADGE_TOP = 3;
const STEP_BADGE_SIZE = 14;
const STEP_DOT_SIZE = 6;
const STEP_BADGE_TOP = 3;
const RAIL_GAP = 3;

function toneColor(tone: ChatTone): string {
  if (tone === 'user') return CHAT_CARD.cyan;
  if (tone === 'agent') return CHAT_CARD.orange;
  if (tone === 'thinking') return CHAT_CARD.orange;
  if (tone === 'tool') return CHAT_CARD.violet;
  return CHAT_CARD.pink;
}

function toneIcon(tone: ChatTone): IconData {
  if (tone === 'user') return User;
  if (tone === 'agent') return Bot;
  if (tone === 'thinking') return CircleHelp;
  if (tone === 'tool') return Terminal;
  return Braces;
}

export function TurnBadge({ tone }: { tone: ChatTone }) {
  const color = toneColor(tone);

  return (
    <Box
      style={{
        width: TURN_BADGE_SIZE,
        height: TURN_BADGE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#29304a',
        borderWidth: 1,
        borderColor: color,
        borderRadius: 3,
      }}
    >
      <Icon icon={toneIcon(tone)} size={10} color={color} strokeWidth={2.2} />
    </Box>
  );
}

function RailColumn({
  color,
  slotTop,
  slotHeight,
  connectTop,
  connectBottom,
  children,
}: {
  color: string;
  slotTop: number;
  slotHeight: number;
  connectTop: boolean;
  connectBottom: boolean;
  children: any;
}) {
  const centerX = Math.floor((FLOW_RAIL_WIDTH - 1) / 2);
  const topLineHeight = Math.max(0, slotTop - RAIL_GAP);
  const bottomLineTop = slotTop + slotHeight + RAIL_GAP;

  return (
    <Box style={{ width: FLOW_RAIL_WIDTH, position: 'relative', alignItems: 'center', overflow: 'visible' }}>
      {connectTop ? (
        <Box
          style={{
            position: 'absolute',
            left: centerX,
            top: 0,
            height: topLineHeight,
            width: 1,
            backgroundColor: color,
          }}
        />
      ) : null}
      {connectBottom ? (
        <Box
          style={{
            position: 'absolute',
            left: centerX,
            top: bottomLineTop,
            bottom: 0,
            width: 1,
            backgroundColor: color,
          }}
        />
      ) : null}
      <Box
        style={{
          marginTop: slotTop,
          width: FLOW_RAIL_WIDTH,
          height: slotHeight,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function TranscriptTurnShell({
  tone,
  connectTop = false,
  showConnector,
  children,
}: {
  tone: ChatTone;
  connectTop?: boolean;
  showConnector: boolean;
  children: any;
}) {
  const color = toneColor(tone);

  return (
    <S.InlineX4>
      <RailColumn color={color} slotTop={TURN_BADGE_TOP} slotHeight={RAIL_SLOT_SIZE} connectTop={connectTop} connectBottom={showConnector}>
        <TurnBadge tone={tone} />
      </RailColumn>
      <Col style={{ flexGrow: 1, minWidth: 0, gap: 5, paddingBottom: showConnector ? 12 : 0 }}>{children}</Col>
    </S.InlineX4>
  );
}

export function StepSpine({
  color,
  connectTop = false,
  showConnector,
  badgeName,
}: {
  color: string;
  connectTop?: boolean;
  showConnector: boolean;
  badgeName?: RailBadgeName;
}) {
  return (
    <RailColumn color={color} slotTop={STEP_BADGE_TOP} slotHeight={RAIL_SLOT_SIZE} connectTop={connectTop} connectBottom={showConnector}>
      {badgeName ? <RailBadge name={badgeName} color={color} /> : <Box style={{ width: STEP_DOT_SIZE, height: STEP_DOT_SIZE, backgroundColor: color, borderRadius: STEP_DOT_SIZE / 2 }} />}
    </RailColumn>
  );
}

export function StepCardShell({
  color,
  connectTop = false,
  showConnector,
  badgeName,
  children,
}: {
  color: string;
  connectTop?: boolean;
  showConnector: boolean;
  badgeName?: RailBadgeName;
  children: any;
}) {
  return (
    <S.InlineX4>
      <StepSpine color={color} connectTop={connectTop} showConnector={showConnector} badgeName={badgeName} />
      <Box style={{ flexGrow: 1, paddingBottom: showConnector ? 10 : 0 }}>{children}</Box>
    </S.InlineX4>
  );
}
