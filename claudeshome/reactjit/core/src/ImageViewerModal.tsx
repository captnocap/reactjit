import React, { useCallback, useEffect, useMemo } from 'react';
import { Box, Image, Text } from './primitives';
import { Pressable } from './Pressable';
import { ScrollView } from './ScrollView';
import { Modal } from './Modal';
import { useRendererMode } from './context';
import type { Color, LoveEvent, Style } from './types';

export interface ImageGalleryItem {
  id?: string | number;
  src: string;
  thumbnailSrc?: string;
  title?: string;
  subtitle?: string;
  description?: string;
}

export interface ImageViewerModalProps {
  visible: boolean;
  images: ImageGalleryItem[];
  index: number;
  onRequestClose: () => void;
  onIndexChange?: (nextIndex: number) => void;
  loop?: boolean;
  showCounter?: boolean;
  showCaption?: boolean;
  showFilmstrip?: boolean;
  backdropDismiss?: boolean;
  backdropColor?: Color;
  animationType?: 'none' | 'fade' | 'slide';
  style?: Style;
  imageStyle?: Style;
}

function clampIndex(index: number, len: number): number {
  if (len <= 0) return 0;
  if (index < 0) return 0;
  if (index >= len) return len - 1;
  return index;
}

function keyName(raw: string | undefined): string {
  return (raw || '').toLowerCase();
}

function IconButton({
  label,
  onPress,
  disabled,
  compact = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable onPress={disabled ? undefined : onPress}>
      {({ pressed, hovered }) => (
        <Box
          style={{
            backgroundColor: disabled
              ? 'bgElevated'
              : pressed
                ? 'primaryPressed'
                : hovered
                  ? 'primaryHover'
                  : 'primary',
            borderRadius: compact ? 6 : 8,
            borderWidth: 1,
            borderColor: disabled ? 'border' : 'borderFocus',
            paddingLeft: compact ? 8 : 12,
            paddingRight: compact ? 8 : 12,
            paddingTop: compact ? 4 : 8,
            paddingBottom: compact ? 4 : 8,
            opacity: disabled ? 0.55 : 1,
            minWidth: compact ? 36 : 44,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: compact ? 10 : 12, color: 'bg', fontWeight: 'bold' }}>{label}</Text>
        </Box>
      )}
    </Pressable>
  );
}

export function ImageViewerModal({
  visible,
  images,
  index,
  onRequestClose,
  onIndexChange,
  loop = true,
  showCounter = true,
  showCaption = true,
  showFilmstrip = true,
  backdropDismiss = true,
  backdropColor = [0, 0, 0, 0.82],
  animationType = 'fade',
  style,
  imageStyle,
}: ImageViewerModalProps) {
  const mode = useRendererMode();
  const total = images.length;
  const safeIndex = useMemo(() => clampIndex(index, total), [index, total]);
  const current = images[safeIndex];

  const canGoPrev = total > 1 && (loop || safeIndex > 0);
  const canGoNext = total > 1 && (loop || safeIndex < total - 1);

  const goTo = useCallback((next: number) => {
    if (total <= 0 || !onIndexChange) return;
    if (loop) {
      const wrapped = ((next % total) + total) % total;
      onIndexChange(wrapped);
      return;
    }
    onIndexChange(clampIndex(next, total));
  }, [onIndexChange, loop, total]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    goTo(safeIndex - 1);
  }, [canGoPrev, goTo, safeIndex]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    goTo(safeIndex + 1);
  }, [canGoNext, goTo, safeIndex]);

  const onNativeKeyDown = useCallback((event: LoveEvent) => {
    const key = keyName(event.key);
    if (key === 'left' || key === 'arrowleft') goPrev();
    if (key === 'right' || key === 'arrowright') goNext();
    if (key === 'home') goTo(0);
    if (key === 'end') goTo(total - 1);
  }, [goNext, goPrev, goTo, total]);


  if (!visible || !current) return null;

  return (
    <Modal
      visible={visible}
      onRequestClose={onRequestClose}
      animationType={animationType}
      backdropDismiss={backdropDismiss}
      backdropColor={backdropColor}
    >
      <Box
        style={{
          width: '100%',
          height: '100%',
          padding: 16,
          gap: 10,
          ...style,
        }}
        onKeyDown={onNativeKeyDown}
      >
        <Box style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: 'textSecondary' }}>
            {showCounter ? `${safeIndex + 1} / ${total}` : ''}
          </Text>
          <IconButton label="Close" onPress={onRequestClose} compact />
        </Box>

        <Box style={{ width: '100%', flexGrow: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <IconButton label="<" onPress={goPrev} disabled={!canGoPrev} />

          <Box
            style={{
              flexGrow: 1,
              height: '100%',
              backgroundColor: 'bgAlt',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'border',
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Image
              src={current.src}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                ...imageStyle,
              }}
            />
          </Box>

          <IconButton label=">" onPress={goNext} disabled={!canGoNext} />
        </Box>

        {showCaption && (current.title || current.subtitle || current.description) && (
          <Box style={{ width: '100%', gap: 2 }}>
            {current.title && (
              <Text style={{ fontSize: 14, color: 'text', fontWeight: 'bold' }}>{current.title}</Text>
            )}
            {current.subtitle && (
              <Text style={{ fontSize: 11, color: 'textSecondary' }}>{current.subtitle}</Text>
            )}
            {current.description && (
              <Text style={{ fontSize: 10, color: 'textDim' }}>{current.description}</Text>
            )}
          </Box>
        )}

        {showFilmstrip && total > 1 && (
          <ScrollView horizontal style={{ width: '100%', maxHeight: 68 }}>
            <Box style={{ flexDirection: 'row', gap: 8, paddingBottom: 2 }}>
              {images.map((item, i) => (
                <Pressable key={item.id ?? `${item.src}-${i}`} onPress={() => goTo(i)}>
                  {({ pressed, hovered }) => (
                    <Box
                      style={{
                        width: 88,
                        height: 58,
                        borderRadius: 6,
                        overflow: 'hidden',
                        borderWidth: i === safeIndex ? 2 : 1,
                        borderColor: i === safeIndex ? 'primary' : 'border',
                        opacity: pressed ? 0.82 : hovered ? 0.92 : 1,
                      }}
                    >
                      <Image
                        src={item.thumbnailSrc || item.src}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  )}
                </Pressable>
              ))}
            </Box>
          </ScrollView>
        )}
      </Box>
    </Modal>
  );
}
