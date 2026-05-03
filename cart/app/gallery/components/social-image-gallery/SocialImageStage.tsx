import { classifiers as S } from '@reactjit/core';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  GalleryThumbnails,
} from '@reactjit/runtime/icons/icons';
import type { SocialImageItem } from './socialImageGalleryShared';
import { formatSocialCount } from './socialImageGalleryShared';

export type SocialImageStageProps = {
  images: SocialImageItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function SocialImageStage({
  images,
  selectedIndex,
  onSelect,
  onPrevious,
  onNext,
}: SocialImageStageProps) {
  const activeImage = images[selectedIndex] || images[0];
  if (!activeImage) return null;

  return (
    <S.SocialGalleryMediaShell>
      <S.SocialGalleryMediaRow>
        <S.SocialGalleryNavButton onPress={onPrevious}>
          <S.SocialGalleryIconInk icon={ChevronLeft} />
        </S.SocialGalleryNavButton>

        <S.SocialGalleryMediaFrame>
          <S.SocialGalleryImage source={activeImage.source} />
        </S.SocialGalleryMediaFrame>

        <S.SocialGalleryNavButton onPress={onNext}>
          <S.SocialGalleryIconInk icon={ChevronRight} />
        </S.SocialGalleryNavButton>
      </S.SocialGalleryMediaRow>

      <S.SocialGalleryOverlayBar>
        <S.StackX2 style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>
          <S.InlineX3>
            <S.SocialGalleryIconAccent icon={Camera} />
            <S.SocialGalleryImageTitle>{activeImage.title}</S.SocialGalleryImageTitle>
          </S.InlineX3>
          <S.SocialGalleryMetaText>{activeImage.caption}</S.SocialGalleryMetaText>
        </S.StackX2>
        <S.InlineX5 style={{ flexShrink: 0 }}>
          <S.InlineX2>
            <S.SocialGalleryIcon icon={Eye} />
            <S.SocialGalleryCount>{formatSocialCount(activeImage.viewCount)}</S.SocialGalleryCount>
          </S.InlineX2>
          <S.InlineX2>
            <S.SocialGalleryIcon icon={GalleryThumbnails} />
            <S.SocialGalleryCount>{`${selectedIndex + 1}/${images.length}`}</S.SocialGalleryCount>
          </S.InlineX2>
        </S.InlineX5>
      </S.SocialGalleryOverlayBar>

      <S.SocialGalleryThumbRail>
        <S.SocialGalleryThumbRailInner>
          {images.map((image, index) => {
            const Thumb = index === selectedIndex ? S.SocialGalleryThumbActive : S.SocialGalleryThumb;
            return (
              <Thumb key={image.id} onPress={() => onSelect(index)}>
                <S.SocialGalleryThumbImage source={image.source} />
              </Thumb>
            );
          })}
        </S.SocialGalleryThumbRailInner>
      </S.SocialGalleryThumbRail>
    </S.SocialGalleryMediaShell>
  );
}
