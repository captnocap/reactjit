import React from 'react';
import { Box, Text, Pressable, SVGAnimation, useHotState } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

// ── Inline SVG strings for demos ─────────────────────────

const STAR_SVG = `<svg viewBox="0 0 100 100" width="100" height="100">
  <path id="star" d="M50 5 L61 38 L97 38 L68 59 L79 93 L50 72 L21 93 L32 59 L3 38 L39 38 Z"
    fill="none" stroke="#FBBF24" stroke-width="2"/>
</svg>`;

const CIRCLE_SVG = `<svg viewBox="0 0 100 100" width="100" height="100">
  <circle id="shape" cx="50" cy="50" r="40" fill="none" stroke="#60A5FA" stroke-width="2"/>
</svg>`;

const SQUARE_SVG = `<svg viewBox="0 0 100 100" width="100" height="100">
  <rect id="shape" x="15" y="15" width="70" height="70" fill="none" stroke="#F472B6" stroke-width="2"/>
</svg>`;

const FACE_SVG = `<svg viewBox="0 0 120 120" width="120" height="120">
  <circle id="head" cx="60" cy="60" r="50" fill="#FBBF24" stroke="#D97706" stroke-width="2"/>
  <circle id="left-eye" cx="42" cy="48" r="6" fill="#1F2937"/>
  <circle id="right-eye" cx="78" cy="48" r="6" fill="#1F2937"/>
  <path id="mouth" d="M38 72 Q60 92 82 72" fill="none" stroke="#1F2937" stroke-width="3"/>
</svg>`;

const TRACK_SVG = `<svg viewBox="0 0 200 120" width="200" height="120">
  <path id="track" d="M10 60 C40 10, 80 10, 100 60 S160 110, 190 60"
    fill="none" stroke="#4ADE80" stroke-width="2"/>
</svg>`;

const HOUSE_SVG = `<svg viewBox="0 0 100 100" width="100" height="100">
  <path id="roof" d="M50 10 L90 45 L10 45 Z" fill="none" stroke="#F87171" stroke-width="2"/>
  <rect id="wall" x="20" y="45" width="60" height="40" fill="none" stroke="#93C5FD" stroke-width="2"/>
  <rect id="door" x="40" y="55" width="20" height="30" fill="none" stroke="#FBBF24" stroke-width="2"/>
  <rect id="window-l" x="25" y="52" width="12" height="12" fill="none" stroke="#A5B4FC" stroke-width="1.5"/>
  <rect id="window-r" x="63" y="52" width="12" height="12" fill="none" stroke="#A5B4FC" stroke-width="1.5"/>
</svg>`;

// ── Color palette ────────────────────────────────────────

const C = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  text: '#F1F5F9',
  muted: '#94A3B8',
  accent: '#818CF8',
  green: '#4ADE80',
  yellow: '#FBBF24',
  pink: '#F472B6',
};

// ── Shared demo card ─────────────────────────────────────

function DemoCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 12,
    }}>
      <Box style={{ gap: 4 }}>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{title}</Text>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 11 }}>{description}</Text>
      </Box>
      <Box style={{
        backgroundColor: c.bg,
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 140,
      }}>
        {children}
      </Box>
    </Box>
  );
}

// ── Section 1: Stroke Reveal ─────────────────────────────

function RevealDemo() {
  const [key, setKey] = useHotState('reveal-key', 0);
  return (
    <DemoCard
      title="Stroke Reveal"
      description="Paths draw on progressively over time. Click to restart."
    >
      <Pressable onPress={() => setKey(key + 1)} style={{ alignItems: 'center', gap: 12 }}>
        <Box style={{ flexDirection: 'row', gap: 24 }}>
          <SVGAnimation
            key={`star-${key}`}
            src={STAR_SVG}
            effect="reveal"
            duration={2000}
            easing="easeInOut"
            scale={1.5}
            strokeWidth={2.5}
          />
          <SVGAnimation
            key={`house-${key}`}
            src={HOUSE_SVG}
            effect="reveal"
            duration={3000}
            easing="easeOut"
            scale={1.5}
            fillReveal
          />
        </Box>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: C.muted, fontSize: 10 }}>{`Tap to restart`}</Text>
      </Pressable>
    </DemoCard>
  );
}

// ── Section 2: Reveal with Loop ──────────────────────────

function RevealLoopDemo() {
  return (
    <DemoCard
      title="Looping Reveal"
      description="Continuous draw-on animation with different easings."
    >
      <Box style={{ flexDirection: 'row', gap: 32 }}>
        <Box style={{ alignItems: 'center', gap: 6 }}>
          <SVGAnimation
            src={STAR_SVG}
            effect="reveal"
            duration={2500}
            easing="linear"
            loop
            scale={1.2}
          />
          {/* rjit-ignore-next-line */}
          <Text style={{ color: C.muted, fontSize: 9 }}>{`linear`}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 6 }}>
          <SVGAnimation
            src={CIRCLE_SVG}
            effect="reveal"
            duration={1800}
            easing="easeInOut"
            loop
            scale={1.2}
          />
          {/* rjit-ignore-next-line */}
          <Text style={{ color: C.muted, fontSize: 9 }}>{`easeInOut`}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 6 }}>
          <SVGAnimation
            src={SQUARE_SVG}
            effect="reveal"
            duration={2000}
            easing="bounce"
            loop
            scale={1.2}
          />
          {/* rjit-ignore-next-line */}
          <Text style={{ color: C.muted, fontSize: 9 }}>{`bounce`}</Text>
        </Box>
      </Box>
    </DemoCard>
  );
}

