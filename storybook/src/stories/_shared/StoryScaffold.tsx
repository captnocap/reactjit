import React from 'react';
import { Box, Image, ScrollView, Text, useBreakpoint, classifiers as S} from '../../../../packages/core/src';
import { useThemeColors } from '../../../../packages/theme/src';

export const STORY_MAX_WIDTH = 760;

// ── Layout 1 (StoryPage + StorySection) ─────────────────

export function StoryPage({ children }: { children: React.ReactNode }) {
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{
        width: '100%',
        padding: compact ? 8 : 16,
        alignItems: 'center',
        paddingBottom: compact ? 16 : 32,
      }}>
        <Box style={{ width: '100%', maxWidth: STORY_MAX_WIDTH, gap: compact ? 10 : 14 }}>
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
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  return (
    <Box style={{ position: 'relative', zIndex: 1000 - index }}>
      {/* rjit-ignore-next-line */}
      <Text style={{
        width: '100%',
        color: c.text,
        fontSize: compact ? 11 : 12,
        textAlign: 'left',
        marginBottom: compact ? 2 : 4,
      }}>
        {`${index}. ${title}`}
      </Text>
      <Box style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderRadius: compact ? 8 : 10,
        borderWidth: 1,
        borderColor: c.border,
        padding: compact ? 8 : 12,
        gap: compact ? 6 : 8,
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
//   - Band is a row on md+ and stacks to column on sm (< 640px).
//   - Both halves vertically center (alignItems: 'center').
//   - Half is a column. Content starts at 0,0 — no paddingTop offsets.
//   - Padding, gap, and alignment adapt to breakpoint but are FIXED here.
//   - Stories never override them. Every band has identical padding at a given breakpoint.

/** Full-width 1px separator between bands. */
export function Divider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

/** Icon + uppercase label used as a section header inside a Half. */
export function SectionLabel({ icon, children, accentColor }: { icon: string; children: string; accentColor?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <S.StorySectionIcon src={icon} tintColor={accentColor ?? c.muted} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </Box>
  );
}

/** Two-column zigzag row. Stacks vertically on small screens. */
export function Band({ children }: { children: React.ReactNode }) {
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  return (
    <Box style={{
      flexDirection: compact ? 'column' : 'row',
      paddingLeft: compact ? 14 : 28,
      paddingRight: compact ? 14 : 28,
      paddingTop: compact ? 12 : 20,
      paddingBottom: compact ? 12 : 20,
      gap: compact ? 14 : 24,
      alignItems: 'center',
    }}>
      {children}
    </Box>
  );
}

/** One side of a Band. flexGrow:1 + flexBasis:0 = equal 50/50 split.
 *  Takes full width when stacked vertically on small screens. */
export function Half({ children }: { children: React.ReactNode }) {
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  return (
    <Box style={{
      flexGrow: 1,
      flexBasis: 0,
      width: compact ? '100%' : undefined,
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {children}
    </Box>
  );
}

/** Full-bleed hero strip with accent left border. */
export function HeroBand({ accentColor, children }: { accentColor: string; children: React.ReactNode }) {
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  return (
    <Box style={{
      borderLeftWidth: 3,
      borderColor: accentColor,
      paddingLeft: compact ? 12 : 25,
      paddingRight: compact ? 12 : 28,
      paddingTop: compact ? 14 : 24,
      paddingBottom: compact ? 14 : 24,
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
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  return (
    <Box style={{
      backgroundColor: bgColor,
      borderLeftWidth: 3,
      borderColor: borderColor,
      paddingLeft: compact ? 12 : 25,
      paddingRight: compact ? 12 : 28,
      paddingTop: compact ? 10 : 14,
      paddingBottom: compact ? 10 : 14,
      flexDirection: compact ? 'column' : 'row',
      gap: 8,
      alignItems: compact ? 'flex-start' : 'center',
    }}>
      {children}
    </Box>
  );
}

/** Audit label for demos that cannot prove themselves without user-supplied connectors. */
export function ExternalDependencyNotice({
  label = 'This is a mock demo, not a real representation.',
  detail = 'This story depends on external connectors, credentials, or services supplied by the user. Until those are configured, treat the UI as documentation of the integration surface rather than proof of a live backend.',
}: {
  label?: string;
  detail?: string;
}) {
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  return (
    <Box style={{
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderLeftWidth: 3,
      borderColor: 'rgba(245, 158, 11, 0.45)',
      paddingLeft: compact ? 12 : 25,
      paddingRight: compact ? 12 : 28,
      paddingTop: compact ? 10 : 14,
      paddingBottom: compact ? 10 : 14,
      gap: 6,
    }}>
      <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: 'bold' }}>
        {label}
      </Text>
      <Text style={{ color: '#d6d3d1', fontSize: 9 }}>
        {detail}
      </Text>
    </Box>
  );
}
