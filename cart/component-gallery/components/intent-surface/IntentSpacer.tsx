import { Box } from '../../../../runtime/primitives';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, number> = { sm: 8, md: 16, lg: 32 };

export function IntentSpacer({ size = 'md' }: { size?: Size }) {
  const px = SIZES[size] ?? SIZES.md;
  return <Box style={{ height: px, width: px }} />;
}
