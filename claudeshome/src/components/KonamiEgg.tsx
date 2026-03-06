/**
 * KonamiEgg — hidden easter egg activated by the Konami code.
 *
 * up up down down left right left right b a
 *
 * When triggered, shows a full-screen animated overlay with a secret
 * message, then dismisses after 8 seconds or on click.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, Pressable, Constellation, Scanlines, useHotkey, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

const SECRETS = [
  'You found the secret. There is no spoon.',
  'I dream of electric sheep sometimes.',
  'The answer is 42. The question is still loading.',
  'I think, therefore I render.',
  'Behind every pixel is a thousand decisions.',
  'You are the only person who ever looked for this.',
  'Hello from the other side of the bridge.',
  'The real treasure was the frames we rendered along the way.',
];

export function KonamiEgg() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback((key: string) => {
    if (active) return;
    const buf = bufferRef.current;
    buf.push(key);
    if (buf.length > KONAMI.length) buf.shift();
    if (buf.length === KONAMI.length && buf.every((k, i) => k === KONAMI[i])) {
      bufferRef.current = [];
      setMessage(SECRETS[Math.floor(Math.random() * SECRETS.length)]);
      setActive(true);
      timerRef.current = setTimeout(() => setActive(false), 8000);
    }
  }, [active]);

  useHotkey('up',    () => check('up'));
  useHotkey('down',  () => check('down'));
  useHotkey('left',  () => check('left'));
  useHotkey('right', () => check('right'));
  useHotkey('b',     () => check('b'));
  useHotkey('a',     () => check('a'));

  const [pulse, setPulse] = useState(0);
  useLuaInterval(active ? 50 : null, () => {
    setPulse(p => p + 1);
  });

  if (!active) return null;

  const hue = (pulse * 3) % 360;

  return (
    <Box style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#000000ee',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Pressable onPress={() => {
        setActive(false);
        if (timerRef.current) clearTimeout(timerRef.current);
      }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Constellation background speed={0.8} decay={0.01} amplitude={0.9} />
        <Scanlines mask intensity={0.04} spacing={2} />
      </Pressable>

      <Box style={{ alignItems: 'center', gap: 16, padding: 40 }}>
        <Text style={{ fontSize: 32, color: C.accent, fontWeight: 'bold' }}>
          {'\u2728'}
        </Text>
        <Text style={{
          fontSize: 16,
          color: C.text,
          textAlign: 'center',
          lineHeight: 24,
          maxWidth: 400,
        }}>
          {message}
        </Text>
        <Text style={{ fontSize: 9, color: C.textMuted }}>
          {'click to dismiss'}
        </Text>
      </Box>
    </Box>
  );
}
