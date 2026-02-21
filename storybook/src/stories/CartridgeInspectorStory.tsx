import React from 'react';
import { CartridgeInspector } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

export function CartridgeInspectorStory() {
  const c = useThemeColors();
  return <CartridgeInspector colors={c} />;
}
