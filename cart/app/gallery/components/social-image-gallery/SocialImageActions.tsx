import { classifiers as S } from '@reactjit/core';
import {
  Bookmark,
  Heart,
  MessageSquare,
  Repeat2,
  Share2,
} from '@reactjit/runtime/icons/icons';
import { formatSocialCount, type SocialImageInteractionState } from './socialImageGalleryShared';

export type SocialImageActionsProps = {
  state: SocialImageInteractionState;
  onLike: () => void;
  onRepost: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
};

type ActionTone = 'accent' | 'ok';

function GalleryActionButton({
  icon,
  count,
  label,
  iconOnly = false,
  active = false,
  tone = 'accent',
  onPress,
}: {
  icon: number[][];
  count?: number;
  label?: string;
  iconOnly?: boolean;
  active?: boolean;
  tone?: ActionTone;
  onPress: () => void;
}) {
  const Button = active ? S.SocialGalleryActionButtonActive : S.SocialGalleryActionButton;
  const ActionIcon = active
    ? tone === 'ok'
      ? S.SocialGalleryIconOk
      : S.SocialGalleryIconAccent
    : S.SocialGalleryIcon;

  return (
    <Button onPress={onPress}>
      <S.SocialGalleryActionIconSlot>
        <ActionIcon icon={icon} size={13} />
      </S.SocialGalleryActionIconSlot>
      {iconOnly ? null : (
        <S.SocialGalleryCount>{count === undefined ? label : formatSocialCount(count)}</S.SocialGalleryCount>
      )}
    </Button>
  );
}

export function SocialImageActions({
  state,
  onLike,
  onRepost,
  onComment,
  onShare,
  onBookmark,
}: SocialImageActionsProps) {
  return (
    <S.SocialGalleryActionBar>
      <GalleryActionButton icon={Heart} count={state.likeCount} active={state.liked} onPress={onLike} />
      <GalleryActionButton icon={MessageSquare} count={state.commentCount} onPress={onComment} />
      <GalleryActionButton
        icon={Repeat2}
        count={state.repostCount}
        active={state.reposted}
        tone="ok"
        onPress={onRepost}
      />
      <GalleryActionButton icon={Share2} count={state.shareCount} onPress={onShare} />
      <GalleryActionButton
        icon={Bookmark}
        iconOnly
        active={state.bookmarked}
        onPress={onBookmark}
      />
    </S.SocialGalleryActionBar>
  );
}
