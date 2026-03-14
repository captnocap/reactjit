/**
 * component-map.tsx — Maps Gradio component types to ReactJIT renderers.
 *
 * Each mapper receives the Gradio component's props + runtime state and returns
 * ReactJIT JSX. The mapper is a thin translation layer — all compute stays in Lua.
 */

import React from 'react';
import { Box, Text, Image, Pressable, ScrollView, Input } from '@reactjit/core';
import { Slider } from '@reactjit/core';
import { Checkbox } from '@reactjit/core';
import { Radio, RadioGroup } from '@reactjit/core';
import { Select } from '@reactjit/core';
import type { GradioComponentState } from './types';

// ── Shared types ────────────────────────────────────────

interface ComponentMapperProps {
  state: GradioComponentState;
  onChange: (value: any) => void;
  onSubmit?: () => void;
  themeColors: Record<string, string>;
}

type ComponentMapper = (props: ComponentMapperProps) => React.ReactElement | null;

// ── Label wrapper ───────────────────────────────────────

function Label({ label, children, colors }: {
  label?: string;
  children: React.ReactNode;
  colors: Record<string, string>;
}) {
  if (!label) return <>{children}</>;
  return (
    <Box style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, color: colors.muted, fontWeight: 'bold' }}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

// ── Individual mappers ──────────────────────────────────

const textbox: ComponentMapper = ({ state, onChange, onSubmit, themeColors }) => {
  const lines = state.props.lines ?? 1;
  const isMultiline = lines > 1;
  return (
    <Label label={state.props.label} colors={themeColors}>
      <Input
        value={state.value ?? ''}
        onChangeText={onChange}
        onSubmit={onSubmit ? () => onSubmit() : undefined}
        placeholder={state.props.placeholder ?? ''}
        multiline={isMultiline}
        submitOnEnter={!isMultiline}
        live
        style={{
          backgroundColor: themeColors.surface,
          borderRadius: 6,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 8,
          paddingBottom: 8,
          color: themeColors.text,
          fontSize: 14,
          ...(isMultiline ? { height: lines * 24 } : { height: 36 }),
        }}
      />
    </Label>
  );
};

const number: ComponentMapper = ({ state, onChange, themeColors }) => (
  <Label label={state.props.label} colors={themeColors}>
    <Input
      value={state.value != null ? String(state.value) : ''}
      onChangeText={(text: string) => {
        const n = parseFloat(text);
        if (!isNaN(n)) onChange(n);
        else if (text === '' || text === '-') onChange(text);
      }}
      placeholder={state.props.placeholder ?? '0'}
      live
      style={{
        backgroundColor: themeColors.surface,
        borderRadius: 6,
        paddingLeft: 10,
        paddingRight: 10,
        height: 36,
        color: themeColors.text,
        fontSize: 14,
      }}
    />
  </Label>
);

const slider: ComponentMapper = ({ state, onChange, themeColors }) => {
  const min = state.props.minimum ?? 0;
  const max = state.props.maximum ?? 100;
  const step = state.props.step ?? 1;
  return (
    <Label label={state.props.label} colors={themeColors}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Box style={{ flexGrow: 1 }}>
          <Slider
            value={state.value ?? min}
            onValueChange={onChange}
            minimumValue={min}
            maximumValue={max}
            step={step}
            activeTrackColor={themeColors.primary}
          />
        </Box>
        <Text style={{ fontSize: 13, color: themeColors.text, minWidth: 40 }}>
          {`${state.value ?? min}`}
        </Text>
      </Box>
    </Label>
  );
};

const dropdown: ComponentMapper = ({ state, onChange, themeColors }) => {
  const choices: string[] = state.props.choices ?? [];
  const options = choices.map((c: string) => ({ label: c, value: c }));
  return (
    <Label label={state.props.label} colors={themeColors}>
      <Select
        value={state.value ?? ''}
        onValueChange={onChange}
        options={options}
        placeholder={state.props.label ?? 'Select...'}
        style={{ backgroundColor: themeColors.surface }}
      />
    </Label>
  );
};

const checkbox: ComponentMapper = ({ state, onChange, themeColors }) => (
  <Checkbox
    value={!!state.value}
    onValueChange={onChange}
    label={state.props.label}
    color={themeColors.primary}
  />
);

