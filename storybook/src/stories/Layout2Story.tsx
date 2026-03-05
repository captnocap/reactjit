/**
 * Layout 2 — Package/hook documentation page template.
 *
 * Zigzag narrative: bands alternate sides so the eye sweeps back and forth
 * down the page. Code blocks sit next to their explanations.
 *
 * Uses Band/Half/HeroBand/CalloutBand/Divider/SectionLabel from StoryScaffold.
 * Those components enforce alignment — both columns always start at (0,0).
 *
 * TEMPLATE: All content below is placeholder.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { usePackage } from '@reactjit/package'
import { PackageProvider } from '@reactjit/package'`;

const PROVIDER_CODE = `<PackageProvider config={{ cache: true, ttl: 5000 }}>
  <App />
</PackageProvider>`;

const BASIC_CODE = `const [state, actions] = usePackage('user-prefs')

// Reactive — re-renders when data changes
if (state.loading) return <Spinner />
if (state.error)   return <Error msg={state.error} />

return <Settings data={state.data} />`;

const ACTIONS_CODE = `actions.set({ theme: 'dark' })    // replace
actions.merge({ fontSize: 14 })    // shallow merge
actions.reset()                    // clear to default
actions.subscribe(fn)              // listen to changes`;

const OPTIONS_CODE = `const [state] = usePackage('analytics', {
  ttl: 30000,           // cache for 30s
  staleWhileRevalidate: true,
  onError: (e) => log(e),
})`;

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
        <Image src="package" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'usePackage'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/package'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Reactive state hooks for package integration'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Manage package state without the ceremony.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'usePackage gives you a reactive [state, actions] tuple — loading, error, and data tracking built in. Wrap once with a provider, subscribe from anywhere.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Import the hook and the provider. The provider enables caching and manages the package registry.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — PROVIDER (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={PROVIDER_CODE} />
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'PROVIDER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Wrap your app once at the root. Config options control caching, TTL, and error boundaries.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'The hook is reactive — your component re-renders automatically when the package state changes. No manual subscriptions.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── text | code — BASIC USAGE ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.accent}>{'BASIC USAGE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Destructure state for loading, error, and data. The hook handles the lifecycle — you just read.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={BASIC_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — ACTIONS (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={ACTIONS_CODE} />
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'ACTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The second element in the tuple. Set, merge, reset, or subscribe to changes imperatively.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — OPTIONS ── */}
        <Band>
          <Half>
            <SectionLabel icon="settings" accentColor={C.accent}>{'OPTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Second argument configures caching, TTL, stale-while-revalidate, and error callbacks.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={OPTIONS_CODE} />
        </Band>

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
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="package" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'usePackage'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
