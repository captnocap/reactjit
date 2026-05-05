import { useState } from 'react';
import { Box, Pressable, Row } from '@reactjit/runtime/primitives';
import { Frown, Meh, Smile, ThumbsDown, ThumbsUp } from '@reactjit/runtime/icons/icons';
import { Icon, type IconData } from '@reactjit/runtime/icons/Icon';
import { CHAT_CARD } from './tokens';

const SCORES = ['--', '-', '|', '+', '++'];

function sentimentColor(score: string, selected: boolean): { bg: string; border: string; text: string } {
  if (!selected) return { bg: 'theme:transparent', border: 'theme:transparent', text: CHAT_CARD.faint };
  if (score.includes('-')) return { bg: 'theme:rule', border: CHAT_CARD.pink, text: CHAT_CARD.pink };
  if (score.includes('+')) return { bg: 'theme:bg2', border: CHAT_CARD.green, text: CHAT_CARD.green };
  return { bg: 'theme:inkGhost', border: CHAT_CARD.border, text: CHAT_CARD.text };
}

function sentimentIcon(score: string): IconData {
  if (score === '--') return ThumbsDown;
  if (score === '-') return Frown;
  if (score === '++') return ThumbsUp;
  if (score === '+') return Smile;
  return Meh;
}

export function SentimentButton({ score, selected, onSelect }: { score: string; selected: boolean; onSelect: (score: string) => void }) {
  const colors = sentimentColor(score, selected);

  return (
    <Pressable
      onPress={() => onSelect(score)}
      style={{
        minWidth: 20,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 4,
      }}
    >
      <Icon icon={sentimentIcon(score)} size={10} color={colors.text} strokeWidth={2.2} />
    </Pressable>
  );
}

export function SentimentControls({ initial = '-' }: { initial?: string }) {
  const [selected, setSelected] = useState(initial);

  return (
    <Box
      style={{
        flexShrink: 0,
        padding: 2,
        backgroundColor: 'theme:bg',
        borderWidth: 1,
        borderColor: 'theme:inkGhost',
        borderRadius: 4,
      }}
    >
      <Row style={{ gap: 2 }}>
        {SCORES.map((score) => (
          <SentimentButton key={score} score={score} selected={selected === score} onSelect={setSelected} />
        ))}
      </Row>
    </Box>
  );
}
