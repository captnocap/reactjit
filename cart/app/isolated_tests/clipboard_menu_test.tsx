// Right-click → context menu, gated by REAL selection state.
//
// The Copy item only appears when something is actually highlighted (not just
// when the input has any value). It mirrors what Ctrl+C would copy:
//
//   focused input with a range  → input's selected slice
//   tree-text selection         → the walked text
//   neither                     → no Copy item
//
// `clipboard.getSelection()` calls into framework/v8_bindings_core.zig
// `__selection_get`, which itself reads the active selection state from
// framework/input.zig + framework/selection.zig (single source of truth).
//
// The Paste item only appears when an editable input is focused.
//
// Engine guarantees a single global highlight: focusing an input clears the
// tree highlight, and clicking text outside an input clears every input's
// selection. So getSelection() returns at most one thing.

import { useState } from 'react';
import * as clipboard from '@reactjit/runtime/hooks/clipboard';
import { useContextMenu } from '@reactjit/runtime/hooks/useContextMenu';

const STATIC_QUOTE =
  'wgsl crushes the other approach — josiah, ~2026-04';

function MenuItem({
  label,
  onPick,
  disabled,
}: {
  label: string;
  onPick: () => void;
  disabled?: boolean;
}) {
  const [hot, setHot] = useState(false);
  return (
    <div
      onHoverEnter={() => !disabled && setHot(true)}
      onHoverExit={() => setHot(false)}
      onClick={() => !disabled && onPick()}
      style={{
        height: 32,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: hot && !disabled ? '#374151' : 'transparent',
      } as any}
    >
      <span
        style={{
          color: disabled ? '#6b7280' : '#e5e7eb',
          fontSize: 14,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function App() {
  const [value, setValue] = useState('');
  const [log, setLog] = useState<string[]>([]);

  // Snapshot of selection text at right-click time. Capturing it once at open
  // means the menu shows a stable item set even if the user mouses around
  // before clicking. (Right-click clears focus on its way to the menu, which
  // would otherwise drop the input's selection out from under us.)
  const [snapshot, setSnapshot] = useState<{
    selectionText: string;
    inputFocused: boolean;
  }>({ selectionText: '', inputFocused: false });

  // Track input focus on the cart side via onFocus/onBlur — we need to know
  // at right-click time whether an input is the active editable target.
  const [inputFocused, setInputFocused] = useState(false);

  const baseMenu = useContextMenu();

  const append = (line: string) =>
    setLog((prev) => [line, ...prev].slice(0, 8));

  const openMenuAt = (e: { x: number; y: number }) => {
    setSnapshot({
      selectionText: clipboard.getSelection(),
      inputFocused, // captured before right-click can blur the input
    });
    baseMenu.triggerProps.onRightClick(e);
  };

  const doCopy = () => {
    if (snapshot.selectionText) {
      clipboard.set(snapshot.selectionText);
      append(`copied: "${snapshot.selectionText}"`);
    }
    baseMenu.close();
  };

  const doPaste = () => {
    const incoming = clipboard.get() ?? '';
    setValue((cur) => cur + incoming);
    append(`pasted into input: "${incoming}"`);
    baseMenu.close();
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 32,
        flexDirection: 'column',
        gap: 24,
        backgroundColor: '#0b1020',
      }}
    >
      <div style={{ flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 22, color: '#f8fafc', fontWeight: 700 }}>
          right-click → copy / paste (selection-gated)
        </span>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          Copy appears only when something is highlighted. Paste appears only when an input is focused.
        </span>
      </div>

      {/* ── Read-only text target ─────────────────────────────── */}
      <div style={{ flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          read-only &lt;Text&gt; — double-click to highlight a word, then right-click
        </span>
        <div
          onRightClick={openMenuAt}
          style={{
            padding: 16,
            borderRadius: 10,
            backgroundColor: '#1e293b',
            borderWidth: 1,
            borderColor: '#334155',
          } as any}
        >
          <span style={{ color: '#f1f5f9', fontSize: 15 }}>
            {STATIC_QUOTE}
          </span>
        </div>
      </div>

      {/* ── Editable input target ─────────────────────────────── */}
      <div style={{ flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          editable &lt;input&gt; — type, optionally select, then right-click
        </span>
        <input
          value={value}
          placeholder="type, select, right-click..."
          onChange={(e: any) =>
            setValue(typeof e === 'string' ? e : (e?.target?.value ?? ''))
          }
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onRightClick={openMenuAt}
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 8,
            backgroundColor: '#111827',
            color: '#f8fafc',
            borderWidth: 1,
            borderColor: '#334155',
            width: 420,
            fontSize: 15,
          } as any}
        />
        <span style={{ fontSize: 12, color: '#475569' }}>
          value: "{value}" ({value.length} chars) · focused: {inputFocused ? 'yes' : 'no'}
        </span>
      </div>

      {/* ── Event log ──────────────────────────────────────────── */}
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: '#111827',
          flexDirection: 'column',
          gap: 4,
          minHeight: 140,
        }}
      >
        <span style={{ color: '#a7f3d0', fontSize: 13 }}>log:</span>
        {log.length === 0 ? (
          <span style={{ color: '#475569', fontSize: 13 }}>(none yet)</span>
        ) : (
          log.map((line, i) => (
            <span key={i} style={{ color: '#cbd5e1', fontSize: 13 }}>
              {line}
            </span>
          ))
        )}
      </div>

      <baseMenu.ContextMenu
        style={{
          backgroundColor: '#1f2937',
          borderRadius: 8,
          padding: 4,
          flexDirection: 'column',
          width: 200,
          borderWidth: 1,
          borderColor: '#374151',
        }}
      >
        {snapshot.selectionText.length > 0 && (
          <MenuItem label="Copy" onPick={doCopy} />
        )}
        {snapshot.inputFocused && (
          <MenuItem label="Paste" onPick={doPaste} />
        )}
        {snapshot.selectionText.length === 0 && !snapshot.inputFocused && (
          <MenuItem label="(nothing to do)" onPick={() => baseMenu.close()} disabled />
        )}
      </baseMenu.ContextMenu>
    </div>
  );
}
