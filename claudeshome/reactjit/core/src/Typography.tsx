/**
 * Typography system — opinionated Text component variants.
 * Uses the ChartTooltip dot-notation pattern: `Typography.Heading`, `Typography.Muted`, etc.
 * Each sub-component is a thin `<Text>` wrapper with baked-in style defaults.
 */

import React from 'react';
import { Text } from './primitives';
import type { TextProps } from './types';

const BODY_FONT_SIZE = 14;

// Root is used to accept children (fragments, inline mixing)
function TypographyRoot({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function Heading({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: 24, fontWeight: 'bold', ...style }} {...props} />;
}

function SubHeading({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: 18, fontWeight: 'bold', ...style }} {...props} />;
}

function Label({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: 12, fontWeight: 'bold', ...style }} {...props} />;
}

function Caption({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: 10, ...style }} {...props} />;
}

function Muted({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: BODY_FONT_SIZE, opacity: 0.55, ...style }} {...props} />;
}

function Mono({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: BODY_FONT_SIZE, fontFamily: 'monospace', ...style }} {...props} />;
}

function Bold({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: BODY_FONT_SIZE, fontWeight: 'bold', ...style }} {...props} />;
}

function Italic({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: BODY_FONT_SIZE, ...style }} italic {...props} />;
}

function Strike({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: BODY_FONT_SIZE, textDecorationLine: 'line-through', ...style }} {...props} />;
}

function Underline({ style, ...props }: TextProps) {
  return <Text style={{ fontSize: BODY_FONT_SIZE, textDecorationLine: 'underline', ...style }} {...props} />;
}

// Attach sub-components as static properties
TypographyRoot.Heading = Heading;
TypographyRoot.SubHeading = SubHeading;
TypographyRoot.Label = Label;
TypographyRoot.Caption = Caption;
TypographyRoot.Muted = Muted;
TypographyRoot.Mono = Mono;
TypographyRoot.Bold = Bold;
TypographyRoot.Italic = Italic;
TypographyRoot.Strike = Strike;
TypographyRoot.Underline = Underline;

export const Typography = TypographyRoot;
