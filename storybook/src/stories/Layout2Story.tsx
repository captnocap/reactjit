/**
 * Layout 2 — Package/hook documentation page template.
 *
 * Zigzag narrative: bands alternate sides so the eye sweeps back and forth
 * down the page. Code blocks sit next to their explanations, multi-line
 * is fine now that CodeBlock does fit-content sizing.
 *
 * Band rhythm:
 *   hero        — full bleed title card with accent stripe
 *   text | code — explanation left, snippet right
 *   code | text — snippet left, explanation right (zigzag)
 *   callout     — full-width highlighted insight
 *   repeat...
 *
 * TEMPLATE: All content below is placeholder.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

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

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
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

        {/* ── Hero band: accent stripe + overview ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Manage package state without the ceremony.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'usePackage gives you a reactive [state, actions] tuple — loading, error, and data tracking built in. Wrap once with a provider, subscribe from anywhere.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band: text left | code right ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'flex-start',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Import the hook and the provider. The provider enables caching and manages the package registry.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band: code left | text right (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'flex-start',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={PROVIDER_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="layers">{'PROVIDER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Wrap your app once at the root. Config options control caching, TTL, and error boundaries.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Callout band ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'The hook is reactive — your component re-renders automatically when the package state changes. No manual subscriptions.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band: text left | code right ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'flex-start',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="code">{'BASIC USAGE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Destructure state for loading, error, and data. The hook handles the lifecycle — you just read.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={BASIC_CODE} />
        </Box>

        <Divider />

        {/* ── Band: code left | text right (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'flex-start',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={ACTIONS_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="zap">{'ACTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The second element in the tuple. Set, merge, reset, or subscribe to changes imperatively.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band: text left | code right ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 24,
          alignItems: 'flex-start',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="settings">{'OPTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Second argument configures caching, TTL, stale-while-revalidate, and error callbacks.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={OPTIONS_CODE} />
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
