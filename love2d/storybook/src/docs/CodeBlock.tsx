import React from 'react';
import { CodeBlock as CodeBlockPrimitive } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useDocsFontScale } from './DocsFontScale';

export function CodeBlock({ code }: { code: string }) {
  const { scale } = useDocsFontScale();
  const s = (base: number) => Math.round(base * scale);
  const c = useThemeColors();

  return (
    <CodeBlockPrimitive
      code={code}
      fontSize={s(10)}
      style={{
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 4,
        padding: 10,
      }}
    />
  );
}
