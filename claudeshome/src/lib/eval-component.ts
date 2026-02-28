/**
 * eval-component.ts — Safe eval wrapper for dynamic JSX.
 *
 * Panels B-G accept JSX code strings (from the panel API server, auto-semantic
 * routing, or Claude's curl commands) and evaluate them into live React components.
 * Panel A is always the Claude terminal and never uses this eval path.
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
  useWindowDimensions, useLoveRPC,
} from '@reactjit/core';

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
  'useWindowDimensions', 'useLoveRPC',
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
  useWindowDimensions, useLoveRPC,
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
