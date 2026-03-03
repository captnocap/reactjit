/**
 * Layout 2 — Package documentation page template.
 *
 * Mixed-band layout: alternating full-width, text+artifact, and
 * artifact+text rows so the page never reads like a flat document
 * or a rigid two-column grid.
 *
 * Band types:
 *   full          — full-width text or card, no split
 *   text-artifact — text left, code/card right
 *   artifact-text — code/card left, text right
 *
 * TEMPLATE: All content below is placeholder.
 */

import React from 'react';
import { Box, Text, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ children }: { children: string }) {
  const c = useThemeColors();
  return (
    <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
      {children}
    </Text>
  );
}

function Pill({ children }: { children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
    }}>
      <Text style={{ color: c.muted, fontSize: 10 }}>{children}</Text>
    </Box>
  );
}

function Tag({ children }: { children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.border,
      borderRadius: 3,
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 2,
      paddingBottom: 2,
    }}>
      <Text style={{ color: c.text, fontSize: 8 }}>{children}</Text>
    </Box>
  );
}

function BulletItem({ children }: { children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.primary }} />
      <Text style={{ color: c.text, fontSize: 10 }}>{children}</Text>
    </Box>
  );
}

// ── Layout2Story ─────────────────────────────────────────

export function Layout2Story() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'usePackage'}
        </Text>
        <Pill>{'@reactjit/package'}</Pill>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Reactive hooks for package integration'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Band 1: full — overview ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 20,
          gap: 8,
        }}>
          <SectionLabel>{'OVERVIEW'}</SectionLabel>
          <Text style={{ color: c.text, fontSize: 11 }}>
            {'A comprehensive hook for managing package state, subscriptions, and lifecycle.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 2: text + code row ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, flexShrink: 1, gap: 8 }}>
            <SectionLabel>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Import the hook from the package.'}
            </Text>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, flexShrink: 1 }}>
            <CodeBlock language="tsx" fontSize={9} code={"import { usePackage } from '@reactjit/package';\nimport { PackageProvider } from '@reactjit/package';"} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: full — API signature ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 10,
        }}>
          <SectionLabel>{'API'}</SectionLabel>
          <CodeBlock language="tsx" fontSize={9} code={"const [state, actions] = usePackage(key: string, options?: PackageOptions)\n\n// state\nstate.data\nstate.loading\nstate.error"} />
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Text style={{ color: c.text, fontSize: 9 }}>{'usePackage'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
