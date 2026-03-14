/**
 * PlaygroundPanel — Template picker + live code editor + preview.
 *
 * Opens with a template picker grid. Pick a template to load its code into
 * the editor. Modify freely, see live preview on the right. Click "Templates"
 * to go back to the picker.
 */

import React, { useState } from 'react';
import { Box, Text, TextEditor, Pressable, useLocalStore, useMount } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Preview } from './Preview';
import { StatusBar } from './StatusBar';
import { TemplatePicker } from './TemplatePicker';
import { lint } from './lib/linter';
import { transformJSX } from './lib/jsx-transform';
import { evalComponent } from './lib/eval-component';
import type { LintMessage } from './lib/linter';
import type { Template } from './templates';

export function PlaygroundPanel() {
  const c = useThemeColors();
  // If HMR has playground code, go straight to editor; otherwise show picker
  const hasHMRCode = !!(globalThis as any).__devState?.playgroundCode;
  const [showPicker, setShowPicker] = useState(!hasHMRCode);
  const [code, setCode] = useState((globalThis as any).__devState?.playgroundCode ?? '');
  const [editorKey, setEditorKey] = useState(0); // force remount TextEditor on template change
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lintMessages, setLintMessages] = useState<LintMessage[]>([]);
  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const [tooltipLevel, setTooltipLevel] = useState<'beginner' | 'guided' | 'clean'>('beginner');

  // Persistent code storage via SQLite local store
  const [, setSavedCode] = useLocalStore('code', '', { namespace: 'playground' });

  // Expose for HMR state sync
  (globalThis as any).__currentPlaygroundCode = code;

  const processCode = (src: string) => {
    const msgs = lint(src);
    setLintMessages(msgs);
    const errs = msgs.filter(m => m.severity === 'error');
    if (errs.length > 0) { setErrors(errs.map(e => `Line ${e.line}: ${e.message}`)); return; }
    const result = transformJSX(src);
    if (result.errors.length > 0) { setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`)); return; }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
    setSavedCode(src);
  };

  // Process code on mount if we have HMR code
  useMount(() => { if (code) processCode(code); });

  const handleCodeChange = (src: string) => {
    setCode(src);
    processCode(src);
  };

  const handleJumpToLine = (line: number) => {
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(undefined), 50);
  };

  const handleTemplateSelect = (template: Template) => {
    setCode(template.code);
    setEditorKey(k => k + 1); // remount TextEditor with new initialValue
    setShowPicker(false);
    // Process immediately
    setTimeout(() => processCode(template.code), 0);
  };

  // ── Template picker mode ────────────────────────────────

  if (showPicker) {
    return <TemplatePicker onSelect={handleTemplateSelect} />;
  }

  // ── Editor + Preview mode ───────────────────────────────

  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
      <Box style={{ flexGrow: 1, flexBasis: 0, height: '100%', borderRightWidth: 1, borderColor: c.border }}>
        <Box style={{ height: 32, paddingLeft: 12, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.bgAlt, borderBottomWidth: 1, borderColor: c.border, width: '100%', justifyContent: 'space-between' }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => setShowPicker(true)}
              style={(state) => ({
                backgroundColor: state.hovered ? c.surfaceHover : c.border,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 4,
              })}
            >
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>Templates</Text>
            </Pressable>
            <Text style={{ color: c.text, fontSize: 12, fontWeight: 'normal' }}>Editor</Text>
          </Box>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ color: c.textDim, fontSize: 9, marginRight: 4 }}>Hints</Text>
            {(['beginner', 'guided', 'clean'] as const).map((level) => (
              <Pressable
                key={level}
                onPress={() => setTooltipLevel(level)}
                style={(state) => ({
                  backgroundColor: tooltipLevel === level ? c.surfaceHover : (state.hovered ? c.surface : 'transparent'),
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 2,
                  paddingBottom: 2,
                  borderRadius: 3,
                })}
              >
                <Text style={{
                  color: tooltipLevel === level ? c.text : c.textDim,
                  fontSize: 9,
                  fontWeight: tooltipLevel === level ? 'bold' : 'normal',
                }}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
              </Pressable>
            ))}
          </Box>
        </Box>
        <TextEditor
          key={editorKey}
          initialValue={code}
          onChange={handleCodeChange}
          onBlur={handleCodeChange}
          onSubmit={handleCodeChange}
          changeDelay={3}
          syntaxHighlight
          tooltipLevel={tooltipLevel}
          placeholder="Write JSX here..."
          style={{ flexGrow: 1, width: '100%' }}
          textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
        />
        <StatusBar messages={lintMessages} onJumpToLine={handleJumpToLine} />
      </Box>
      <Preview UserComponent={UserComponent} errors={errors} />
    </Box>
  );
}
