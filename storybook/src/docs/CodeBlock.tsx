import React from 'react';
import { CodeBlock as CodeBlockPrimitive } from '../../../../packages/shared/src';
import { useDocsFontScale } from './DocsFontScale';

export function CodeBlock({ code }: { code: string }) {
  const { scale } = useDocsFontScale();
  const s = (base: number) => Math.round(base * scale);

  return (
    <CodeBlockPrimitive
      code={code}
      fontSize={s(10)}
      style={{
        backgroundColor: '#0d1117',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 4,
        padding: 10,
      }}
    />
  );
}