// ── Section 3: Path Morph ────────────────────────────────

function MorphDemo() {
  const [key, setKey] = useHotState('morph-key', 0);
  return (
    <DemoCard
      title="Path Morphing"
      description="Smoothly interpolates geometry between two SVGs. Click to restart."
    >
      <Pressable onPress={() => setKey(key + 1)} style={{ alignItems: 'center', gap: 12 }}>
        <Box style={{ flexDirection: 'row', gap: 32 }}>
          <Box style={{ alignItems: 'center', gap: 6 }}>
            <SVGAnimation
              key={`morph-cs-${key}`}
              src={CIRCLE_SVG}
              srcTo={SQUARE_SVG}
              effect="morph"
              duration={2000}
              easing="easeInOut"
              scale={1.3}
            />
            {/* rjit-ignore-next-line */}
            <Text style={{ color: C.muted, fontSize: 9 }}>{`circle \u2192 square`}</Text>
          </Box>
          <Box style={{ alignItems: 'center', gap: 6 }}>
            <SVGAnimation
              key={`morph-sc-${key}`}
              src={SQUARE_SVG}
              srcTo={STAR_SVG}
              effect="morph"
              duration={2500}
              easing="spring"
              loop
              scale={1.3}
            />
            {/* rjit-ignore-next-line */}
            <Text style={{ color: C.muted, fontSize: 9 }}>{`square \u2192 star (loop)`}</Text>
          </Box>
        </Box>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: C.muted, fontSize: 10 }}>{`Tap to restart`}</Text>
      </Pressable>
    </DemoCard>
  );
}

// ── Section 4: Per-Element Animation ─────────────────────

function ElementsDemo() {
  const [active, setActive] = useHotState('elem-active', false);
  return (
    <DemoCard
      title="Per-Element Animation"
      description="Animate individual SVG elements by ID. Click the face."
    >
      <Pressable onPress={() => setActive(!active)} style={{ alignItems: 'center', gap: 12 }}>
        <SVGAnimation
          src={FACE_SVG}
          effect="elements"
          duration={800}
          scale={1.5}
          targets={active ? {
            'left-eye': { scale: 1.4, duration: 300 },
            'right-eye': { scale: 1.4, duration: 300, delay: 100 },
            'mouth': { translateY: -5, duration: 500, delay: 200, easing: 'bounce' },
            'head': { fill: '#FCD34D', duration: 600 },
          } : {
            'left-eye': { scale: 1, duration: 300 },
            'right-eye': { scale: 1, duration: 300 },
            'mouth': { translateY: 0, duration: 300 },
          }}
        />
        {/* rjit-ignore-next-line */}
        <Text style={{ color: C.muted, fontSize: 10 }}>{active ? `Surprised!` : `Tap the face`}</Text>
      </Pressable>
    </DemoCard>
  );
}

// ── Section 5: Path Following ────────────────────────────

function FollowDemo() {
  const [pos, setPos] = useHotState('follow-pos', { x: 0, y: 0, angle: 0, progress: 0 });
  return (
    <DemoCard
      title="Path Following"
      description="Track position along an SVG path. The dot follows the green curve."
    >
      <Box style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{ position: 'relative' }}>
          <SVGAnimation
            src={TRACK_SVG}
            effect="follow"
            pathId="track"
            duration={3000}
            easing="linear"
            loop
            scale={1.5}
            onProgress={(data) => {
              setPos({
                x: data.x ?? 0,
                y: data.y ?? 0,
                angle: data.angle ?? 0,
                progress: data.progress,
              });
            }}
          />
        </Box>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: C.muted, fontSize: 10 }}>{`progress: ${(pos.progress * 100).toFixed(0)}%  x: ${pos.x.toFixed(0)}  y: ${pos.y.toFixed(0)}`}</Text>
      </Box>
    </DemoCard>
  );
}

// ── Main Story ───────────────────────────────────────────

export function SVGAnimationStory() {
  return (
    <StoryPage>
      <StorySection index={0} title="1 \u2014 Stroke Reveal">
        <RevealDemo />
      </StorySection>
      <StorySection index={1} title="2 \u2014 Looping Reveal">
        <RevealLoopDemo />
      </StorySection>
      <StorySection index={2} title="3 \u2014 Path Morphing">
        <MorphDemo />
      </StorySection>
      <StorySection index={3} title="4 \u2014 Per-Element Animation">
        <ElementsDemo />
      </StorySection>
      <StorySection index={4} title="5 \u2014 Path Following">
        <FollowDemo />
      </StorySection>
    </StoryPage>
  );
}
