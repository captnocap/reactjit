import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from '@reactjit/core';
import type { DialogueState } from '../systems/useDialogue';

export interface DialogueBoxProps {
  dialogue: DialogueState;
  speaker?: string;
  width?: number;
  onChoiceSelect?: (index: number) => void;
}

export function DialogueBox({
  dialogue,
  speaker,
  width = 400,
  onChoiceSelect,
}: DialogueBoxProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [typewriterDone, setTypewriterDone] = useState(false);
  const fullText = dialogue.currentNode?.text ?? '';
  const charIndexRef = useRef(0);

  // Typewriter effect
  useEffect(() => {
    charIndexRef.current = 0;
    setDisplayedText('');
    setTypewriterDone(false);

    if (!fullText) return;

    const tick = () => {
      charIndexRef.current++;
      if (charIndexRef.current >= fullText.length) {
        setDisplayedText(fullText);
        setTypewriterDone(true);
      } else {
        setDisplayedText(fullText.slice(0, charIndexRef.current));
        setTimeout(tick, 30);
      }
    };
    const id = setTimeout(tick, 30);
    return () => clearTimeout(id);
  }, [fullText]);

  if (!dialogue.isActive || !dialogue.currentNode) return null;

  const speakerName = dialogue.currentNode.speaker ?? speaker ?? '';
  const choices = dialogue.availableChoices;

  const choiceElements = typewriterDone && choices.length > 0
    ? choices.map((choice, i) =>
        React.createElement(
          Box,
          {
            key: i,
            onClick: () => {
              onChoiceSelect?.(i);
              dialogue.choose(i);
            },
            style: {
              backgroundColor: '#334155',
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#64748b',
            },
          },
          React.createElement(Text, {
            style: { fontSize: 12, color: '#e2e8f0' },
          }, choice.text),
        ),
      )
    : [];

  return React.createElement(
    Box,
    {
      style: {
        width,
        backgroundColor: '#1e293b',
        borderWidth: 2,
        borderColor: '#475569',
        borderRadius: 8,
        padding: 16,
        gap: 8,
      },
    },
    speakerName
      ? React.createElement(Text, {
          style: { fontSize: 14, fontWeight: 'bold', color: '#60a5fa' },
        }, speakerName)
      : null,
    React.createElement(Text, {
      style: { fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 },
    }, displayedText),
    choiceElements.length > 0
      ? React.createElement(
          Box,
          { style: { gap: 4, marginTop: 8 } },
          ...choiceElements,
        )
      : typewriterDone
        ? React.createElement(
            Box,
            {
              onClick: () => dialogue.advance(),
              style: {
                alignSelf: 'flex-end',
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
              },
            },
            React.createElement(Text, {
              style: { fontSize: 11, color: '#94a3b8' },
            }, '[Continue]'),
          )
        : null,
  );
}
