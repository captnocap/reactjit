/**
 * StyleDemo — hover-tooltip wrapper for style reference demos.
 *
 * Wraps a demo element and shows a tooltip at the mouse pointer listing
 * every equivalent syntax for the demonstrated style properties.
 */

import React, { useState, useRef } from 'react';
import { Box, Text, classifiers as S} from '../../../../packages/core/src';

// ── Types ────────────────────────────────────────────────────────────

export interface Way {
  label: string; // "style={}" | "shorthand" | "tw()" | "HTML" | "theme" | "Col"
  code: string;  // the actual code snippet
}

export interface PropertyDemo {
  property: string; // style property name, e.g. "backgroundColor"
  ways: Way[];
}

export interface StyleDemoProps {
  /** Style properties demonstrated by this element. */
  properties: PropertyDemo[];
  /** The demo element(s) to render. */
  children: React.ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Shorthand to build a Way[] from [label, code] tuples. */
export function ways(entries: [string, string][]): Way[] {
  return entries.map(([label, code]) => ({ label, code }));
}

// ── Component ────────────────────────────────────────────────────────

export function StyleDemo({ properties, children }: StyleDemoProps) {
  const [hovered, setHovered] = useState(false);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const layoutRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  return (
    <Box
      style={{ position: 'relative', width: '100%', zIndex: hovered ? 9999 : 0, overflow: 'visible' }}
      onLayout={(e: any) => {
        layoutRef.current = { x: e.x, y: e.y, w: e.width, h: e.height };
      }}
      onPointerEnter={(e: any) => {
        const rel = {
          x: e.x - layoutRef.current.x + 12,
          y: e.y - layoutRef.current.y + 12,
        };
        setTipPos(rel);
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      {children}
      {hovered ? (
        <Box style={{
          position: 'absolute',
          left: tipPos.x,
          top: tipPos.y,
          zIndex: 9999,
        }}>
          <Box style={{
            backgroundColor: [0.03, 0.03, 0.05, 0.94],
            borderRadius: 4,
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: 10,
            paddingRight: 10,
            borderWidth: 1,
            borderColor: '#40405a',
            gap: 1,
            minWidth: 320,
          }}>
            {properties.map((p, i) => (
              <React.Fragment key={i}>
                <S.StoryBtnText style={{ color: '#61a6fa' }}>{p.property}</S.StoryBtnText>
                {p.ways.map((w, j) => (
                  // rjit-ignore-next-line
                  <S.RowG6 key={j} style={{ alignItems: 'baseline' }}>
                    <Text style={{ color: '#61a6fa', fontSize: 9, minWidth: 60 }}>{w.label}</Text>
                    <Text style={{ color: '#c4cad8', fontSize: 9 }}>{w.code}</Text>
                  </S.RowG6>
                ))}
                {i < properties.length - 1 ? (
                  <Box style={{ height: 3 }} />
                ) : null}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
