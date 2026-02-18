import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import { BridgeProvider, RendererProvider } from '../../packages/shared/src/context';
import { ScaleProvider } from '../../packages/shared/src/ScaleContext';
import { StoryBridge } from './StoryBridge';
import type { StoryDef } from './stories';

// --- Virtualization core ---

const ESTIMATED_HEIGHT = 500;
const OVERSCAN = 2; // extra stories rendered above/below viewport
const SECTION_HEADER_HEIGHT = 44; // height of each story's section header

/** Binary search: find the first story whose bottom edge is past scrollTop */
function findFirstVisible(offsets: number[], heights: number[], scrollTop: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid] + heights[mid] <= scrollTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Find the last story whose top edge is before scrollTop + viewportHeight */
function findLastVisible(offsets: number[], scrollBottom: number, count: number): number {
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (offsets[mid] < scrollBottom) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/** Recompute cumulative offsets from a heights array */
function buildOffsets(heights: number[]): number[] {
  const offsets = new Array(heights.length);
  let sum = 0;
  for (let i = 0; i < heights.length; i++) {
    offsets[i] = sum;
    sum += heights[i];
  }
  return offsets;
}

// --- Types ---

export interface StoryScrollHandle {
  scrollToStory: (id: string) => void;
}

interface StoryScrollProps {
  stories: StoryDef[];
  onActiveStoryChange: (id: string) => void;
}

// --- Component ---

export const StoryScroll = forwardRef<StoryScrollHandle, StoryScrollProps>(
  function StoryScroll({ stories, onActiveStoryChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [bridge] = useState(() => new StoryBridge());

    // Height tracking: one entry per story (includes section header)
    const heightsRef = useRef<number[]>(stories.map(() => ESTIMATED_HEIGHT + SECTION_HEADER_HEIGHT));
    const [offsets, setOffsets] = useState(() => buildOffsets(heightsRef.current));
    const totalHeight = offsets.length > 0
      ? offsets[offsets.length - 1] + heightsRef.current[heightsRef.current.length - 1]
      : 0;

    // Visible range
    const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 5]);

    // Measurement refs — one per story slot
    const measureRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Track which stories have been measured
    const measuredRef = useRef<Set<number>>(new Set());

    // Pending measurement flag to batch offset rebuilds
    const pendingRebuild = useRef(false);

    // Story index by id for quick lookup
    const idToIndex = useMemo(() => {
      const map = new Map<string, number>();
      stories.forEach((s, i) => map.set(s.id, i));
      return map;
    }, [stories]);

    // Measure a story's rendered height and update if different
    const measureStory = useCallback((index: number, el: HTMLDivElement | null) => {
      if (!el) {
        measureRefs.current.delete(index);
        return;
      }
      measureRefs.current.set(index, el);

      // Defer measurement to after paint
      requestAnimationFrame(() => {
        if (!el.isConnected) return;
        const rect = el.getBoundingClientRect();
        const measured = Math.ceil(rect.height);
        if (measured > 0 && measured !== heightsRef.current[index]) {
          heightsRef.current[index] = measured;
          measuredRef.current.add(index);
          if (!pendingRebuild.current) {
            pendingRebuild.current = true;
            requestAnimationFrame(() => {
              pendingRebuild.current = false;
              setOffsets(buildOffsets(heightsRef.current));
            });
          }
        }
      });
    }, []);

    // Scroll handler
    const handleScroll = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      const scrollTop = el.scrollTop;
      const viewportHeight = el.clientHeight;
      const scrollBottom = scrollTop + viewportHeight;

      const currentOffsets = buildOffsets(heightsRef.current);
      const count = stories.length;
      if (count === 0) return;

      const first = findFirstVisible(currentOffsets, heightsRef.current, scrollTop);
      const last = findLastVisible(currentOffsets, scrollBottom, count);

      const start = Math.max(0, first - OVERSCAN);
      const end = Math.min(count - 1, last + OVERSCAN);
      setVisibleRange([start, end]);

      // Active story: the one whose section header is closest to the top of the viewport
      // Find the topmost story that's at least partially visible
      let activeIndex = first;
      for (let i = first; i <= last; i++) {
        if (currentOffsets[i] <= scrollTop + 100) {
          activeIndex = i;
        }
      }
      onActiveStoryChange(stories[activeIndex].id);
    }, [stories, onActiveStoryChange]);

    // Initial visible range calculation
    useEffect(() => {
      handleScroll();
    }, [handleScroll]);

    // Imperative scrollToStory
    useImperativeHandle(ref, () => ({
      scrollToStory(id: string) {
        const index = idToIndex.get(id);
        if (index == null || !containerRef.current) return;
        const currentOffsets = buildOffsets(heightsRef.current);
        containerRef.current.scrollTo({
          top: currentOffsets[index],
          behavior: 'smooth',
        });
      },
    }), [idToIndex]);

    // Build render items
    const [start, end] = visibleRange;
    const topSpacerHeight = offsets[start] ?? 0;
    const lastVisibleBottom = end < stories.length
      ? (offsets[end] ?? 0) + heightsRef.current[end]
      : totalHeight;
    const bottomSpacerHeight = Math.max(0, totalHeight - lastVisibleBottom);

    return (
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {/* Top spacer */}
        <div style={{ height: topSpacerHeight, flexShrink: 0 }} />

        {/* Visible stories */}
        {stories.slice(start, end + 1).map((story, i) => {
          const globalIndex = start + i;
          const StoryComponent = story.component;
          return (
            <div
              key={story.id}
              ref={(el) => measureStory(globalIndex, el)}
              style={{ minHeight: ESTIMATED_HEIGHT }}
            >
              {/* Section header */}
              <div
                style={{
                  height: SECTION_HEADER_HEIGHT,
                  padding: '8px 16px',
                  borderBottom: '1px solid #1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#0c0c14',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                }}
              >
                <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                  {story.title}
                </span>
                <span style={{ fontSize: 10, color: '#334155' }}>
                  {story.category}
                </span>
              </div>

              {/* Story content */}
              <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 0' }}>
                <BridgeProvider bridge={bridge}>
                  <RendererProvider mode="web">
                    <ScaleProvider reference={{ width: 800, height: 600 }}>
                      <StoryComponent />
                    </ScaleProvider>
                  </RendererProvider>
                </BridgeProvider>
              </div>

              {/* Story separator */}
              <div style={{
                height: 1,
                backgroundColor: '#1e293b',
                margin: '0 16px',
              }} />
            </div>
          );
        })}

        {/* Bottom spacer */}
        <div style={{ height: bottomSpacerHeight, flexShrink: 0 }} />
      </div>
    );
  }
);
