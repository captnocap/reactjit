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
import { Box, Text, Image, ScrollView, CodeBlock, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn} from './_shared/StoryScaffold';

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
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="package" tintColor={C.accent} />
        <S.StoryTitle>
          {'usePackage'}
        </S.StoryTitle>
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
        <S.StoryMuted>
          {'Reactive state hooks for package integration'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'Manage package state without the ceremony.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'usePackage gives you a reactive [state, actions] tuple — loading, error, and data tracking built in. Wrap once with a provider, subscribe from anywhere.'}
          </S.StoryMuted>
        </HeroBand>

        <Divider />

        {/* ── text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Import the hook and the provider. The provider enables caching and manages the package registry.'}
            </S.StoryBody>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — PROVIDER (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={PROVIDER_CODE} />
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'PROVIDER'}</SectionLabel>
            <S.StoryBody>
              {'Wrap your app once at the root. Config options control caching, TTL, and error boundaries.'}
            </S.StoryBody>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'The hook is reactive — your component re-renders automatically when the package state changes. No manual subscriptions.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── text | code — BASIC USAGE ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.accent}>{'BASIC USAGE'}</SectionLabel>
            <S.StoryBody>
              {'Destructure state for loading, error, and data. The hook handles the lifecycle — you just read.'}
            </S.StoryBody>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={BASIC_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — ACTIONS (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={ACTIONS_CODE} />
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'ACTIONS'}</SectionLabel>
            <S.StoryBody>
              {'The second element in the tuple. Set, merge, reset, or subscribe to changes imperatively.'}
            </S.StoryBody>
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — OPTIONS ── */}
        <Band>
          <Half>
            <SectionLabel icon="settings" accentColor={C.accent}>{'OPTIONS'}</SectionLabel>
            <S.StoryBody>
              {'Second argument configures caching, TTL, stale-while-revalidate, and error callbacks.'}
            </S.StoryBody>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={OPTIONS_CODE} />
        </Band>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="package" />
        <S.StoryBreadcrumbActive>{'usePackage'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
