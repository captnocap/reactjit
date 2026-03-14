import React, { useState } from 'react';
import { Box, Text, Pressable, useBridge } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

function ErrorButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={(state) => ({
        backgroundColor: state.pressed ? c.bgElevated : state.hovered ? c.surface : c.bgElevated,
        borderWidth: 2,
        borderColor: state.hovered ? color : c.border,
        borderRadius: 8,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
      })}
    >
      <Text style={{ color, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function BombComponent() {
  throw new Error('Render explosion: component deliberately threw during render');
  return null;
}

export function ErrorTestStory() {
  const c = useThemeColors();
  const bridge = useBridge();
  const [triggerRenderError, setTriggerRenderError] = useState(false);

  return (
    <StoryPage>
      <StorySection index={1} title="JS Error Triggers">
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>
          {`Trigger JS-side errors. The error overlay should appear with a stack trace.`}
        </Text>

        <Box style={{ gap: 10 }}>
          <ErrorButton
            label="Throw in onClick handler"
            color="#ef4444"
            onPress={() => {
              throw new Error('Handler error: deliberate throw in onClick');
            }}
          />

          <ErrorButton
            label="TypeError (call non-function)"
            color="#f59e0b"
            onPress={() => {
              const notAFunction = null as any;
              notAFunction();
            }}
          />

          <ErrorButton
            label="ReferenceError (undefined var)"
            color="#f97316"
            onPress={() => {
              // @ts-ignore
              const x = thisVariableDoesNotExist;
            }}
          />

          <ErrorButton
            label="console.error with Error object"
            color="#8b5cf6"
            onPress={() => {
              console.error(new Error('Console.error test: error with stack trace'));
            }}
          />

          <ErrorButton
            label="Trigger render error (React)"
            color="#ec4899"
            onPress={() => {
              setTriggerRenderError(true);
            }}
          />
        </Box>

        {triggerRenderError && <BombComponent />}
      </StorySection>

      <StorySection index={2} title="Lua Crash Trigger">
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>
          {`Trigger a real Lua-side crash. The full BSOD crash report appears with the semantic event trail.`}
        </Text>

        <Box style={{ gap: 10 }}>
          <ErrorButton
            label="Lua crash via RPC (dev:crash)"
            color="#ef4444"
            onPress={() => {
              bridge.rpc('dev:crash', { reason: 'triggered from ErrorTest story' });
            }}
          />
        </Box>

        <Text style={{ color: c.muted, fontSize: 12 }}>
          {`Keyboard shortcut: Ctrl+Shift+F12 — triggers a Lua error from anywhere`}
        </Text>
      </StorySection>
    </StoryPage>
  );
}
