import type { ReactNode } from 'react';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';

export type MenuTileShellProps = {
  id: string;
  title: string;
  kind: string;
  ratio?: 'landscape' | 'square';
  children: ReactNode;
};

const TILE_BASE = {
  flexDirection: 'column' as const,
  flexShrink: 0,
  borderWidth: 1,
  borderColor: 'theme:inkGhost',
  borderRadius: 8,
  backgroundColor: 'theme:bg',
  overflow: 'hidden' as const,
};

const TILE_LANDSCAPE = { ...TILE_BASE, width: 560, height: 420 };
const TILE_SQUARE    = { ...TILE_BASE, width: 420, height: 420 };

const STAGE_STYLE = {
  flex: 1,
  flexGrow: 1,
  flexDirection: 'column' as const,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  backgroundColor: 'theme:bg',
};

export function MenuTileShell({ id, title, kind, ratio = 'landscape', children }: MenuTileShellProps) {
  const tileStyle = ratio === 'square' ? TILE_SQUARE : TILE_LANDSCAPE;
  return (
    <Box style={tileStyle}>
      <S.MenuTileChrome>
        <S.MenuTileId>{id}</S.MenuTileId>
        <S.MenuTileTitle>{title}</S.MenuTileTitle>
        <S.MenuTileSpacer />
        <S.MenuTileKind>{kind}</S.MenuTileKind>
      </S.MenuTileChrome>
      <Box style={STAGE_STYLE}>{children}</Box>
    </Box>
  );
}
