import type { ReactNode } from 'react';
import { classifiers as S } from '@reactjit/core';

export type GalleryDisplayRatio = 'mini' | 'compact' | 'wide' | 'square' | 'portrait' | 'fluid';

export type GalleryDisplayContainerProps = {
  code: string;
  title: string;
  meta?: string;
  ratio?: GalleryDisplayRatio;
  width?: number | string;
  height?: number | string;
  stagePadding?: number;
  center?: boolean;
  children: ReactNode;
};

const RATIO_SIZE: Record<Exclude<GalleryDisplayRatio, 'fluid'>, { width: number; height: number }> = {
  mini: { width: 100, height: 100 },
  compact: { width: 250, height: 250 },
  wide: { width: 720, height: 420 },
  square: { width: 420, height: 420 },
  portrait: { width: 420, height: 560 },
};

function sizeFor(ratio: GalleryDisplayRatio, width?: number | string, height?: number | string) {
  if (ratio === 'fluid') return { width: width ?? '100%', height: height ?? '100%' };
  const base = RATIO_SIZE[ratio];
  return {
    width: width ?? base.width,
    height: height ?? base.height,
  };
}

function barcodeBits(value: string): number[] {
  const seed = value.trim() || 'A1';
  const bits: number[] = [];
  let hash = 17;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 4093;
  }
  for (let index = 0; index < 18; index += 1) {
    hash = (hash * 37 + index * 11 + seed.length) % 4093;
    bits.push(hash % 5);
  }
  return bits;
}

function DisplayBarcode({ code }: { code: string }) {
  const bits = barcodeBits(code);
  return (
    <S.GalleryDisplayBarcode>
      {bits.map((bit, index) => {
        const Bar = bit >= 3 ? S.GalleryDisplayBarcodeHot : S.GalleryDisplayBarcodeBar;
        return (
          <Bar
            key={`${code}-${index}-${bit}`}
            style={{
              width: bit === 0 ? 1 : bit === 1 ? 2 : bit === 2 ? 3 : 4,
              opacity: bit === 0 ? 0.42 : bit === 1 ? 0.62 : 1,
            }}
          />
        );
      })}
    </S.GalleryDisplayBarcode>
  );
}

export function GalleryDisplayContainer({
  code,
  title,
  meta,
  ratio = 'wide',
  width,
  height,
  stagePadding = 0,
  center = false,
  children,
}: GalleryDisplayContainerProps) {
  const size = sizeFor(ratio, width, height);
  const StageBody = center ? S.GalleryDisplayCenter : S.GalleryDisplayBody;
  const mini = ratio === 'mini';
  const footerMeta = ratio === 'compact' && !mini;
  return (
    <S.GalleryDisplayFrame style={size}>
      <S.GalleryDisplayTopBar>
        <S.GalleryDisplayCode>{code}</S.GalleryDisplayCode>
        <S.GalleryDisplayTitle style={{ flexGrow: 1, flexBasis: 0 }}>{title}</S.GalleryDisplayTitle>
        {mini || footerMeta ? null : meta ? <S.GalleryDisplayMeta>{meta}</S.GalleryDisplayMeta> : null}
        {mini || footerMeta ? null : <DisplayBarcode code={code} />}
      </S.GalleryDisplayTopBar>
      <S.GalleryDisplayStage style={{ padding: stagePadding }}>
        <StageBody>{children}</StageBody>
      </S.GalleryDisplayStage>
      {footerMeta ? (
        <S.GalleryDisplayFooter>
          {meta ? <S.GalleryDisplayMeta style={{ flexGrow: 1, flexBasis: 0 }}>{meta}</S.GalleryDisplayMeta> : null}
          <DisplayBarcode code={code} />
        </S.GalleryDisplayFooter>
      ) : null}
    </S.GalleryDisplayFrame>
  );
}
