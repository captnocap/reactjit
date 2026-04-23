import { useState } from 'react';
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

const SCORES = ['--', '-', '|', '+', '++'];

function sentimentColor(score: string, selected: boolean): { bg: string; border: string; text: string } {
  if (!selected) return { bg: 'transparent', border: 'transparent', text: CHAT_CARD.faint };
  if (score.includes('-')) return { bg: '#3a2031', border: CHAT_CARD.pink, text: CHAT_CARD.pink };
  if (score.includes('+')) return { bg: '#18382f', border: CHAT_CARD.green, text: CHAT_CARD.green };
  return { bg: '#30364b', border: CHAT_CARD.border, text: CHAT_CARD.text };
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
      <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: colors.text }}>{score}</Text>
    </Pressable>
  );
}

export function SentimentControls({ initial = '-' }: { initial?: string }) {
  const [selected, setSelected] = useState(initial);

  return (
    <Box
      style={{
        padding: 2,
        backgroundColor: '#121827',
        borderWidth: 1,
        borderColor: '#38435e',
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

