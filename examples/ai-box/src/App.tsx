import React, { useState, useRef, useMemo } from 'react';
import { Box, Text, Pressable, TextEditor } from '@ilovereact/core';
import { evalComponent } from './lib/eval-component';

// LAYOUT RULE: Section A is ALWAYS the chat canvas (user ↔ AI conversation).
// A has the most space in every layout by design — it is the primary surface.
// Every layout must keep A as the largest or dominant cell. Never reassign A.
// Sections B-G are AI-controlled hot-loadable surfaces. The AI pushes JSX
// code strings to them by section ID and they eval + render live.

type LayoutMode = 'A' | 'AB' | 'ABC' | 'ABCD' | 'ABCDE' | 'ABCDEF' | 'ABCDEFG';
type SectionId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
type SectionCode = Partial<Record<SectionId, string>>;

const LAYOUTS: LayoutMode[] = ['A', 'AB', 'ABC', 'ABCD', 'ABCDE', 'ABCDEF', 'ABCDEFG'];

const SECTION_COLORS: Record<SectionId, string> = {
  A: '#1a1a2e',
  B: '#1a2e1a',
  C: '#2e1a1a',
  D: '#2e2a1a',
  E: '#1a2a2e',
  F: '#2a1a2e',
  G: '#2e1a2a',
};

// ── Error boundary ────────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: any },
  { hasError: boolean; message: string }
> {
  constructor(props: any) { super(props); this.state = { hasError: false, message: '' }; }
  static getDerivedStateFromError(e: any) { return { hasError: true, message: e?.message || String(e) }; }
  componentDidUpdate(prev: any) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }
  render() {
    if (this.state.hasError) return (
      <Box style={{ padding: 10 }}>
        <Text style={{ fontSize: 9, color: '#ff4466' }}>{this.state.message}</Text>
      </Box>
    );
    return this.props.children;
  }
}

// ── Section panel ─────────────────────────────────────────────────────────────

function Section({ id, code }: { id: SectionId; code?: string }) {
  const result = useMemo(() => code ? evalComponent(code) : null, [code]);
  const UserComponent = result?.component ?? null;

  return (
    <Box style={{ flexGrow: 1, backgroundColor: SECTION_COLORS[id], borderRadius: 4 }}>
      {/* Section label — visible when empty */}
      {!UserComponent && (
        <Box style={{ position: 'absolute', top: 6, left: 8 }}>
          <Text style={{ fontSize: 9, color: '#ffffff22', fontWeight: 'bold' }}>{id}</Text>
        </Box>
      )}

      {/* Eval error */}
      {result?.error && (
        <Box style={{ padding: 8 }}>
          <Text style={{ fontSize: 8, color: '#ff4466' }}>{result.error}</Text>
        </Box>
      )}

      {/* Live rendered component */}
      {UserComponent && (
        <ErrorBoundary resetKey={UserComponent}>
          <UserComponent />
        </ErrorBoundary>
      )}
    </Box>
  );
}

// ── Bento layouts ─────────────────────────────────────────────────────────────

