/**
 * eval-component.ts — Safe eval wrapper for AI-generated JSX code.
 *
 * Each bento section is a hot-loadable surface. The AI pushes a JSX string
 * to a section by ID; this module evaluates it and returns a renderable component.
 * Section A is always the chat canvas and never uses this eval path.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Text, Image, Pressable, ScrollView, TextInput,
  Slider, Switch, Checkbox, Select,
  Card, Badge, Divider, FlexRow, FlexColumn, Spacer,
  Table, BarChart, ProgressBar, Sparkline, LineChart, AreaChart, RadarChart, PieChart,
  NavPanel, Tabs, Breadcrumbs, Toolbar,
  MessageBubble, MessageList, ChatInput, ActionBar, LoadingDots,
  AnimatedValue, useAnimation, useSpring,
  useWindowDimensions,
} from '@ilovereact/core';

export interface EvalResult {
  component: React.ComponentType | null;
  error: string | null;
}

const SCOPE_NAMES = [
  'React', 'useState', 'useEffect', 'useCallback', 'useRef', 'useMemo',
  'Box', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput',
  'Slider', 'Switch', 'Checkbox', 'Select',
  'Card', 'Badge', 'Divider', 'FlexRow', 'FlexColumn', 'Spacer',
  'Table', 'BarChart', 'ProgressBar', 'Sparkline', 'LineChart', 'AreaChart', 'RadarChart', 'PieChart',
  'NavPanel', 'Tabs', 'Breadcrumbs', 'Toolbar',
  'MessageBubble', 'MessageList', 'ChatInput', 'ActionBar', 'LoadingDots',
  'AnimatedValue', 'useAnimation', 'useSpring',
  'useWindowDimensions',
] as const;

const SCOPE_VALUES = [
  React, useState, useEffect, useCallback, useRef, useMemo,
  Box, Text, Image, Pressable, ScrollView, TextInput,
  Slider, Switch, Checkbox, Select,
  Card, Badge, Divider, FlexRow, FlexColumn, Spacer,
  Table, BarChart, ProgressBar, Sparkline, LineChart, AreaChart, RadarChart, PieChart,
  NavPanel, Tabs, Breadcrumbs, Toolbar,
  MessageBubble, MessageList, ChatInput, ActionBar, LoadingDots,
  AnimatedValue, useAnimation, useSpring,
  useWindowDimensions,
];

export function evalComponent(code: string): EvalResult {
  try {
    const funcMatch = code.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
    const constMatch = code.match(/(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/);
    const name = funcMatch?.[1] || constMatch?.[1];

    const wrapped = name
      ? `${code}\nreturn ${name};`
      : `return function __Panel__() { return ${code.trim().replace(/;$/, '')}; };`;

    const fn = new Function(...SCOPE_NAMES, wrapped);
    const result = fn(...SCOPE_VALUES);

    if (typeof result === 'function') return { component: result, error: null };
    if (result && typeof result === 'object' && result.$$typeof) return { component: () => result, error: null };
    return { component: null, error: 'Code must return a component function.' };
  } catch (e: any) {
    return { component: null, error: e?.message || String(e) };
  }
}
