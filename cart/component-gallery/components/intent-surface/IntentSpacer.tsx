import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Box } from '@reactjit/runtime/primitives';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, number> = { sm: 8, md: 16, lg: 32 };

export function IntentSpacer({ size = 'md' }: { size?: Size }) {
  const px = SIZES[size] ?? SIZES.md;
  const Spacer = S.StackX1 || Box;
  return <Spacer style={{ height: px, width: px, flexShrink: 0 }} />;
}