function MiddleRow({ layout, code }: { layout: LayoutMode; code: SectionCode }) {
  const s = (id: SectionId) => <Section id={id} code={code[id]} />;
  const row = (children: React.ReactNode) => (
    <Box style={{ flexGrow: 1, flexDirection: 'row', gap: 5 }}>{children}</Box>
  );
  const col = (grow: number, children: React.ReactNode) => (
    <Box style={{ flexGrow: grow, flexDirection: 'column', gap: 5 }}>{children}</Box>
  );

  const wrap = (children: React.ReactNode) => (
    <Box style={{ flexGrow: 3, padding: 5, gap: 5, flexDirection: 'column' }}>
      {children}
    </Box>
  );

  switch (layout) {
    case 'A':
      return wrap(s('A'));

    case 'AB':
      // A hero left, B narrow right
      return wrap(row(<>{col(3, s('A'))}{col(1, s('B'))}</>));

    case 'ABC':
      // Single row: A wide, B medium, C narrow
      return wrap(
        row(
          <>
            <Box style={{ flexGrow: 3 }}>{s('A')}</Box>
            <Box style={{ flexGrow: 2 }}>{s('B')}</Box>
            <Box style={{ flexGrow: 1 }}>{s('C')}</Box>
          </>
        )
      );

    case 'ABCD':
      // A hero tall left | B wide top-right, C+D bottom-right
      return wrap(
        row(
          <>
            {col(2, s('A'))}
            {col(3, <>{s('B')}{row(<>{s('C')}{s('D')}</>)}</>)}
          </>
        )
      );

    case 'ABCDE':
      // A+B top (A wider) | C+D+E bottom equal
      return wrap(
        <>
          <Box style={{ flexGrow: 2, flexDirection: 'row', gap: 5 }}>
            <Box style={{ flexGrow: 3 }}>{s('A')}</Box>
            <Box style={{ flexGrow: 1 }}>{s('B')}</Box>
          </Box>
          {row(<>{s('C')}{s('D')}{s('E')}</>)}
        </>
      );

    case 'ABCDEF':
      // A hero top-left | B+C top-right stacked | D+E+F bottom (F wide)
      return wrap(
        <>
          <Box style={{ flexGrow: 2, flexDirection: 'row', gap: 5 }}>
            {col(2, s('A'))}
            {col(1, <>{s('B')}{s('C')}</>)}
          </Box>
          {row(<>{s('D')}{s('E')}<Box style={{ flexGrow: 2 }}>{s('F')}</Box></>)}
        </>
      );

    case 'ABCDEFG':
      // A mega hero left | B+C+D top-right | E+F+G bottom spanning
      return wrap(
        <>
          <Box style={{ flexGrow: 2, flexDirection: 'row', gap: 5 }}>
            {col(2, s('A'))}
            {col(3, row(<>{s('B')}{s('C')}{s('D')}</>))}
          </Box>
          {row(<>{s('E')}{s('F')}{s('G')}</>)}
        </>
      );
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  const [layout, setLayout] = useState<LayoutMode>('ABCD');
  const [code] = useState<SectionCode>({});
  const [input, setInput] = useState('');
  const inputRef = useRef(input);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0f', flexDirection: 'column' }}>

      {/* Top row */}
      <Box style={{ flexGrow: 2, flexDirection: 'row', padding: 5, gap: 5 }}>
        <Box style={{ height: '100%', aspectRatio: 1, backgroundColor: '#ff4466' }} />
        <Box style={{ flexGrow: 1, height: '100%', backgroundColor: '#44ff88' }} />
        <Box style={{ height: '100%', aspectRatio: 1, backgroundColor: '#4488ff' }} />
      </Box>

      {/* Middle row — AI bento canvas */}
      <MiddleRow layout={layout} code={code} />

      {/* Bottom row — mirrors top row: [left box] [input] [right box] */}
      <Box style={{ flexGrow: 1, flexDirection: 'row', padding: 5, gap: 5 }}>

        {/* Left chrome — empty UI element */}
        <Box style={{ height: '100%', aspectRatio: 1, backgroundColor: '#0d0d18', borderRadius: 4 }} />

        {/* Center — two rows: input on top, buttons on bottom */}
        <Box style={{ flexGrow: 1, height: '100%', flexDirection: 'column', gap: 5, paddingTop: 5, paddingBottom: 5 }}>

          {/* Input row */}
          <Box style={{ flexGrow: 1 }}>
            <TextEditor
              value={input}
              onChange={(v: string) => { setInput(v); inputRef.current = v; }}
              placeholder="Message the AI..."
              lineNumbers={false}
              style={{
                flexGrow: 1, height: '100%', fontSize: 14, color: '#cdd6f4',
                backgroundColor: '#0d0d18',
                borderRadius: 8, borderWidth: 1, borderColor: '#1e1e3a',
              }}
            />
          </Box>

          {/* Button row */}
          <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Box style={{ flexDirection: 'row', gap: 4 }}>
              {LAYOUTS.map(l => (
                <Pressable key={l} onPress={() => setLayout(l)} style={() => ({
                  backgroundColor: layout === l ? '#4488ff22' : 'transparent',
                  borderWidth: 1,
                  borderColor: layout === l ? '#4488ff' : '#1a1a2e',
                  paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
                  borderRadius: 3,
                })}>
                  <Text style={{ fontSize: 8, color: layout === l ? '#4488ff' : '#333355' }}>{l}</Text>
                </Pressable>
              ))}
            </Box>
            <Pressable
              onPress={() => setInput('')}
              style={(s) => ({
                backgroundColor: s.pressed ? '#3366cc' : '#4488ff',
                paddingLeft: 16, paddingRight: 16, paddingTop: 3, paddingBottom: 3,
                borderRadius: 3,
              })}
            >
              <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 'bold' }}>Send</Text>
            </Pressable>
          </Box>

        </Box>

        {/* Right chrome — empty UI element */}
        <Box style={{ height: '100%', aspectRatio: 1, backgroundColor: '#0d0d18', borderRadius: 4 }} />

      </Box>

    </Box>
  );
}
