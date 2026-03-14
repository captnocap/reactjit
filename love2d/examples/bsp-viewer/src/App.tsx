import React from 'react';
import { Box, Text, ScrollView } from '@reactjit/core';

const C = {
  bg: '#ffffff',
  text: '#1a1a1a',
  muted: '#6b7280',
  accent: '#2563eb',
  divider: '#e5e7eb',
};

function Section({ children }: { children: React.ReactNode }) {
  return (
    <Box style={{ paddingBottom: 28 }}>
      {children}
    </Box>
  );
}

function Divider() {
  return (
    <Box style={{
      width: 40,
      height: 2,
      backgroundColor: C.divider,
      marginTop: 8,
      marginBottom: 8,
    }} />
  );
}

function P({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
      {children}
    </Text>
  );
}

function Quote({ children }: { children: string }) {
  return (
    <Box style={{
      borderLeftWidth: 3,
      borderLeftColor: C.accent,
      paddingLeft: 16,
      marginTop: 4,
      marginBottom: 4,
    }}>
      <Text style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
        {children}
      </Text>
    </Box>
  );
}

export function App() {
  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
    }}>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{
          padding: 32,
          paddingTop: 48,
          gap: 4,
          maxWidth: 520,
        }}>

          {/* Title */}
          <Section>
            <Text style={{ fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 1.5 }}>
              ORIGIN STORY
            </Text>
            <Text style={{ fontSize: 28, color: C.text, fontWeight: '700', paddingTop: 8 }}>
              ReactJIT
            </Text>
            <Text style={{ fontSize: 14, color: C.muted, paddingTop: 4 }}>
              19 days from impossible to this screen
            </Text>
          </Section>

          <Divider />

          {/* The game */}
          <Section>
            <P>
              So I was making a game. A dead internet theory simulator. The whole thing runs in Tauri and basically emulates an entire OS — browser, desktop apps, social media, the whole internet packed into a simulation. That's a different story.
            </P>
          </Section>

          {/* The meta idea */}
          <Section>
            <P>
              But I got to this point where I looked at it all and said: this would be funny to put on a monitor, inside of a game. All meta. A game inside a game.
            </P>
          </Section>

          {/* Three.js */}
          <Section>
            <P>
              I knew about a project called counter-strike-js — someone had built a really good BSP parser for the web. So I took that to Claude a few months ago and said "hey, can you make these maps render in Three.js?"
            </P>
            <P>
              And that happened. It was pretty cool.
            </P>
          </Section>

          <Divider />

          {/* The performance problem */}
          <Section>
            <P>
              Fast forward. I'm thinking: ok, I have a BSP parser to Three.js, but Three.js performance is already rough — and how do I get another game running inside of that?
            </P>
          </Section>

          {/* Love.js discovery */}
          <Section>
            <P>
              So I asked: how is love.js performance in the browser?
            </P>
            <Quote>
              Pretty bad, nothing worth checking out really.
            </Quote>
            <P>
              But I didn't have anything to lose.
            </P>
          </Section>

          {/* g3d */}
          <Section>
            <P>
              Love2D is just 2D. I need 3D. Looking around I found g3d. Seemed pretty straightforward. So I told Claude: use Love2D with g3d, write a BSP-to-OBJ converter, and let's see how this renders.
            </P>
          </Section>

          {/* The shock */}
          <Section>
            <P>
              That was shocking. Probably 4x more performant than Three.js on the exact same render.
            </P>
            <P>
              That alone made me question basically most of what I knew or what I was being told.
            </P>
          </Section>

          <Divider />

          {/* React question */}
          <Section>
            <P>
              Next question: how about React UI inside of Love2D? I asked Claude to research it. The results were a mixed bag.
            </P>
          </Section>

          {/* The leap */}
          <Section>
            <P>
              But I was already told love.js would be bad, and that wasn't true. So I had no reason to believe something unorthodox might not work either.
            </P>
            <Quote>
              Just shoot me any idea. Maybe it doesn't work but I don't have anything to lose. Let's just see what happens.
            </Quote>
          </Section>

          {/* The punchline */}
          <Section>
            <Box style={{ paddingTop: 16, paddingBottom: 16 }}>
              <Text style={{ fontSize: 20, color: C.text, fontWeight: '700' }}>
                19 days later.
              </Text>
              <Text style={{ fontSize: 14, color: C.muted, paddingTop: 8 }}>
                This text is rendered by ReactJIT — a custom React renderer running inside Love2D, drawn onto a 3D surface in a Source engine map.
              </Text>
            </Box>
          </Section>

          <Divider />

          {/* End marker */}
          <Box style={{ paddingTop: 24, paddingBottom: 64, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: C.divider, fontWeight: '600', letterSpacing: 2 }}>
              KEEP SCROLLING
            </Text>
          </Box>

        </Box>
      </ScrollView>
    </Box>
  );
}
