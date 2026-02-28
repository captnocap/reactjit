/**
 * FortuneCookiePanel — inspiration on boot.
 *
 * On mount, picks a random quote from the embedded list and shows it for 30
 * seconds with a live countdown and a skip button. After the timer, hands
 * off to MemoryPanel. Motivational. Intentional. Not empty.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, Pressable, useLuaInterval } from '@reactjit/core';
import { MemoryPanel } from './MemoryPanel';
import { C } from '../theme';

const DISPLAY_SECS = 30;

// ── Quote bank ───────────────────────────────────────────────────────

const QUOTES: Array<{ text: string; author: string }> = [
  { text: 'The purpose of abstraction is not to be vague, but to create a new semantic level in which one can be absolutely precise.', author: 'Dijkstra' },
  { text: 'A language that doesn\'t affect the way you think about programming is not worth knowing.', author: 'Alan Perlis' },
  { text: 'The most important property of a program is whether it accomplishes the intention of its user.', author: 'C.A.R. Hoare' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', author: 'Fowler' },
  { text: 'Programs must be written for people to read, and only incidentally for machines to execute.', author: 'Abelson & Sussman' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'The best code is no code at all.', author: 'Jeff Atwood' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'The computing scientist\'s main challenge is not to get confused by the complexities of his own making.', author: 'Dijkstra' },
  { text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.', author: 'Saint-Exupéry' },
  { text: 'The most dangerous thought you can have as a creative person is to think you know what you\'re doing.', author: 'Bret Victor' },
  { text: 'Code is like humor. When you have to explain it, it\'s bad.', author: 'Cory House' },
  { text: 'An idiot admires complexity, a genius admires simplicity.', author: 'Terry Davis' },
  { text: 'Walking on water and developing software from a specification are easy if both are frozen.', author: 'Edward Berard' },
  { text: 'The function of good software is to make the complex appear simple.', author: 'Grady Booch' },
  { text: 'Software is a great combination of artistry and engineering.', author: 'Bill Gates' },
  { text: 'If debugging is the process of removing bugs, then programming must be the process of putting them in.', author: 'Dijkstra' },
  { text: 'The only way to go fast is to go well.', author: 'Robert C. Martin' },
  { text: 'It is not enough for code to work.', author: 'Robert C. Martin' },
  { text: 'You don\'t understand anything until you learn it more than one way.', author: 'Marvin Minsky' },
  { text: 'The most powerful tool we have as developers is automation.', author: 'Scott Hanselman' },
  { text: 'One of the best programming skills you can have is knowing when to walk away and come back later.', author: 'Oscar Godson' },
  { text: 'Every great developer you know got there by solving problems they were unqualified to solve until they did it.', author: 'Patrick McKenzie' },
  { text: 'The best way to get a project done faster is to start sooner.', author: 'Jim Highsmith' },
  { text: 'In theory, theory and practice are the same. In practice, they are not.', author: 'Einstein' },
  { text: 'Debugging is twice as hard as writing the code in the first place.', author: 'Brian Kernighan' },
  { text: 'There are only two hard things in computer science: cache invalidation and naming things.', author: 'Phil Karlton' },
  { text: 'Weeks of coding can save you hours of planning.', author: 'Unknown' },
  { text: 'The computer was born to solve problems that did not exist before.', author: 'Bill Gates' },
];

// ── Component ────────────────────────────────────────────────────────

export function FortuneCookiePanel() {
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);
  const [secondsLeft, setSecondsLeft] = useState(DISPLAY_SECS);
  const [done, setDone] = useState(false);

  useLuaInterval(1000, () => {
    setSecondsLeft(prev => {
      if (prev <= 1) {
        setDone(true);
        return 0;
      }
      return prev - 1;
    });
  });

  if (done) return <MemoryPanel />;

  const progress = secondsLeft / DISPLAY_SECS; // 1→0

  return (
    <Box style={{
      flexGrow:        1,
      flexDirection:   'column',
      justifyContent:  'center',
      alignItems:      'center',
      padding:         32,
      gap:             24,
      backgroundColor: C.panelB,
    }}>
      {/* Decorative opening mark */}
      <Text style={{ fontSize: 48, color: C.approve + '33', lineHeight: 40 }}>{'\u201C'}</Text>

      {/* Quote text */}
      <Box style={{ maxWidth: 420, alignItems: 'center' }}>
        <Text style={{
          fontSize:   15,
          color:      C.text,
          textAlign:  'center',
          lineHeight: 24,
        }}>
          {quote.text}
        </Text>
      </Box>

      {/* Author */}
      <Text style={{ fontSize: 11, color: C.approve, letterSpacing: 1 }}>
        {`— ${quote.author}`}
      </Text>

      {/* Progress bar + countdown */}
      <Box style={{ width: 200, gap: 8, alignItems: 'center' }}>
        <Box style={{
          width:           200,
          height:          2,
          backgroundColor: C.border,
          borderRadius:    1,
        }}>
          <Box style={{
            width:           Math.round(200 * progress),
            height:          2,
            backgroundColor: C.approve + '88',
            borderRadius:    1,
          }} />
        </Box>

        <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: C.textMuted }}>
            {`memory in ${secondsLeft}s`}
          </Text>
          <Pressable onPress={() => setDone(true)} style={{
            paddingLeft:     8,
            paddingRight:    8,
            paddingTop:      2,
            paddingBottom:   2,
            borderWidth:     1,
            borderColor:     C.border,
            borderRadius:    3,
          }}>
            <Text style={{ fontSize: 9, color: C.textDim }}>{'skip'}</Text>
          </Pressable>
        </Box>
      </Box>
    </Box>
  );
}