const checkboxgroup: ComponentMapper = ({ state, onChange, themeColors }) => {
  const choices: string[] = state.props.choices ?? [];
  const selected: string[] = state.value ?? [];
  return (
    <Label label={state.props.label} colors={themeColors}>
      <Box style={{ gap: 6 }}>
        {choices.map((choice: string) => (
          <Checkbox
            key={choice}
            value={selected.includes(choice)}
            onValueChange={(checked: boolean) => {
              const next = checked
                ? [...selected, choice]
                : selected.filter((s: string) => s !== choice);
              onChange(next);
            }}
            label={choice}
            color={themeColors.primary}
          />
        ))}
      </Box>
    </Label>
  );
};

const radio: ComponentMapper = ({ state, onChange, themeColors }) => {
  const choices: string[] = state.props.choices ?? [];
  return (
    <Label label={state.props.label} colors={themeColors}>
      <RadioGroup value={state.value ?? ''} onValueChange={onChange}>
        {choices.map((choice: string) => (
          <Radio
            key={choice}
            value={choice}
            label={choice}
            color={themeColors.primary}
          />
        ))}
      </RadioGroup>
    </Label>
  );
};

const button: ComponentMapper = ({ state, onSubmit, themeColors }) => {
  const variant = state.props.variant ?? 'secondary';
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onSubmit}
      style={{
        backgroundColor: isPrimary ? themeColors.primary : themeColors.surface,
        borderRadius: 6,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{
        color: isPrimary ? '#ffffff' : themeColors.text,
        fontSize: 14,
        fontWeight: 'bold',
      }}>
        {state.props.value ?? 'Submit'}
      </Text>
    </Pressable>
  );
};

const image: ComponentMapper = ({ state, themeColors }) => {
  const src = state.value;
  if (!src) {
    return (
      <Label label={state.props.label} colors={themeColors}>
        <Box style={{
          backgroundColor: themeColors.surface,
          borderRadius: 6,
          height: 200,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ color: themeColors.muted, fontSize: 13 }}>
            {state.loading ? 'Loading...' : 'No image'}
          </Text>
        </Box>
      </Label>
    );
  }
  return (
    <Label label={state.props.label} colors={themeColors}>
      <Image
        src={src}
        style={{ borderRadius: 6, width: '100%' }}
      />
    </Label>
  );
};

const markdown: ComponentMapper = ({ state, themeColors }) => {
  // Markdown is rendered by Lua's markdown.lua — we pass it as a Text node
  // with the __markdown flag for the painter to pick up.
  // For now, render as plain text. TODO: use CodeBlock or dedicated Markdown component.
  return (
    <Text style={{ color: themeColors.text, fontSize: 14 }}>
      {state.value ?? state.props.value ?? ''}
    </Text>
  );
};

const label: ComponentMapper = ({ state, themeColors }) => (
  <Label label={state.props.label} colors={themeColors}>
    <Text style={{ color: themeColors.text, fontSize: 16 }}>
      {state.value != null ? String(state.value) : ''}
    </Text>
  </Label>
);

