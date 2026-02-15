import React, { useState, useMemo } from 'react';
import { BridgeProvider, RendererProvider } from '../../../packages/shared/src/context';
import { stories, type StoryDef } from './stories';
import { StoryBridge } from './StoryBridge';
import { DocsViewer } from './docs/DocsViewer';
import contentData from './generated/content.json';

function groupByCategory(list: StoryDef[]): Map<string, StoryDef[]> {
  const map = new Map<string, StoryDef[]>();
  for (const s of list) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category)!.push(s);
  }
  return map;
}

function getInitialStory(): string {
  const hash = window.location.hash.replace('#', '');
  if (hash && stories.find(s => s.id === hash)) return hash;
  return stories[0]?.id ?? '';
}

function getInitialMode(): 'stories' | 'docs' {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'docs') return 'docs';
  return 'stories';
}

export function App() {
  const [mode, setMode] = useState<'stories' | 'docs'>(getInitialMode);
  const [activeId, setActiveId] = useState(getInitialStory);
  const groups = useMemo(() => groupByCategory(stories), []);
  const activeStory = stories.find(s => s.id === activeId);
  const StoryComponent = activeStory?.component;

  const [webBridge] = useState(() => new StoryBridge());

  const selectStory = (id: string) => {
    setActiveId(id);
    window.location.hash = id;
  };

  const switchMode = (m: 'stories' | 'docs') => {
    setMode(m);
    if (m === 'docs') window.location.hash = 'docs';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: '#e2e8f0' }}>
      {/* Mode toggle bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '4px 8px',
        backgroundColor: '#0c0c14',
        borderBottom: '1px solid #1e293b',
        flexShrink: 0,
      }}>
        <button
          onClick={() => switchMode('stories')}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            color: mode === 'stories' ? '#e2e8f0' : '#64748b',
            backgroundColor: mode === 'stories' ? '#1e293b' : 'transparent',
          }}
        >
          Stories
        </button>
        <button
          onClick={() => switchMode('docs')}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            color: mode === 'docs' ? '#e2e8f0' : '#64748b',
            backgroundColor: mode === 'docs' ? '#1e293b' : 'transparent',
          }}
        >
          Docs
        </button>
      </div>

      {/* Content */}
      {mode === 'docs' ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <BridgeProvider bridge={webBridge}>
            <RendererProvider mode="web">
              <DocsViewer content={contentData as any} />
            </RendererProvider>
          </BridgeProvider>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Sidebar */}
          <nav style={{
            width: 200, borderRight: '1px solid #1e293b', backgroundColor: '#0c0c14',
            overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px 16px 12px', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid #1e293b',
            }}>
              REACT-LOVE
            </div>

            <div style={{ flex: 1, paddingTop: 8 }}>
              {Array.from(groups.entries()).map(([category, list]) => (
                <div key={category} style={{ marginBottom: 8 }}>
                  <div style={{
                    padding: '8px 16px 4px', fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.1em', color: '#334155', textTransform: 'uppercase',
                  }}>
                    {category}
                  </div>
                  {list.map(s => (
                    <div
                      key={s.id}
                      onClick={() => selectStory(s.id)}
                      style={{
                        padding: '5px 16px 5px 20px',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: s.id === activeId ? '#e2e8f0' : '#64748b',
                        backgroundColor: s.id === activeId ? '#1e293b' : 'transparent',
                        borderLeft: s.id === activeId ? '2px solid #3b82f6' : '2px solid transparent',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { if (s.id !== activeId) (e.currentTarget.style.color = '#94a3b8'); }}
                      onMouseLeave={e => { if (s.id !== activeId) (e.currentTarget.style.color = '#64748b'); }}
                    >
                      {s.title}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          {/* Main area */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#08080f', minWidth: 0 }}>
            {/* Header */}
            <header style={{
              padding: '8px 16px',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                {activeStory?.title}
              </span>
              <span style={{ fontSize: 10, color: '#334155' }}>
                {activeStory?.category}
              </span>
            </header>

            {/* Split panels */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Web panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b', minWidth: 0 }}>
                <div style={{
                  padding: '4px 12px', fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.1em', color: '#334155',
                  borderBottom: '1px solid #111827',
                  backgroundColor: '#0a0a12',
                }}>
                  WEB (DOM)
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                  {StoryComponent && (
                    <BridgeProvider bridge={webBridge}>
                      <RendererProvider mode="web">
                        <StoryComponent key={activeId} />
                      </RendererProvider>
                    </BridgeProvider>
                  )}
                </div>
              </div>

              {/* Native panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{
                  padding: '4px 12px', fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.1em', color: '#334155',
                  borderBottom: '1px solid #111827',
                  backgroundColor: '#0a0a12',
                }}>
                  NATIVE (Love2D)
                </div>
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1e293b', fontSize: 12,
                }}>
                  <div style={{ textAlign: 'center', maxWidth: 240 }}>
                    <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>&#9654;</div>
                    <div style={{ color: '#334155', lineHeight: 1.5 }}>
                      Native panel requires Love2D WASM build.
                      <br />
                      <span style={{ fontSize: 10, color: '#1e293b' }}>
                        See Phase 3 in the plan.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
