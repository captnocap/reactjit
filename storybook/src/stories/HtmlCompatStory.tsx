/**
 * HtmlCompatStory — HTML element remapping demo
 *
 * Proves that standard HTML JSX (<div>, <span>, <h1>, <img>, <button>, etc.)
 * renders correctly in ReactJIT. Combined with the Tailwind parser,
 * someone can paste a React+Tailwind component verbatim and it works.
 */

import React, { useState } from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

// ── Helpers ─────────────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  const c = useThemeColors();
  return (
    <Text style={{ color: c.muted, fontSize: 9, width: '100%', textAlign: 'left' }}>
      {children}
    </Text>
  );
}

// ── Story ───────────────────────────────────────────────────────────

export function HtmlCompatStory() {
  const c = useThemeColors();
  const [clicks, setClicks] = useState(0);

  return (
    <StoryPage>
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'HTML Compat'}
      </Text>
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'Standard HTML elements remap to ReactJIT primitives. Paste React JSX and it renders.'}
      </Text>

      {/* 1. Basic div + span */}
      <StorySection index={1} title="div + span">
        <Label>{'<div> → View, <span> → Text'}</Label>
        <div className="p-4 bg-gray-800 rounded-lg w-full">
          <span className="text-white text-sm">{'This is a <span> inside a <div>'}</span>
        </div>
      </StorySection>

      {/* 2. Headings */}
      <StorySection index={2} title="Headings">
        <Label>{'h1-h6 auto-sized with bold'}</Label>
        <div className="p-4 bg-gray-800 rounded-lg w-full gap-2">
          <h1 style={{ color: '#FFFFFF' }}>{'h1 — 32px'}</h1>
          <h2 style={{ color: '#CCCCCC' }}>{'h2 — 28px'}</h2>
          <h3 style={{ color: '#AAAAAA' }}>{'h3 — 24px'}</h3>
          <h4 style={{ color: '#888888' }}>{'h4 — 20px'}</h4>
          <h5 style={{ color: '#666666' }}>{'h5 — 18px'}</h5>
          <h6 style={{ color: '#555555' }}>{'h6 — 16px'}</h6>
        </div>
      </StorySection>

      {/* 3. Semantic elements */}
      <StorySection index={3} title="Semantic HTML">
        <Label>{'section, nav, header, footer, article → View'}</Label>
        <section className="p-3 bg-gray-800 rounded-lg w-full gap-2">
          <header className="p-2 bg-blue-900 rounded">
            <span className="text-white text-xs">{'<header>'}</span>
          </header>
          <nav className="p-2 bg-green-900 rounded">
            <span className="text-white text-xs">{'<nav>'}</span>
          </nav>
          <article className="p-2 bg-purple-900 rounded">
            <span className="text-white text-xs">{'<article>'}</span>
          </article>
          <footer className="p-2 bg-red-900 rounded">
            <span className="text-white text-xs">{'<footer>'}</span>
          </footer>
        </section>
      </StorySection>

      {/* 4. Inline text styling */}
      <StorySection index={4} title="Inline Text">
        <Label>{'strong/b → bold, em/i → italic (via style)'}</Label>
        <div className="p-4 bg-gray-800 rounded-lg w-full gap-1">
          <strong style={{ color: '#FFFFFF' }}>{'<strong> bold text'}</strong>
          <b style={{ color: '#CCCCCC' }}>{'<b> also bold'}</b>
          <em style={{ color: '#AAAAAA', fontStyle: 'italic' }}>{'<em> italic text'}</em>
          <code style={{ color: '#22D3EE' }}>{'<code> monospace'}</code>
          <small style={{ color: '#888888', fontSize: 10 }}>{'<small> small text'}</small>
        </div>
      </StorySection>

      {/* 5. Button with onClick */}
      <StorySection index={5} title="Button">
        <Label>{'<button onClick={fn}> fires handler'}</Label>
        <div className="p-4 bg-gray-800 rounded-lg w-full flex-row gap-3 items-center">
          <button className="px-4 py-2 bg-blue-500 rounded-lg" onClick={() => setClicks(n => n + 1)}>
            <span className="text-white text-sm font-bold">{'Click me'}</span>
          </button>
          <span className="text-white text-sm">{`Clicks: ${clicks}`}</span>
        </div>
      </StorySection>

      {/* 6. Lists */}
      <StorySection index={6} title="Lists">
        <Label>{'ul, ol, li → View (layout containers)'}</Label>
        <div className="p-4 bg-gray-800 rounded-lg w-full flex-row gap-8">
          <ul className="gap-1">
            <li className="flex-row gap-2">
              <span className="text-gray-400 text-xs">{'•'}</span>
              <span className="text-white text-xs">{'First item'}</span>
            </li>
            <li className="flex-row gap-2">
              <span className="text-gray-400 text-xs">{'•'}</span>
              <span className="text-white text-xs">{'Second item'}</span>
            </li>
            <li className="flex-row gap-2">
              <span className="text-gray-400 text-xs">{'•'}</span>
              <span className="text-white text-xs">{'Third item'}</span>
            </li>
          </ul>
          <ol className="gap-1">
            <li className="flex-row gap-2">
              <span className="text-gray-400 text-xs">{'1.'}</span>
              <span className="text-white text-xs">{'Ordered one'}</span>
            </li>
            <li className="flex-row gap-2">
              <span className="text-gray-400 text-xs">{'2.'}</span>
              <span className="text-white text-xs">{'Ordered two'}</span>
            </li>
          </ol>
        </div>
      </StorySection>

      {/* 7. Table */}
      <StorySection index={7} title="Table">
        <Label>{'table, tr, td, th → View (flex rows/cols)'}</Label>
        <table className="p-4 bg-gray-800 rounded-lg w-full gap-1">
          <thead>
            <tr className="flex-row gap-4">
              <th style={{ color: '#3B82F6', fontSize: 10, fontWeight: 'bold', minWidth: 80 }}>{'Name'}</th>
              <th style={{ color: '#3B82F6', fontSize: 10, fontWeight: 'bold', minWidth: 80 }}>{'Role'}</th>
              <th style={{ color: '#3B82F6', fontSize: 10, fontWeight: 'bold', minWidth: 80 }}>{'Status'}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="flex-row gap-4">
              <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 80 }}>{'Alice'}</td>
              <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 80 }}>{'Engineer'}</td>
              <td style={{ color: '#22C55E', fontSize: 10, minWidth: 80 }}>{'Active'}</td>
            </tr>
            <tr className="flex-row gap-4">
              <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 80 }}>{'Bob'}</td>
              <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 80 }}>{'Designer'}</td>
              <td style={{ color: '#EAB308', fontSize: 10, minWidth: 80 }}>{'Away'}</td>
            </tr>
          </tbody>
        </table>
      </StorySection>

      {/* 8. Tailwind + HTML combined */}
      <StorySection index={8} title="Tailwind on HTML">
        <Label>{'Full Tailwind classes on native HTML elements'}</Label>
        <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl w-full gap-2">
          <h3 style={{ color: '#FFFFFF' }}>{'Gradient Card'}</h3>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
            {'Built with <div className="bg-gradient-to-r from-blue-500 to-purple-500">'}
          </p>
          <div className="flex-row gap-2 mt-2">
            <div className="px-3 py-1 bg-white/20 rounded-full">
              <span className="text-white text-xs">{'Tag 1'}</span>
            </div>
            <div className="px-3 py-1 bg-white/20 rounded-full">
              <span className="text-white text-xs">{'Tag 2'}</span>
            </div>
          </div>
        </div>
      </StorySection>

      {/* 9. Copy-paste proof — a real React card component */}
      <StorySection index={9} title="Copy-Paste Proof">
        <Label>{'A real React+Tailwind card, pasted verbatim'}</Label>
        <div className="p-4 bg-gray-900 rounded-xl w-full">
          <div className="flex-row gap-4 items-center">
            <div className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center">
              <span className="text-white font-bold text-lg">{'JD'}</span>
            </div>
            <div className="gap-1">
              <h4 style={{ color: '#FFFFFF' }}>{'Jane Doe'}</h4>
              <p style={{ color: '#9CA3AF', fontSize: 11 }}>{'Senior Engineer at Acme Corp'}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700 gap-2">
            <div className="flex-row justify-between">
              <span className="text-gray-400 text-xs">{'Projects'}</span>
              <span className="text-white text-xs font-bold">{'24'}</span>
            </div>
            <div className="flex-row justify-between">
              <span className="text-gray-400 text-xs">{'Commits'}</span>
              <span className="text-white text-xs font-bold">{'1,847'}</span>
            </div>
            <div className="flex-row justify-between">
              <span className="text-gray-400 text-xs">{'Reviews'}</span>
              <span className="text-white text-xs font-bold">{'392'}</span>
            </div>
          </div>
        </div>
      </StorySection>

      {/* 10. Form elements */}
      <StorySection index={10} title="Form Elements">
        <Label>{'<input> → TextInput, <form> → View, <button> → View'}</Label>
        <form className="p-4 bg-gray-800 rounded-lg w-full gap-3">
          <div className="gap-1">
            <label style={{ color: '#9CA3AF', fontSize: 10 }}>{'Email'}</label>
            <input placeholder="you@example.com" style={{ fontSize: 12 }} />
          </div>
          <div className="gap-1">
            <label style={{ color: '#9CA3AF', fontSize: 10 }}>{'Message'}</label>
            <textarea placeholder="Write something..." style={{ fontSize: 12 }} />
          </div>
          <button className="px-4 py-2 bg-green-500 rounded-lg items-center">
            <span className="text-white text-sm font-bold">{'Submit'}</span>
          </button>
        </form>
      </StorySection>
    </StoryPage>
  );
}
