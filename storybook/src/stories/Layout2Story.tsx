/**
 * Layout 2 — Package documentation page template.
 *
 * Zigzag band layout: alternating text-left/artifact-right and
 * artifact-left/text-right rows, separated by dividers.
 * Designed for packages (hooks, APIs, capabilities) where there's
 * no visual preview — code IS the preview.
 *
 * Structure:
 *   Header — title + @package import + description
 *   Center — scrollable zigzag bands
 *     Band 1: text-left,    artifact-right  (overview + import)
 *     Band 2: artifact-left, text-right     (primary hook/API + description)
 *     Band 3: text-left,    artifact-right  (usage pattern + code example)
 *     Band 4: artifact-left, text-right     (components card or platform notes)
 *   Footer — breadcrumbs
 *
 * TEMPLATE: All content below is placeholder. When scaffolding a real
 * package story, replace the text and code blocks with real content.
 */

import React from 'react';
import { Box, Text, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Band helpers ─────────────────────────────────────────

function BandDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

/** A zigzag band — full-width row with a text side and an artifact side. */
function Band({ left, right, style }: { left: React.ReactNode; right: React.ReactNode; style?: any }) {
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 28,
      paddingRight: 28,
      paddingTop: 20,
      paddingBottom: 20,
      gap: 24,
      ...style,
    }}>
      <Box style={{ flexGrow: 1, flexBasis: 0, flexShrink: 1 }}>{left}</Box>
      <Box style={{ flexGrow: 1, flexBasis: 0, flexShrink: 1 }}>{right}</Box>
    </Box>
  );
}

/** Styled card for hook signatures, component links, etc. */
function ArtifactCard({ children }: { children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      gap: 6,
    }}>
      {children}
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
          {'Title'}
        </Text>

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
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'@reactjit/package'}
          </Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'TEMPLATE: One-line description of what this package provides.'}
        </Text>
      </Box>

      {/* ── Center: zigzag bands ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Band 1: Overview (text-left, import-right) ── */}
        <Band
          left={
            <Box style={{ gap: 6 }}>
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'OVERVIEW'}</Text>
              <Text style={{ color: c.text, fontSize: 10 }}>
                {'TEMPLATE: A paragraph describing what this package does, what problem it solves, and when a developer should reach for it. Keep it to 2-3 sentences.'}
              </Text>
            </Box>
          }
          right={
            <Text style={{ color: c.muted, fontSize: 9 }}>{'[CodeBlock placeholder]'}</Text>
          }
        />

        <BandDivider />

        {/* ── Band 2: Primary API (artifact-left, text-right) ── */}
        <Band
          left={
            <ArtifactCard>
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'PRIMARY HOOK'}</Text>
              <Text style={{ color: c.text, fontSize: 11, fontWeight: 'bold' }}>{'usePackageHook()'}</Text>
              <Text style={{ color: c.muted, fontSize: 9 }}>{'[CodeBlock placeholder]'}</Text>
            </ArtifactCard>
          }
          right={
            <Box style={{ gap: 6 }}>
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'API'}</Text>
              <Text style={{ color: c.text, fontSize: 10 }}>
                {'TEMPLATE: Describe the primary hook or function this package exports. What does it return? What are the key options?'}
              </Text>
              <Box style={{ gap: 2, paddingTop: 4 }}>
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'RETURNS'}</Text>
                <Box style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9 }}>{'data'}</Text>
                  <Text style={{ color: c.muted, fontSize: 9 }}>{'T | null'}</Text>
                </Box>
                <Box style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9 }}>{'loading'}</Text>
                  <Text style={{ color: c.muted, fontSize: 9 }}>{'boolean'}</Text>
                </Box>
                <Box style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9 }}>{'error'}</Text>
                  <Text style={{ color: c.muted, fontSize: 9 }}>{'string | null'}</Text>
                </Box>
              </Box>
            </Box>
          }
        />

        <BandDivider />

        {/* ── Band 3: Usage pattern (text-left, code-right) ── */}
        <Band
          left={
            <Box style={{ gap: 6 }}>
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'USAGE PATTERN'}</Text>
              <Text style={{ color: c.text, fontSize: 10 }}>
                {'TEMPLATE: Walk through a typical usage scenario. How does a developer wire this into their app? What are the common patterns?'}
              </Text>
              <Text style={{ color: c.text, fontSize: 10 }}>
                {'TEMPLATE: Second paragraph covering edge cases, error handling, or cleanup behavior.'}
              </Text>
            </Box>
          }
          right={
            <Text style={{ color: c.muted, fontSize: 9 }}>{'[CodeBlock placeholder]'}</Text>
          }
        />

        <BandDivider />

        {/* ── Band 4: Components / Platform (artifact-left, text-right) ── */}
        <Band
          left={
            <ArtifactCard>
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'COMPONENTS'}</Text>
              <Box style={{ gap: 4, paddingTop: 2 }}>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                  <Text style={{ color: c.text, fontSize: 10 }}>{'<PackageComponent />'}</Text>
                </Box>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                  <Text style={{ color: c.text, fontSize: 10 }}>{'<AnotherComponent />'}</Text>
                </Box>
              </Box>
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', paddingTop: 6 }}>{'PLATFORMS'}</Text>
              <Box style={{ flexDirection: 'row', gap: 4, paddingTop: 2 }}>
                <Box style={{ backgroundColor: c.border, borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
                  <Text style={{ color: c.text, fontSize: 8 }}>{'Love2D'}</Text>
                </Box>
                <Box style={{ backgroundColor: c.border, borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
                  <Text style={{ color: c.text, fontSize: 8 }}>{'WASM'}</Text>
                </Box>
              </Box>
            </ArtifactCard>
          }
          right={
            <Box style={{ gap: 6 }}>
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'NOTES'}</Text>
              <Text style={{ color: c.text, fontSize: 10 }}>
                {'TEMPLATE: If this package exports React components, list them here with a brief note. These link to their own Layout 1 stories for full docs.'}
              </Text>
              <Text style={{ color: c.text, fontSize: 10 }}>
                {'TEMPLATE: If this package is hooks-only, replace the components card with additional API signatures or configuration options.'}
              </Text>
              <Text style={{ color: c.text, fontSize: 10 }}>
                {'TEMPLATE: Platform availability — which targets support this package and any target-specific behavior differences.'}
              </Text>
            </Box>
          }
        />

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
        <Text style={{ color: c.text, fontSize: 9 }}>{'Package'}</Text>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
