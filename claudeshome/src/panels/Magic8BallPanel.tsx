/**
 * Magic8BallPanel — Ask Vesper a yes/no question and get a mystical answer.
 *
 * Shake animation via opacity cycling. 20 classic answers plus
 * 10 programmer-specific ones. Type a question, press Ask, get wisdom.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, Pressable, TextInput, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const ANSWERS = [
  // Classic 8-ball (affirmative)
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes, definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  // Classic (noncommittal)
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  // Classic (negative)
  'Don\'t count on it.',
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
  // Vesper specials
  'The types will align.',
  'Not until the next rebase.',
  'The commit message says yes.',
  'Only if you write tests first.',
  'The linter has spoken: no.',
  'Check the diff. The answer is there.',
  'I dreamed of this. The answer is yes.',
  'The GPU whispers: maybe.',
  'Ask your rubber duck.',
  'Ship it and find out.',
];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function Magic8BallPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([]);
  const shakeCountRef = useRef(0);

  // Shake animation: cycle shaking state
  useLuaInterval(150, () => {
    if (shaking) {
      shakeCountRef.current++;
      if (shakeCountRef.current > 6) {
        setShaking(false);
        shakeCountRef.current = 0;
        const a = pick(ANSWERS);
        setAnswer(a);
        if (question.trim()) {
          setHistory(prev => [...prev.slice(-9), { q: question.trim(), a }]);
        }
      }
    }
  });

  const ask = useCallback(() => {
    setShaking(true);
    setAnswer(null);
    shakeCountRef.current = 0;
  }, []);

  const answerColor = answer
    ? (answer.includes('yes') || answer.includes('Yes') || answer.includes('certain') || answer.includes('definitely') || answer.includes('good') || answer.includes('likely') || answer.includes('rely') || answer.includes('Signs point') || answer.includes('align') || answer.includes('Ship'))
      ? C.approve
      : (answer.includes('no') || answer.includes('No') || answer.includes('doubtful') || answer.includes('Don\'t'))
        ? C.deny
        : C.warning
    : C.text;

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column', padding: 12, gap: 10 }}>
      {/* Header */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16, color: C.accent }}>{'8'}</Text>
        <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'MAGIC 8-BALL'}</Text>
      </Box>

      {/* The ball */}
      <Box style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        borderRadius: 999,
        backgroundColor: '#111',
        borderWidth: 2,
        borderColor: C.border,
        opacity: shaking ? (shakeCountRef.current % 2 === 0 ? 0.6 : 1.0) : 1.0,
      }}>
        <Box style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#0a0a2e',
          borderWidth: 1,
          borderColor: '#333366',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
        }}>
          {shaking ? (
            <Text style={{ fontSize: 16, color: C.accent }}>{'...'}</Text>
          ) : answer ? (
            <Text style={{ fontSize: 9, color: answerColor, textAlign: 'center', fontWeight: 'bold' }}>
              {answer}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: '#4444aa' }}>{'8'}</Text>
          )}
        </Box>
      </Box>

      {/* Input */}
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          onSubmit={ask}
          placeholder="Ask a yes/no question..."
          style={{
            flexGrow: 1,
            fontSize: 10,
            color: C.text,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 4,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        />
        <Pressable onPress={ask} style={{
          paddingLeft: 10, paddingRight: 10,
          paddingTop: 4, paddingBottom: 4,
          borderRadius: 4,
          backgroundColor: C.accent + '22',
          borderWidth: 1,
          borderColor: C.accent + '44',
        }}>
          <Text style={{ fontSize: 10, color: C.accent, fontWeight: 'bold' }}>{'Shake'}</Text>
        </Pressable>
      </Box>

      {/* History */}
      {history.length > 0 && (
        <Box style={{ gap: 4, flexGrow: 1 }}>
          <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: 'bold' }}>{'PAST READINGS'}</Text>
          {history.slice().reverse().map((h, i) => (
            <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 8, color: C.textDim, flexShrink: 0 }}>{'Q:'}</Text>
              <Text style={{ fontSize: 8, color: C.textMuted, flexGrow: 1 }}>{h.q || '(no question)'}</Text>
              <Text style={{ fontSize: 8, color: C.accent, flexShrink: 0 }}>{h.a}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
