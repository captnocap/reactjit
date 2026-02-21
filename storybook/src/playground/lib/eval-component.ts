/**
 * eval-component.ts — Safe eval wrapper for user JSX code.
 *
 * Injects the full ReactJIT component library into scope so playground
 * users can prototype with any framework primitive.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  // Primitives
  Box, Text, Image, Video, Pressable, ScrollView, TextInput, TextEditor,
  // Form controls
  Slider, Switch, Checkbox, Radio, RadioGroup, Select,
  // Layout helpers
  Card, Badge, Divider, FlexRow, FlexColumn, Spacer,
  // Data visualization
  Table, BarChart, ProgressBar, Sparkline, LineChart, AreaChart, RadarChart, PieChart,
  // Navigation
  NavPanel, Tabs, Breadcrumbs, Toolbar,
  // Chat / messaging
  MessageBubble, MessageList, ChatInput, ActionBar, LoadingDots, ConversationCard,
  // Animation
  AnimatedValue, useAnimation, useSpring,
  // Utility hooks
  useWindowDimensions, useFetch, useWebSocket,
} from '../../../../packages/core/src';
import {
  Knob, Fader, Meter, LEDIndicator, PadButton, StepSequencer, TransportBar,
} from '../../../../packages/controls/src';
import {
  useAudioInit, useRack, useModule, useParam, useClock, useClockEvent, useSequencer, useSampler, useMIDI,
} from '../../../../packages/audio/src';
import {
  AIMessageList,
} from '../../../../packages/ai/src/components/AIMessageList';
import {
  AIChatInput,
} from '../../../../packages/ai/src/components/AIChatInput';
import {
  Scene, Camera, Mesh, DirectionalLight, AmbientLight,
} from '../../../../packages/3d/src';
import {
  useCombat, useQuest, useInventory, useGameState,
  HealthBar, StatusBar as GameStatusBar, QuestLog, InventoryGrid,
} from '../../../../packages/game/src';

export interface EvalResult { component: React.ComponentType | null; error: string | null; }

/** Names injected into the eval scope, in order matching the Function params */
const SCOPE_NAMES = [
  'React', 'useState', 'useEffect', 'useCallback', 'useRef', 'useMemo',
  // Primitives
  'Box', 'Text', 'Image', 'Video', 'Pressable', 'ScrollView', 'TextInput', 'TextEditor',
  // Form controls
  'Slider', 'Switch', 'Checkbox', 'Radio', 'RadioGroup', 'Select',
  // Layout helpers
  'Card', 'Badge', 'Divider', 'FlexRow', 'FlexColumn', 'Spacer',
  // Data visualization
  'Table', 'BarChart', 'ProgressBar', 'Sparkline', 'LineChart', 'AreaChart', 'RadarChart', 'PieChart',
  // Navigation
  'NavPanel', 'Tabs', 'Breadcrumbs', 'Toolbar',
  // Chat / messaging
  'MessageBubble', 'MessageList', 'ChatInput', 'ActionBar', 'LoadingDots', 'ConversationCard',
  // Animation
  'AnimatedValue', 'useAnimation', 'useSpring',
  // Utility hooks
  'useWindowDimensions', 'useFetch', 'useWebSocket',
  // Controls package
  'Knob', 'Fader', 'Meter', 'LEDIndicator', 'PadButton', 'StepSequencer', 'TransportBar',
  // Audio package
  'useAudioInit', 'useRack', 'useModule', 'useParam', 'useClock', 'useClockEvent', 'useSequencer', 'useSampler', 'useMIDI',
  // AI package
  'AIMessageList', 'AIChatInput',
  // 3D package
  'Scene', 'Camera', 'Mesh', 'DirectionalLight', 'AmbientLight',
  // Game package
  'useCombat', 'useQuest', 'useInventory', 'useGameState', 'HealthBar', 'GameStatusBar', 'QuestLog', 'InventoryGrid',
] as const;

const SCOPE_VALUES = [
  React, useState, useEffect, useCallback, useRef, useMemo,
  Box, Text, Image, Video, Pressable, ScrollView, TextInput, TextEditor,
  Slider, Switch, Checkbox, Radio, RadioGroup, Select,
  Card, Badge, Divider, FlexRow, FlexColumn, Spacer,
  Table, BarChart, ProgressBar, Sparkline, LineChart, AreaChart, RadarChart, PieChart,
  NavPanel, Tabs, Breadcrumbs, Toolbar,
  MessageBubble, MessageList, ChatInput, ActionBar, LoadingDots, ConversationCard,
  AnimatedValue, useAnimation, useSpring,
  useWindowDimensions, useFetch, useWebSocket,
  Knob, Fader, Meter, LEDIndicator, PadButton, StepSequencer, TransportBar,
  useAudioInit, useRack, useModule, useParam, useClock, useClockEvent, useSequencer, useSampler, useMIDI,
  AIMessageList, AIChatInput,
  Scene, Camera, Mesh, DirectionalLight, AmbientLight,
  useCombat, useQuest, useInventory, useGameState, HealthBar, GameStatusBar, QuestLog, InventoryGrid,
];

export function evalComponent(transformedCode: string): EvalResult {
  try {
    const funcMatch = transformedCode.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
    const constMatch = transformedCode.match(/(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/);
    const name = funcMatch?.[1] || constMatch?.[1];

    const wrapped = name
      ? `${transformedCode}\nreturn ${name};`
      : `return function __UserComponent__() { return ${transformedCode.trim().replace(/;$/, '')}; };`;

    const fn = new Function(...SCOPE_NAMES, wrapped);
    const result = fn(...SCOPE_VALUES);

    if (typeof result === 'function') return { component: result, error: null };
    if (result && typeof result === 'object' && result.$$typeof) return { component: () => result, error: null };
    return { component: null, error: 'Code did not produce a component. Define a function that returns JSX.' };
  } catch (e: any) {
    return { component: null, error: e?.message || String(e) };
  }
}
