/**
 * ClaudeCanvas — Claude Code terminal canvas.
 *
 * The visual, hittable PTY canvas that runs Claude Code with damage-driven
 * rendering, semantic classification, scroll, and session chrome.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, ScrollView, CodeBlock, Pressable, TextInput, Native, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { ClaudeCanvas } from '../../../packages/terminal/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// -- Palette ----------------------------------------------------------

const C = {
  accent: '#c084fc',
  accentDim: 'rgba(192, 132, 252, 0.12)',
  callout: 'rgba(192, 132, 252, 0.06)',
  calloutBorder: 'rgba(192, 132, 252, 0.3)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  teal: '#94e2d5',
  peach: '#fab387',
  orange: '#fab387',
  canvasBg: 'rgb(13, 13, 26)',
  canvasBorder: 'rgba(64, 64, 89, 0.8)',
  dimText: 'rgba(140, 148, 166, 0.6)',
};

// -- Static code blocks (hoisted) -------------------------------------

const INSTALL_CODE = `import { ClaudeCanvas } from '@reactjit/terminal'
import { useClaude, useSessionChrome } from '@reactjit/terminal'`;

const ONELINER_CODE = `// That's it. One line. Full Claude Code session.
<ClaudeCanvas sessionId="default" style={{ flexGrow: 1 }} />`;

const CANVAS_PROPS_CODE = `interface ClaudeCanvasProps {
  sessionId?: string;      // PTY session name (default: 'default')
  debugVisible?: boolean;  // Show debug overlay
  style?: Record<string, any>;
}`;

const USECLAUDE_CODE = `const claude = useClaude();

// Wire onto ClaudeCanvas events:
//   onPermissionRequest  -> claude.onPerm
//   onPermissionResolved -> claude.onPermResolved
//   onQuestionPrompt     -> claude.onQuestion
//   onStatusChange       -> claude.onStatusChange

// State:
claude.perm         // { action, target, question } | null
claude.question     // { question, options[] } | null
claude.status       // 'idle' | 'streaming' | 'thinking' | ...
claude.autoAccept   // boolean

// Actions:
claude.respond(0)          // accept permission
claude.respond(1)          // deny permission
claude.respondQuestion(2)  // pick option index
claude.toggleAutoAccept()  // toggle auto-accept`;

const SESSION_CHROME_CODE = `const {
  statusLeft,      // e.g. "Claude Opus 4.6"
  statusRight,     // e.g. "12,345 tokens  ·  $0.42"
  placeholder,     // e.g. "Message Claude..."
  promptText,      // current input text (from classified tokens)
  cursorPosition,  // character offset into promptText
} = useSessionChrome('default');

// Wire into an Input:
<Input
  value={promptText}
  cursorPosition={cursorPosition}
  placeholder={placeholder}
  keystrokeTarget="ClaudeCanvas"
  submitTarget="ClaudeCanvas"
/>`;

const PROXY_RULE_CODE = `// The Proxy Input Rule:
//
// 1. ClaudeCanvas (PTY/vterm) is the SINGLE SOURCE OF TRUTH
//    for all text state.
//
// 2. The semantic classifier scrapes the vterm grid every frame
//    into classified tokens.
//
// 3. useSessionChrome() polls claude:classified RPC and returns
//    promptText, cursorPosition, statusLeft, statusRight.
//
// 4. The input bar displays promptText. It does NOT manage its
//    own text buffer. It forwards keystrokes to ClaudeCanvas.
//
// 5. Two separate concerns:
//    - Display: reads from classified tokens
//    - Input: forwards keystrokes to canvas target`;

const CLASSIFICATION_CODE = `-- lua/classifiers/claude_code.lua
-- Each vterm row is classified into a token type:
--
--   prompt         User input line
--   thinking       "Thinking..." indicator
--   tool_header    Tool name + action
--   tool_body      Tool content (code, paths)
--   result         Tool execution result
--   diff_add       Added line in diff
--   diff_remove    Removed line in diff
--   permission     Permission request
--   status_bar     Bottom status line
--   input_zone     Active input area
--   assistant      Claude's response text
--   empty          Blank line`;

const PIPELINE_CODE = `-- Claude Canvas pipeline:
--
-- Claude CLI (PTY)
--   -> vterm grid (damage callbacks)
--     -> row classification (claude_code.lua)
--       -> semantic graph building (claude_graph.lua)
--         -> diff computation (stable identity)
--           -> block renderer (claude_renderer.lua)
--             -> canvas paint (love.graphics)
--
-- Everything is Lua. React only declares the canvas node.`;

const STATE_MACHINE_CODE = `-- claude_session.lua state machine:
--
-- Idle       -> user is at the prompt
-- Streaming  -> Claude is generating a response
-- Thinking   -> "Thinking..." phase before response
-- PermGate   -> waiting for user to accept/deny a tool
-- Splash     -> initial Claude Code splash screen
--
-- Transitions are detected by the classifier scanning
-- vterm rows for known patterns.`;

// -- Token Type Catalog -----------------------------------------------

const TOKEN_TYPES = [
  { label: 'prompt', desc: 'User input line', color: C.green },
  { label: 'thinking', desc: '"Thinking..." indicator', color: C.yellow },
  { label: 'assistant', desc: "Claude's response text", color: '#cdd6f4' },
  { label: 'tool_header', desc: 'Tool name + action', color: C.blue },
  { label: 'tool_body', desc: 'Tool content (code, paths)', color: C.teal },
  { label: 'result', desc: 'Tool execution result', color: C.mauve },
  { label: 'diff_add', desc: 'Added line in diff', color: C.green },
  { label: 'diff_remove', desc: 'Removed line in diff', color: C.red },
  { label: 'permission', desc: 'Permission request', color: C.orange },
  { label: 'status_bar', desc: 'Bottom status line', color: C.dimText },
  { label: 'input_zone', desc: 'Active input area', color: C.accent },
];

function TokenCatalog() {
  return (
    <S.StackG3W100>
      {TOKEN_TYPES.map(t => (
        <S.RowCenterG8 key={t.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: t.color, width: 80, flexShrink: 0, fontWeight: 'bold' }}>
            {t.label}
          </Text>
          <S.StoryCap>{t.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// -- Fake Canvas Preview (static mockup) ------------------------------

function CanvasPreview() {
  const rows = [
    { kind: 'status_bar', text: 'Claude Opus 4.6                    12,345 tokens', color: C.dimText },
    { kind: 'empty', text: '', color: 'transparent' },
    { kind: 'assistant', text: "  I'll read the file and fix the bug.", color: '#cdd6f4' },
    { kind: 'empty', text: '', color: 'transparent' },
    { kind: 'tool_header', text: '  Read  src/App.tsx', color: C.blue },
    { kind: 'tool_body', text: '    1  import React from "react"', color: C.teal },
    { kind: 'tool_body', text: '    2  export function App() {', color: C.teal },
    { kind: 'tool_body', text: '    3    return <Box>Hello</Box>', color: C.teal },
    { kind: 'empty', text: '', color: 'transparent' },
    { kind: 'diff_add', text: '  + return <Box style={{ padding: 8 }}>Hello</Box>', color: C.green },
    { kind: 'diff_remove', text: '  - return <Box>Hello</Box>', color: C.red },
    { kind: 'empty', text: '', color: 'transparent' },
    { kind: 'prompt', text: '  > _', color: C.green },
  ];

  return (
    <Box style={{
      width: '100%',
      backgroundColor: C.canvasBg,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: C.canvasBorder,
      padding: 8,
      gap: 1,
    }}>
      {rows.map((row, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 6, minHeight: 11 }}>
          <Box style={{
            width: 3,
            backgroundColor: row.kind === 'empty' ? 'transparent' : row.color,
            borderRadius: 1,
            opacity: 0.5,
          }} />
          <Text style={{
            fontSize: 8,
            color: row.color,
            fontFamily: 'monospace',
          }}>
            {row.text}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// -- Session State Preview --------------------------------------------

function StatePreview() {
  const states = [
    { label: 'Idle', desc: 'At the prompt, waiting for user input', color: C.green, active: false },
    { label: 'Thinking', desc: '"Thinking..." phase before response', color: C.yellow, active: false },
    { label: 'Streaming', desc: 'Claude generating a response', color: C.blue, active: true },
    { label: 'PermGate', desc: 'Waiting for tool permission accept/deny', color: C.orange, active: false },
    { label: 'Splash', desc: 'Initial Claude Code splash screen', color: C.dimText, active: false },
  ];

  return (
    <S.StackG3W100>
      {states.map(s => (
        <S.RowCenterG8 key={s.label}>
          <Box style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: s.active ? s.color : 'transparent',
            borderWidth: 1,
            borderColor: s.color,
            flexShrink: 0,
          }} />
          <Text style={{
            fontSize: 9, color: s.color,
            width: 70, flexShrink: 0,
            fontWeight: s.active ? 'bold' : 'normal',
          }}>
            {s.label}
          </Text>
          <S.StoryCap>{s.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// -- ClaudeCanvasStory ------------------------------------------------

export function ClaudeCanvasStory() {
  const c = useThemeColors();
  const [showLive, setShowLive] = useState(false);
  const [workingDir, setWorkingDir] = useState('.');

  return (
    <S.StoryRoot>

      {/* Header */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="terminal" tintColor={C.accent} />
        <S.StoryTitle>{'Claude Canvas'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/terminal'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Claude Code in a React node'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1 }}>
        <PageColumn>

        {/* Hero */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'A full Claude Code session as a single React element. Semantic classification. Damage-driven rendering.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'ClaudeCanvas spawns Claude CLI in an interactive PTY, pipes through vterm for structured grid state, classifies each row into semantic tokens (prompt, thinking, tool, diff, permission...), builds a semantic graph with stable identity, and paints it via a Lua block renderer. React declares one node. Lua does everything else.'}
          </S.StoryMuted>
          <CodeBlock language="tsx" fontSize={8} code={INSTALL_CODE} style={{ width: '100%' }} />
        </HeroBand>

        <Divider />

        {/* Band 1: One-liner | preview */}
        <Band>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'ONE LINER'}</SectionLabel>
            <S.StoryBody>
              {'One element. One prop. Full Claude Code session with semantic rendering, scroll, keyboard input, permission gates, and status chrome. The canvas handles everything — React just declares that it exists.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={ONELINER_CODE} style={{ width: '100%' }} />
            <CodeBlock language="tsx" fontSize={8} code={CANVAS_PROPS_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <CanvasPreview />
          </Half>
        </Band>

        <Divider />

        {/* Band 2: Live canvas toggle */}
        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.green}>{'LIVE CANVAS'}</SectionLabel>
            <S.StoryBody>
              {'Toggle the live canvas to spawn a real Claude Code session. This is the actual ClaudeCanvas component rendering — not a mockup. It connects to your local Claude CLI installation.'}
            </S.StoryBody>
            <Box style={{ width: '100%', gap: 4 }}>
              <Text style={{ fontSize: 9, color: c.muted }}>{'Working directory'}</Text>
              <TextInput
                value={workingDir}
                onChangeText={showLive ? undefined : setWorkingDir}
                editable={!showLive}
                placeholder="/path/to/your/project"
                style={{
                  width: '100%',
                  fontSize: 10,
                  backgroundColor: C.canvasBg,
                  color: showLive ? C.dimText : '#cdd6f4',
                  borderWidth: 1,
                  borderColor: C.canvasBorder,
                  borderRadius: 4,
                  paddingLeft: 8, paddingRight: 8,
                  paddingTop: 5, paddingBottom: 5,
                  opacity: showLive ? 0.5 : 1,
                }}
              />
              <S.StoryCap>
                {'Absolute path to the project Claude will operate in. Defaults to "." (storybook root).'}
              </S.StoryCap>
            </Box>
            <Pressable onPress={() => setShowLive(!showLive)}>
              <Box style={{
                backgroundColor: showLive ? 'rgba(243, 139, 168, 0.15)' : 'rgba(166, 227, 161, 0.15)',
                borderRadius: 6,
                paddingLeft: 12, paddingRight: 12,
                paddingTop: 6, paddingBottom: 6,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 10, color: showLive ? C.red : C.green, fontWeight: 'bold' }}>
                  {showLive ? 'Stop Session' : 'Launch Claude Session'}
                </Text>
              </Box>
            </Pressable>
            <S.StoryCap>
              {'Requires claude CLI on PATH. The PTY spawns on mount and is killed on unmount.'}
            </S.StoryCap>
          </Half>
          <Half>
            {showLive ? (
              <Box style={{ width: '100%', height: 300 }}>
                <Native type="ClaudeCode" sessionId="story-demo" workingDir={workingDir} />
                <ClaudeCanvas sessionId="story-demo" style={{ width: '100%', height: 300, borderRadius: 6 }} />
              </Box>
            ) : (
              <Box style={{
                width: '100%', height: 300,
                backgroundColor: C.canvasBg,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: C.canvasBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 11, color: C.dimText }}>{'Canvas inactive'}</Text>
                <Text style={{ fontSize: 8, color: C.dimText }}>{'Press Launch to start a session'}</Text>
              </Box>
            )}
          </Half>
        </Band>

        <Divider />

        {/* Callout: Proxy Input Rule */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <Box style={{ flexGrow: 1, gap: 4 }}>
            <Text style={{ fontSize: 10, color: C.accent, fontWeight: 'bold' }}>{'The Proxy Input Rule'}</Text>
            <S.StoryBody>
              {'The ClaudeCanvas PTY/vterm is the single source of truth for ALL text state. An input bar is NOT an input — it displays the promptText classified token and forwards keystrokes to ClaudeCanvas. It has ZERO local text state. Display reads from classified tokens. Keystrokes go to the canvas target. Two separate concerns. Never mix them.'}
            </S.StoryBody>
          </Box>
        </CalloutBand>

        <Divider />

        {/* Band 3: useSessionChrome | proxy rule code */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={SESSION_CHROME_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="monitor" accentColor={C.blue}>{'useSessionChrome'}</SectionLabel>
            <S.StoryBody>
              {'Polls claude:classified RPC at 100ms intervals. Returns status bar text (left/right), placeholder, prompt text (extracted from input_zone rows), and cursor position. This is the display half of the proxy input pattern — it reads what the classifier says, nothing more.'}
            </S.StoryBody>
            <S.StoryCap>
              {'All display chrome comes from the classified token stream. The hook never writes to the PTY — it only reads the classifier output. Writing (keystrokes) goes through keystrokeTarget/submitTarget on the Input component.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* Band 4: useClaude | text */}
        <Band>
          <Half>
            <SectionLabel icon="shield" accentColor={C.orange}>{'useClaude'}</SectionLabel>
            <S.StoryBody>
              {'Manages the permission/question/status state of a Claude session. When Claude wants to use a tool, onPerm fires with the action and target. Your UI shows a modal. The user clicks accept or deny. You call respond(0) or respond(1). Same pattern for questions with multiple options.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Auto-accept mode (toggleAutoAccept) tells the Lua side to automatically approve all tool permissions. Useful for trusted sessions. State syncs from Lua on mount and survives HMR.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={USECLAUDE_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* Band 5: Classification | token catalog */}
        <Band>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={CLASSIFICATION_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="tag" accentColor={C.mauve}>{'ROW CLASSIFICATION'}</SectionLabel>
            <S.StoryBody>
              {'Every vterm row is classified into a semantic token type by lua/classifiers/claude_code.lua. The classifier runs every frame on dirty rows, detecting patterns like prompt markers, thinking indicators, tool headers, diff markers, and permission blocks.'}
            </S.StoryBody>
            <TokenCatalog />
          </Half>
        </Band>

        <Divider />

        {/* Band 6: Session state machine | diagram */}
        <Band>
          <Half>
            <SectionLabel icon="activity" accentColor={C.yellow}>{'SESSION STATE MACHINE'}</SectionLabel>
            <S.StoryBody>
              {'claude_session.lua implements a state machine that tracks where Claude is in its workflow. Transitions are detected by the classifier scanning vterm rows for known patterns. The state drives UI behavior — Idle shows the input bar, Streaming shows a progress indicator, PermGate shows the permission modal.'}
            </S.StoryBody>
            <StatePreview />
          </Half>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={STATE_MACHINE_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* Band 7: Full pipeline */}
        <Band>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={PIPELINE_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="layers" accentColor={C.teal}>{'RENDERING PIPELINE'}</SectionLabel>
            <S.StoryBody>
              {'Six stages, all Lua. The Claude CLI runs in a PTY. vterm parses ANSI into a grid. The classifier tags each row. The graph builder creates a semantic tree with stable identity. The diff engine computes minimal updates. The block renderer paints monospace text, colored bullets, tool blocks, and inline diffs using love.graphics.'}
            </S.StoryBody>
            <S.StoryCap>
              {'React declares exactly one node: ClaudeCanvas. Everything else — PTY management, vterm parsing, classification, graph building, diffing, and painting — is Lua. This is the proxy pattern at its most extreme.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* Proxy Input Rule code */}
        <S.StoryFullBand>
          <SectionLabel icon="lock" accentColor={C.accent}>{'PROXY INPUT PATTERN (THE FULL PICTURE)'}</SectionLabel>
          <CodeBlock language="tsx" fontSize={8} code={PROXY_RULE_CODE} style={{ width: '100%' }} />
        </S.StoryFullBand>

        <Divider />

        {/* Architecture callout */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'The Lua files involved: claude_canvas.lua (visual hittable node, keyboard input, scroll, blink), claude_session.lua (PTY lifecycle, state machine, vterm damage), claude_renderer.lua (monospace block painter), claude_graph.lua (semantic tree with stable identity), classifiers/claude_code.lua (row token classifier). Total: ~2500 lines of Lua. React: 6 lines.'}
          </S.StoryBody>
        </CalloutBand>

        </PageColumn>
      </ScrollView>

      {/* Footer */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="terminal" />
        <S.StoryBreadcrumbActive>{'Claude Canvas'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