const json_display: ComponentMapper = ({ state, themeColors }) => {
  const text = state.value != null ? JSON.stringify(state.value, null, 2) : '';
  return (
    <Label label={state.props.label} colors={themeColors}>
      <Box style={{
        backgroundColor: themeColors.surface,
        borderRadius: 6,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        <Text style={{ color: themeColors.text, fontSize: 12, fontFamily: 'monospace' }}>
          {text}
        </Text>
      </Box>
    </Label>
  );
};

const code: ComponentMapper = ({ state, onChange, themeColors }) => (
  <Label label={state.props.label} colors={themeColors}>
    <Input
      value={state.value ?? ''}
      onChangeText={onChange}
      multiline
      lineNumbers
      syntaxHighlight={state.props.language ?? 'python'}
      live
      style={{
        backgroundColor: themeColors.surface,
        borderRadius: 6,
        height: (state.props.lines ?? 5) * 20,
        fontSize: 13,
      }}
    />
  </Label>
);

const chatbot: ComponentMapper = ({ state, themeColors }) => {
  const messages: Array<[string, string | null]> = state.value ?? [];
  return (
    <Label label={state.props.label} colors={themeColors}>
      <ScrollView style={{
        backgroundColor: themeColors.surface,
        borderRadius: 6,
        height: 400,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        <Box style={{ gap: 8 }}>
          {messages.map((pair: [string, string | null], i: number) => (
            <Box key={`msg-${i}`} style={{ gap: 4 }}>
              {/* User message */}
              <Box style={{
                backgroundColor: themeColors.primary,
                borderRadius: 8,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                alignSelf: 'flex-end',
                maxWidth: '70%',
              }}>
                <Text style={{ color: '#ffffff', fontSize: 14 }}>{pair[0]}</Text>
              </Box>
              {/* Bot message */}
              {pair[1] != null && (
                <Box style={{
                  backgroundColor: themeColors.bgElevated ?? themeColors.surface,
                  borderRadius: 8,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                  alignSelf: 'flex-start',
                  maxWidth: '70%',
                }}>
                  <Text style={{ color: themeColors.text, fontSize: 14 }}>{pair[1]}</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Label>
  );
};

const dataframe: ComponentMapper = ({ state, themeColors }) => {
  const headers: string[] = state.props.headers ?? state.value?.headers ?? [];
  const data: any[][] = state.value?.data ?? state.value ?? [];
  return (
    <Label label={state.props.label} colors={themeColors}>
      <ScrollView style={{
        backgroundColor: themeColors.surface,
        borderRadius: 6,
        height: Math.min(300, (data.length + 1) * 32 + 16),
      }}>
        <Box style={{ gap: 0 }}>
          {/* Header row */}
          {headers.length > 0 && (
            <Box style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderColor: themeColors.border,
              paddingBottom: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
            }}>
              {headers.map((h: string) => (
                <Box key={h} style={{ flexGrow: 1, flexBasis: 0 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: themeColors.text }}>{h}</Text>
                </Box>
              ))}
            </Box>
          )}
          {/* Data rows */}
          {data.map((row: any[], ri: number) => (
            <Box key={`row-${ri}`} style={{
              flexDirection: 'row',
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              backgroundColor: ri % 2 === 0 ? 'transparent' : themeColors.surface,
            }}>
              {row.map((cell: any, ci: number) => (
                <Box key={`cell-${ri}-${ci}`} style={{ flexGrow: 1, flexBasis: 0 }}>
                  <Text style={{ fontSize: 12, color: themeColors.text }}>
                    {cell != null ? String(cell) : ''}
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Label>
  );
};

const file: ComponentMapper = ({ state, themeColors }) => (
  <Label label={state.props.label} colors={themeColors}>
    <Box style={{
      backgroundColor: themeColors.surface,
      borderRadius: 6,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 20,
      paddingBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
      borderStyle: 'dashed',
    }}>
      <Text style={{ color: themeColors.muted, fontSize: 13 }}>
        {state.value ? `File: ${state.value.name ?? state.value}` : 'Drop file or click to upload'}
      </Text>
    </Box>
  </Label>
);

const unsupported: ComponentMapper = ({ state, themeColors }) => (
  <Box style={{
    backgroundColor: themeColors.surface,
    borderRadius: 6,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: themeColors.border,
  }}>
    <Text style={{ color: themeColors.muted, fontSize: 12 }}>
      {`Unsupported: ${state.type} (id: ${state.id})`}
    </Text>
  </Box>
);

// ── The map ─────────────────────────────────────────────

export const COMPONENT_MAP: Record<string, ComponentMapper> = {
  textbox,
  textarea: textbox,
  number,
  slider,
  dropdown,
  checkbox,
  checkboxgroup,
  radio,
  button,
  image,
  markdown,
  label,
  json: json_display,
  code,
  chatbot,
  dataframe,
  file,
  audio: unsupported,   // TODO: wire to @reactjit/audio
  video: unsupported,   // TODO: wire to @reactjit/media
  plot: image,           // Gradio sends plots as base64 images
  gallery: unsupported,  // TODO: image grid
  html: markdown,        // best-effort: render as text
  highlightedtext: label,
  model3d: unsupported,  // TODO: wire to @reactjit/3d
  uploadbutton: file,
  colorpicker: unsupported,
  state: () => null,     // hidden state component — no UI
};

// ── Layout mappers ──────────────────────────────────────

export const LAYOUT_MAP: Record<string, string> = {
  row: 'row',
  column: 'column',
  tabs: 'column',
  tab: 'column',
  tabitem: 'column',
  group: 'column',
  accordion: 'column',
  box: 'column',
  form: 'column',
};

export { unsupported };
export type { ComponentMapper, ComponentMapperProps };
