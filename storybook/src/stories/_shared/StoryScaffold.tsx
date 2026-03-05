import React from 'react';
import { Box, Image, ScrollView, Text } from '../../../../packages/core/src';
import { useThemeColors } from '../../../../packages/theme/src';

export const STORY_MAX_WIDTH = 760;

// ── Layout 1 (StoryPage + StorySection) ─────────────────

export function StoryPage({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{
        width: '100%',
        padding: 16,
        alignItems: 'center',
        paddingBottom: 32,
      }}>
        <Box style={{ width: '100%', maxWidth: STORY_MAX_WIDTH, gap: 14 }}>
          {children}
        </Box>
      </Box>
    </ScrollView>
  );
}

export function StorySection({
  id,
  index,
  title,
  children,
}: {
  id?: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ position: 'relative', zIndex: 1000 - index }}>
      {/* rjit-ignore-next-line */}
      <Text style={{
        width: '100%',
        color: c.text,
        fontSize: 12,
        textAlign: 'left',
        marginBottom: 4,
      }}>
        {`${index}. ${title}`}
      </Text>
      <Box style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        padding: 12,
        gap: 8,
        alignItems: 'center',
      }}>
        {children}
      </Box>
    </Box>
  );
}

// ── Layout 2 (Band / Half / HeroBand / Callout / SectionLabel / Divider) ──
//
// NON-NEGOTIABLE alignment contract:
//   - Band is a row. Both halves vertically center (alignItems: 'center').
//   - Half is a column. Content starts at 0,0 — no paddingTop offsets.
//   - Padding, gap, and alignment are FIXED here. Stories never override them.
//   - Every band has identical padding. No per-row tweaks.

/** Full-width 1px separator between bands. */
export function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

/** Icon + uppercase label used as a section header inside a Half. */
export function SectionLabel({ icon, children, accentColor }: { icon: string; children: string; accentColor?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={accentColor ?? c.muted} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
  );
}

/** Two-column zigzag row. Both columns start at (0,0) in their allocated space. */
export function Band({ children }: { children: React.ReactNode }) {
  return (
    <Box style={{
      flexDirection: 'row',
      paddingLeft: 28,
      paddingRight: 28,
      paddingTop: 20,
      paddingBottom: 20,
      gap: 24,
      alignItems: 'center',
    }}>
      {children}
    </Box>
  );
}

/** One side of a Band. flexGrow:1 + flexBasis:0 = equal 50/50 split.
 *  Content centers at the panel datum (0,0) — both axes. */
export function Half({ children }: { children: React.ReactNode }) {
  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Box>
  );
}

/** Full-bleed hero strip with accent left border. */
export function HeroBand({ accentColor, children }: { accentColor: string; children: React.ReactNode }) {
  return (
    <Box style={{
      borderLeftWidth: 3,
      borderColor: accentColor,
      paddingLeft: 25,
      paddingRight: 28,
      paddingTop: 24,
      paddingBottom: 24,
      gap: 8,
    }}>
      {children}
    </Box>
  );
}

/** Full-width highlighted insight strip. */
export function CalloutBand({ borderColor, bgColor, children }: {
  borderColor: string;
  bgColor: string;
  children: React.ReactNode;
}) {
  return (
    <Box style={{
      backgroundColor: bgColor,
      borderLeftWidth: 3,
      borderColor: borderColor,
      paddingLeft: 25,
      paddingRight: 28,
      paddingTop: 14,
      paddingBottom: 14,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    }}>
      {children}
    </Box>
  );
}
