// list_lab — animation lab for list building + draw-outwards reveals.
//
// Four scenes selectable via top toolbar:
//   list    — staggered spring entries; add / remove / reorder
//   wipe    — block element revealed by animating width+height from 0 with
//             overflow: hidden (the "draw outwards" approximation for any
//             non-vector surface). Children render at full size and get
//             progressively unveiled — no scaling, no distortion.
//   border  — animated dashed border around a card. Two demos: a one-shot
//             border trace (animate `borderDashOn` from 0 to the rect's
//             perimeter so a single dash grows around the card) and a
//             continuous marching flow (`borderFlowSpeed` over a static
//             dash pattern, like GenericCardShell). Backed by
//             framework/border_dash.zig — the framework draws the dashes
//             along a flattened rounded-rect perimeter.
//   trace   — SVG path stroke trace via reactive `d` recomputation. The path
//             string itself is truncated per frame so <Graph.Path d={...}>
//             re-renders with progressively more of the curve. The
//             framework's svg_path.zig:drawStrokePartial exists but isn't
//             wired to a JS prop yet; once it is, this scene becomes a
//             single-prop affair.
//
// Per cart/app/app.md "Animation principles":
//   list entries (new) → SPRING (easeOutBack) on opacity + translateY,
//                        staggered by index
//   list reorder (already in view) → TWEEN — handled via the same per-item
//                                    rect snapshot used in input_lab
//   wipe / trace (new element appearing) → SPRING-feeling reveal:
//                                          easeOutCubic on the size / d-length
//                                          (true overshoot doesn't read on a
//                                          revealing edge, so we use easeOut
//                                          for the "feel" without overshoot)

import '../app/gallery/components.cls';
import { useEffect, useRef, useState } from 'react';
import { Box, Pressable, Text, Graph } from '@reactjit/runtime/primitives';
import { Router } from '@reactjit/runtime/router';
import { installBrowserShims } from '@reactjit/runtime/hooks';
import { TooltipRoot } from '@reactjit/runtime/tooltip/Tooltip';
import { applyGalleryTheme, getActiveGalleryThemeId } from '../app/gallery/gallery-theme';
import { EASINGS } from '@reactjit/runtime/easing';

applyGalleryTheme(getActiveGalleryThemeId());
installBrowserShims();

type Scene = 'list' | 'menu' | 'wipe' | 'border' | 'trace';

const easeTween  = (p: number) => (EASINGS as any).easeInOutCubic(p);
const easeOutCub = (p: number) => (EASINGS as any).easeOutCubic(p);
const easeSpring = (p: number) => (EASINGS as any).easeOutBack(p);

const nowMs = () => {
  const g: any = globalThis;
  return g?.performance?.now ? g.performance.now() : Date.now();
};

// ─────────────────────────────────────────────────────────────────────
// Single RAF master clock — shared across the lab so we don't spawn N loops.
// Returns the elapsed ms since the consumer mounted; consumers derive their
// own progress (per-item delays, per-scene durations).
// ─────────────────────────────────────────────────────────────────────

function useMasterClock() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = nowMs();
    const g: any = globalThis;
    const sched = g.requestAnimationFrame ? g.requestAnimationFrame.bind(g) : (fn: any) => setTimeout(fn, 16);
    const cancel = g.cancelAnimationFrame ? g.cancelAnimationFrame.bind(g) : clearTimeout;
    let raf: any;
    const tick = () => {
      setElapsed(nowMs() - start);
      raf = sched(tick);
    };
    raf = sched(tick);
    return () => cancel(raf);
  }, []);
  return elapsed;
}

// ─────────────────────────────────────────────────────────────────────
// Toolbar
// ─────────────────────────────────────────────────────────────────────

function ToolbarButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
        borderRadius: 8, marginRight: 8,
        backgroundColor: active ? 'theme:accent' : 'theme:bg2',
        borderWidth: 1,
        borderColor: active ? 'theme:accent' : 'theme:rule',
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: 700, color: 'theme:ink' }}>{label}</Text>
    </Pressable>
  );
}

function GroupLabel({ children }: { children: any }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: 700, color: 'theme:inkDim',
      letterSpacing: 1, marginRight: 12, marginLeft: 8,
    }}>{children}</Text>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Scene 1: List building
// ─────────────────────────────────────────────────────────────────────
//
// Each list item carries its own `addedAt` timestamp. The item's entry
// progress = elapsed-since-addedAt / ENTRY_MS, with a stagger offset of
// `index * STAGGER_MS` applied at add-time so a batch-add ripples in.
//
// Reorder: when an item's index changes, snapshot its current visual
// translateY and tween from there — same FLIP-style snapshot used in
// the input_lab. Removal: opacity+scale shrink, then drop from state.

const ENTRY_MS   = 380;
const STAGGER_MS = 60;
const REORDER_MS = 400;
const EXIT_MS    = 240;

type Item = {
  id: number;
  label: string;
  addedAt: number;       // master-clock ms when this item was added
  staggerDelay: number;  // ms offset on top of addedAt (for batch ripples)
  removingAt: number | null; // null = alive; ms = exit started
};

let __idCounter = 1;
const SAMPLE_LABELS = [
  'apricot', 'birch', 'cinnamon', 'dahlia', 'elder',
  'fern', 'ginger', 'hazel', 'iris', 'juniper',
  'kelp', 'lavender', 'mint', 'nutmeg', 'oak',
];

function makeItem(label: string, addedAt: number, staggerDelay: number): Item {
  return { id: __idCounter++, label, addedAt, staggerDelay, removingAt: null };
}

const ITEM_HEIGHT = 44;
const ITEM_GAP    = 8;

type ItemTween = { fromY: number; toY: number; tweenStart: number };

function ListScene({ clock: _clock }: { clock: number }) {
  const [items, setItems] = useState<Item[]>([]);
  // Per-item tween state. Snapshot fromY = current visual position,
  // toY = target position, tweenStart = when the current tween began.
  // Whenever target changes, snapshot current visual y as new fromY,
  // set new toY, reset tweenStart. This is the same FLIP-style pattern
  // used by usePhaseTimeline in input_lab.
  const tweenRef = useRef<Map<number, ItemTween>>(new Map());

  const addOne = () => {
    const label = SAMPLE_LABELS[Math.floor(Math.random() * SAMPLE_LABELS.length)] + '-' + __idCounter;
    setItems((prev) => [...prev, makeItem(label, nowMs(), 0)]);
  };

  const addFive = () => {
    setItems((prev) => {
      const next = [...prev];
      const at = nowMs();
      for (let i = 0; i < 5; i++) {
        const label = SAMPLE_LABELS[(prev.length + i) % SAMPLE_LABELS.length] + '-' + __idCounter;
        next.push(makeItem(label, at, i * STAGGER_MS));
      }
      return next;
    });
  };

  const shuffle = () => {
    setItems((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
      }
      return next;
    });
  };

  const removeLast = () => {
    setItems((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const lastAlive = [...next].reverse().find((it) => it.removingAt === null);
      if (!lastAlive) return prev;
      const idx = next.findIndex((it) => it.id === lastAlive.id);
      next[idx] = { ...lastAlive, removingAt: nowMs() };
      return next;
    });
  };

  const clear = () => {
    tweenRef.current.clear();
    setItems([]);
  };

  // Garbage-collect items past their exit animation, and prune tween state
  // for ids that no longer exist in the items array.
  useEffect(() => {
    const liveIds = new Set(items.map((it) => it.id));
    for (const id of [...tweenRef.current.keys()]) {
      if (!liveIds.has(id)) tweenRef.current.delete(id);
    }
    if (items.every((it) => it.removingAt === null)) return;
    const t = setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.removingAt === null || (nowMs() - it.removingAt) < EXIT_MS));
    }, EXIT_MS + 30);
    return () => clearTimeout(t);
  }, [items]);

  // Compute target y per item (only living items count toward layout).
  const aliveItems = items.filter((it) => it.removingAt === null);
  const targetYByIndex: Record<number, number> = {};
  aliveItems.forEach((it, i) => {
    targetYByIndex[it.id] = i * (ITEM_HEIGHT + ITEM_GAP);
  });

  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: '100%', gap: 16, padding: 24 }}>
      {/* Controls */}
      <Box style={{ width: 220, gap: 10 }}>
        <ToolbarButton label="Add 1"        active={false} onPress={addOne} />
        <ToolbarButton label="Add 5 (ripple)" active={false} onPress={addFive} />
        <ToolbarButton label="Shuffle"      active={false} onPress={shuffle} />
        <ToolbarButton label="Remove last"  active={false} onPress={removeLast} />
        <ToolbarButton label="Clear"        active={false} onPress={clear} />
        <Text style={{ fontSize: 11, color: 'theme:inkDim', marginTop: 12, paddingLeft: 8 }}>
          Items: {aliveItems.length}
        </Text>
      </Box>

      {/* List surface */}
      <Box style={{
        flexGrow: 1,
        backgroundColor: 'theme:bg1',
        borderWidth: 1, borderColor: 'theme:rule',
        borderRadius: 12,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {items.map((it) => {
          const isExiting = it.removingAt !== null;
          const now = nowMs();

          // Entry animation (new items only)
          const entryStart = it.addedAt + it.staggerDelay;
          const entryElapsed = Math.max(0, now - entryStart);
          const entryRaw = Math.min(1, entryElapsed / ENTRY_MS);
          const entrySpring = easeSpring(entryRaw);
          const entryOpacity = entryRaw;
          const entryOffsetY = (1 - entrySpring) * -8;

          // Reorder tween — snapshot-on-target-change so shuffle / mid-list
          // removal animate from the current visual y, not from the original
          // entry y. Without this, target-change-since-mount makes the
          // (now - tweenStart) ratio always saturate to 1 → instant snap.
          const target = isExiting
            ? (tweenRef.current.get(it.id)?.toY ?? 0)
            : (targetYByIndex[it.id] ?? 0);

          let prev = tweenRef.current.get(it.id);
          let renderY: number;

          if (!prev) {
            // First time this item is seen. New items start at their target;
            // entry animation handles the visual appearance via the offset.
            prev = { fromY: target, toY: target, tweenStart: 0 };
            tweenRef.current.set(it.id, prev);
            renderY = target;
          } else {
            // Compute current visual y from the running tween.
            const dur = REORDER_MS;
            const p = prev.tweenStart === 0 ? 1 : Math.min(1, (now - prev.tweenStart) / dur);
            const currentY = prev.fromY + (prev.toY - prev.fromY) * easeTween(p);

            // Did the target change since we last saw this item? Snapshot
            // current visual y as the new fromY and restart the tween.
            if (Math.abs(prev.toY - target) > 0.5) {
              tweenRef.current.set(it.id, {
                fromY: currentY,
                toY: target,
                tweenStart: now,
              });
              renderY = currentY;
            } else {
              renderY = currentY;
            }
          }

          // Exit animation
          let exitOpacity = 1;
          let exitScale = 1;
          if (isExiting) {
            const exitElapsed = Math.max(0, now - it.removingAt!);
            const exitP = Math.min(1, exitElapsed / EXIT_MS);
            const eased = easeOutCub(exitP);
            exitOpacity = 1 - eased;
            exitScale = 1 - 0.08 * eased;
          }

          const opacity = isExiting ? exitOpacity : entryOpacity;
          const scale = isExiting ? exitScale : 1;

          return (
            <Box
              key={it.id}
              style={{
                position: 'absolute',
                left: 16, right: 16,
                top: 16 + renderY + entryOffsetY,
                height: ITEM_HEIGHT,
                opacity,
                transform: [{ scale }],
                backgroundColor: 'theme:bg2',
                borderWidth: 1, borderColor: 'theme:rule',
                borderRadius: 8,
                paddingLeft: 14, paddingRight: 14,
                flexDirection: 'row', alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 13, color: 'theme:ink' }}>{it.label}</Text>
              <Text style={{ fontSize: 11, color: 'theme:inkDim' }}>id {it.id}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Scene 2: Menu transition (slot-stable shuffle)
// ─────────────────────────────────────────────────────────────────────
//
// Rows stay put — the text inside each slot is the thing that "shuffles."
// As the transition runs, each slot's label is erased left-to-right while
// the new label scans in from the same direction. With monospaced text,
// each character index is a deterministic position; we render a hybrid
// string per frame where chars to the left of the scan head come from the
// new label and chars to the right come from the old label.
//
// Count differences are handled at the edges: extra trailing slots in the
// new menu enter via the standard list-entry spring; trailing slots that
// disappear exit via the standard list-removal shrink. The middle (slots
// present in both menus) does the text-scan.
//
// Stagger by row index so the erasure cascades top-to-bottom rather than
// firing in lockstep — reads as a wave rolling down the menu.

type MenuId = 'home' | 'admin' | 'files' | 'compose';

const MENUS: Record<MenuId, string[]> = {
  home:    ['Inbox', 'Drafts', 'Sent', 'Archive'],
  admin:   ['Users', 'Roles', 'Audit', 'Tokens'],
  files:   ['Projects', 'Recent', 'Shared', 'Trash', 'Templates'],
  compose: ['Reply', 'Forward'],
};

const MENU_LABELS: Record<MenuId, string> = {
  home: 'Home',
  admin: 'Admin',
  files: 'Files (+1)',
  compose: 'Compose (-2)',
};

const TEXT_SCAN_MS    = 380;
const TEXT_STAGGER_MS = 70;

function scannedText(from: string, to: string, progress: number): string {
  const maxLen = Math.max(from.length, to.length);
  if (maxLen === 0) return '';
  let out = '';
  for (let i = 0; i < maxLen; i++) {
    const threshold = (i + 1) / maxLen;
    if (progress >= threshold) {
      out += to[i] ?? '';
    } else {
      out += from[i] ?? '';
    }
  }
  return out;
}

function MenuScene({ clock: _clock }: { clock: number }) {
  const [menu, setMenu] = useState<MenuId>('home');
  // Snapshot of the previous menu's items so the in-flight scan reads from
  // the right `from` text, even mid-transition. Updated when transition
  // finishes — until then a new switch snapshots whatever's currently
  // visible per-slot (handled per-row below).
  const prevMenuRef = useRef<MenuId>('home');
  const transitionStartRef = useRef<number>(0);
  // Per-slot snapshot of the label currently being shown when the latest
  // transition began. Lets back-to-back menu switches read the right
  // `from` even mid-scan.
  const slotFromRef = useRef<string[]>(MENUS.home.slice());

  const switchTo = (next: MenuId) => {
    if (next === menu) return;
    // Snapshot current visible labels per slot — for slots mid-scan, the
    // visible label is the partially-scanned hybrid string. Re-deriving it
    // here keeps reversals smooth.
    const now = nowMs();
    const prevItems = MENUS[prevMenuRef.current];
    const curItems = MENUS[menu];
    const sinceTransition = now - transitionStartRef.current;
    const newFrom: string[] = [];
    const slotCount = Math.max(prevItems.length, curItems.length);
    for (let i = 0; i < slotCount; i++) {
      const old = prevItems[i] ?? '';
      const cur = curItems[i] ?? '';
      const scanStart = transitionStartRef.current + i * TEXT_STAGGER_MS;
      const scanElapsed = Math.max(0, now - scanStart);
      const p = Math.min(1, scanElapsed / TEXT_SCAN_MS);
      newFrom.push(scannedText(old, cur, easeTween(p)));
    }
    // For slots that don't exist in the previous menu, we just track empty.
    slotFromRef.current = newFrom;
    prevMenuRef.current = menu;
    transitionStartRef.current = now;
    setMenu(next);
  };

  const now = nowMs();
  const prevItems = MENUS[prevMenuRef.current];
  const curItems = MENUS[menu];
  const slotCount = Math.max(prevItems.length, curItems.length);

  // Per-slot rendered label (text-scan in the middle) and entry/exit state
  // for slots only present in one menu.
  const rows: Array<{
    key: number;
    label: string;
    state: 'scan' | 'enter' | 'exit';
    progress: number;
  }> = [];

  for (let i = 0; i < slotCount; i++) {
    const inPrev = i < prevItems.length;
    const inCur = i < curItems.length;

    if (inPrev && inCur) {
      // Slot exists in both — text scan
      const fromText = slotFromRef.current[i] ?? prevItems[i];
      const toText = curItems[i];
      const scanStart = transitionStartRef.current + i * TEXT_STAGGER_MS;
      const elapsed = Math.max(0, now - scanStart);
      const rawP = Math.min(1, elapsed / TEXT_SCAN_MS);
      const eased = easeTween(rawP);
      rows.push({
        key: i,
        label: scannedText(fromText, toText, eased),
        state: 'scan',
        progress: rawP,
      });
    } else if (!inPrev && inCur) {
      // New slot — list-entry spring
      const entryStart = transitionStartRef.current + i * TEXT_STAGGER_MS;
      const elapsed = Math.max(0, now - entryStart);
      const rawP = Math.min(1, elapsed / ENTRY_MS);
      rows.push({ key: i, label: curItems[i], state: 'enter', progress: rawP });
    } else if (inPrev && !inCur) {
      // Removed slot — list-exit shrink
      const exitStart = transitionStartRef.current + i * TEXT_STAGGER_MS;
      const elapsed = Math.max(0, now - exitStart);
      const rawP = Math.min(1, elapsed / EXIT_MS);
      // Once exit completes, drop the row entirely
      if (rawP >= 1) continue;
      rows.push({ key: i, label: prevItems[i], state: 'exit', progress: rawP });
    }
  }

  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: '100%', gap: 16, padding: 24 }}>
      {/* Menu selector */}
      <Box style={{ width: 220, gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: 'theme:inkDim', letterSpacing: 1, paddingLeft: 8, marginBottom: 4 }}>
          MENU
        </Text>
        {(Object.keys(MENUS) as MenuId[]).map((id) => (
          <ToolbarButton
            key={id}
            label={MENU_LABELS[id]}
            active={menu === id}
            onPress={() => switchTo(id)}
          />
        ))}
        <Text style={{ fontSize: 11, color: 'theme:inkDim', marginTop: 12, paddingLeft: 8 }}>
          Slots: {curItems.length}
        </Text>
      </Box>

      {/* Menu surface — slots are deterministic-position, text scans in place */}
      <Box style={{
        width: 320,
        backgroundColor: 'theme:bg1',
        borderWidth: 1, borderColor: 'theme:rule',
        borderRadius: 12,
        padding: 12,
        gap: ITEM_GAP,
      }}>
        {rows.map((row) => {
          let opacity = 1;
          let scale = 1;
          let offsetY = 0;
          if (row.state === 'enter') {
            const eased = easeSpring(row.progress);
            opacity = row.progress;
            offsetY = (1 - eased) * -8;
          } else if (row.state === 'exit') {
            const eased = easeOutCub(row.progress);
            opacity = 1 - eased;
            scale = 1 - 0.08 * eased;
          }

          return (
            <Box
              key={row.key}
              style={{
                height: ITEM_HEIGHT,
                opacity,
                transform: [{ scale }],
                marginTop: offsetY,
                backgroundColor: 'theme:bg2',
                borderWidth: 1, borderColor: 'theme:rule',
                borderRadius: 8,
                paddingLeft: 14, paddingRight: 14,
                flexDirection: 'row', alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 14,
                color: 'theme:ink',
                fontFamily: 'theme:fontMono',
              }}>{row.label}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Caption */}
      <Box style={{ flexGrow: 1, paddingLeft: 16, paddingTop: 8, gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: 700, color: 'theme:inkDim', letterSpacing: 1 }}>
          SLOT-STABLE SHUFFLE
        </Text>
        <Text style={{ fontSize: 12, color: 'theme:inkDim', maxWidth: 360 }}>
          {'Rows hold position. Each slot\'s label is erased left-to-right while the new label scans in. Stagger by row → wave cascades down. Count differences enter/exit at the trailing edge.'}
        </Text>
        <Text style={{ fontSize: 11, color: 'theme:inkDim', marginTop: 12 }}>
          {'easeInOutCubic · 380ms scan · 70ms stagger · monospaced labels keep slot widths stable'}
        </Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Scene 3: Wipe — width+height reveal of a card
// ─────────────────────────────────────────────────────────────────────
//
// Outer container animates `width: 0→W` then (or simultaneously) `height: 0→H`
// with overflow: hidden. The inner card is sized at full W,H so its content
// is laid out from the start — the reveal is purely a clipping animation.

const WIPE_W = 480;
const WIPE_H = 320;
const WIPE_MS = 950;

function WipeScene({ clock: _clock }: { clock: number }) {
  const [revealedAt, setRevealedAt] = useState<number | null>(null);

  const reveal = () => setRevealedAt(nowMs());

  let w = 0, h = 0, cardOpacity = 0;
  if (revealedAt !== null) {
    const elapsed = nowMs() - revealedAt;
    const p = Math.min(1, elapsed / WIPE_MS);
    // easeInOutCubic — soft on both ends. Slower start than easeOutCubic so
    // the reveal "leans in" rather than snapping open, slower finish so the
    // card lands gently. Bumped duration to 950ms to give the curve room.
    const eased = easeTween(p);
    // Stage the reveal: width finishes first 60%, then height. Small initial
    // height (18%) keeps the wipe visible from frame 1.
    const wP = Math.min(1, eased / 0.6);
    const hP = Math.max(0, (eased - 0.4) / 0.6);
    w = WIPE_W * wP;
    h = WIPE_H * (eased < 0.4 ? 0.18 : Math.min(1, hP));
    // Fade tracks overall progress with its own easing — easeOutCubic so the
    // card *appears* to settle in slightly before the wipe finishes, instead
    // of being stark-opaque the moment any pixel is revealed.
    cardOpacity = easeOutCub(p);
  }

  return (
    <Box style={{ flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: 32, gap: 24 }}>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ToolbarButton label="Reveal"  active={false} onPress={reveal} />
        <ToolbarButton label="Reset"   active={false} onPress={() => setRevealedAt(null)} />
      </Box>

      <Box style={{
        width: WIPE_W, height: WIPE_H,
        marginTop: 40,
        position: 'relative',
        // Faint ghost outline showing where the card will land
        borderWidth: 1, borderColor: 'theme:rule', borderRadius: 12,
      }}>
        {/* The clipping shell — animates from 0 to full size, top-left anchored */}
        <Box style={{
          position: 'absolute', left: 0, top: 0,
          width: w, height: h,
          overflow: 'hidden',
          borderRadius: 12,
        }}>
          {/* Inner card laid out at full size — reveal is just clipping.
              Opacity fades alongside the wipe so the card eases in instead
              of being fully opaque the instant any pixel is revealed. */}
          <Box style={{
            width: WIPE_W, height: WIPE_H,
            opacity: cardOpacity,
            backgroundColor: 'theme:bg1',
            borderWidth: 1, borderColor: 'theme:accent',
            borderRadius: 12,
            padding: 24,
            gap: 12,
          }}>
            <Text style={{ fontSize: 18, fontWeight: 700, color: 'theme:ink' }}>Drawn outwards</Text>
            <Text style={{ fontSize: 13, color: 'theme:inkDim' }}>
              The container animates width then height with overflow: hidden.
              The card inside is laid out at its final size from the start, so
              text doesn't reflow during the reveal — only the visible window
              grows.
            </Text>
            <Box style={{
              height: 80, marginTop: 12,
              backgroundColor: 'theme:bg2',
              borderWidth: 1, borderColor: 'theme:rule',
              borderRadius: 8,
            }} />
            <Text style={{ fontSize: 11, color: 'theme:inkDim', marginTop: 8 }}>
              easeOutCubic · 700ms · width finishes first 60% · height the last 60%
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Scene 3: Border trace + flow
// ─────────────────────────────────────────────────────────────────────
//
// Two demos side-by-side:
//   1. One-shot trace — animate `borderDashOn` from 0 to the card's perimeter
//      (and `borderDashOff` from perimeter to 0) so a single dash extends
//      around the rounded rect. Reads as "the border drew itself."
//   2. Continuous flow — static dash pattern + `borderFlowSpeed`. Marching
//      ants for live / processing states. This is what GenericCardShell uses.

const BORDER_W = 320;
const BORDER_H = 200;
const BORDER_R = 12;
// Perimeter approximation for the dash-trace. Rounded corners shorten it
// slightly (each 90° arc replaces 2r straight with πr/2 curve), but the
// approximation is close enough that the dash arrives at the start almost
// exactly when t = 1.
const BORDER_PERIM = 2 * (BORDER_W + BORDER_H) - 8 * BORDER_R + 2 * Math.PI * BORDER_R;
const BORDER_TRACE_MS = 1200;

function BorderScene({ clock: _clock }: { clock: number }) {
  const [tracedAt, setTracedAt] = useState<number | null>(null);

  const trigger = () => setTracedAt(nowMs());

  let dashOn = 0;
  let dashOff = BORDER_PERIM;
  if (tracedAt !== null) {
    const elapsed = nowMs() - tracedAt;
    const p = Math.min(1, elapsed / BORDER_TRACE_MS);
    const eased = easeOutCub(p);
    dashOn = eased * BORDER_PERIM;
    dashOff = (1 - eased) * BORDER_PERIM;
  }

  return (
    <Box style={{ flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: 32, gap: 24 }}>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ToolbarButton label="Trace border" active={false} onPress={trigger} />
        <ToolbarButton label="Reset"        active={false} onPress={() => setTracedAt(null)} />
      </Box>

      <Box style={{ flexDirection: 'row', gap: 48, marginTop: 24 }}>
        {/* Demo 1: one-shot trace */}
        <Box style={{ flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: 'theme:inkDim' }}>ONE-SHOT TRACE</Text>
          <Box style={{
            width: BORDER_W, height: BORDER_H,
            borderRadius: BORDER_R,
            backgroundColor: 'theme:bg1',
            // Static base border at low opacity to ghost the final shape
            borderWidth: 1, borderColor: 'theme:rule',
            position: 'relative',
          }}>
            {/* Tracing dashed border overlay */}
            <Box style={{
              position: 'absolute',
              left: 0, top: 0, right: 0, bottom: 0,
              borderRadius: BORDER_R,
              borderWidth: 0,
              borderColor: 'theme:accent',
              borderDashOn: dashOn,
              borderDashOff: dashOff,
              borderDashWidth: 2,
            } as any} />
            <Box style={{ padding: 20, gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: 'theme:ink' }}>Card</Text>
              <Text style={{ fontSize: 12, color: 'theme:inkDim' }}>
                The accent border traces around the perimeter as it appears.
              </Text>
            </Box>
          </Box>
          <Text style={{ fontSize: 11, color: 'theme:inkDim' }}>
            borderDashOn: 0 → {Math.round(BORDER_PERIM)}px · easeOutCubic · 1200ms
          </Text>
        </Box>

        {/* Demo 2: continuous flow */}
        <Box style={{ flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: 'theme:inkDim' }}>CONTINUOUS FLOW</Text>
          <Box style={{
            width: BORDER_W, height: BORDER_H,
            borderRadius: BORDER_R,
            backgroundColor: 'theme:bg1',
            borderWidth: 0,
            borderColor: 'theme:accent',
            borderDashOn: 44,
            borderDashOff: 108,
            borderDashWidth: 2,
            borderFlowSpeed: 18,
          } as any}>
            <Box style={{ padding: 20, gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: 'theme:ink' }}>Card (live)</Text>
              <Text style={{ fontSize: 12, color: 'theme:inkDim' }}>
                Marching dashes — same pattern as GenericCardShell.
              </Text>
            </Box>
          </Box>
          <Text style={{ fontSize: 11, color: 'theme:inkDim' }}>
            borderDashOn: 44 · borderDashOff: 108 · borderFlowSpeed: 18 px/s
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Scene 4: SVG path trace
// ─────────────────────────────────────────────────────────────────────
//
// Reactive `d` recomputation. We define a poly-line path as a sequence of
// (x, y) anchors. Each frame, we compute total arc length, find the
// `t * total` point along it, and emit a `d` string up to that point. The
// <Graph.Path> re-renders on every frame as the string changes.
//
// This is the "drawn outwards" effect for vector content. Works today with
// no framework changes. The framework's svg_path.zig:drawStrokePartial is
// implemented but not yet exposed as a prop — when that lands, this scene
// becomes a single-prop affair.

const TRACE_MS = 1400;

// A signature-style path: capital letter + flourish underneath.
const TRACE_ANCHORS: [number, number][] = [
  [40, 120], [80, 40], [120, 120], [100, 90], [160, 90],     // "A"
  [180, 40], [180, 120],                                     // "I"
  [220, 120], [220, 40], [260, 40], [260, 80], [220, 80],    // partial "P"
  [300, 40], [300, 120], [340, 120],                          // "L"
  [40, 160], [120, 180], [220, 160], [320, 180], [400, 160], // flourish curve
];

function totalArcLength(pts: [number, number][]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    s += Math.sqrt(dx * dx + dy * dy);
  }
  return s;
}

function partialD(pts: [number, number][], t: number): string {
  if (t <= 0 || pts.length === 0) return '';
  const total = totalArcLength(pts);
  let target = total * t;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen <= target) {
      d += ` L ${pts[i][0]} ${pts[i][1]}`;
      target -= segLen;
    } else {
      const frac = target / segLen;
      const ex = pts[i - 1][0] + dx * frac;
      const ey = pts[i - 1][1] + dy * frac;
      d += ` L ${ex} ${ey}`;
      return d;
    }
    if (target <= 0) return d;
  }
  return d;
}

function TraceScene({ clock }: { clock: number }) {
  const [tracedAt, setTracedAt] = useState<number | null>(null);

  const trigger = () => setTracedAt(nowMs());

  let t = 0;
  if (tracedAt !== null) {
    const elapsed = nowMs() - tracedAt;
    t = Math.min(1, elapsed / TRACE_MS);
    t = easeOutCub(t);
  }

  const d = partialD(TRACE_ANCHORS, t);

  return (
    <Box style={{ flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: 32, gap: 24 }}>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ToolbarButton label="Draw"   active={false} onPress={trigger} />
        <ToolbarButton label="Reset"  active={false} onPress={() => setTracedAt(null)} />
      </Box>

      <Box style={{
        width: 480, height: 240,
        marginTop: 40,
        backgroundColor: 'theme:bg1',
        borderWidth: 1, borderColor: 'theme:rule',
        borderRadius: 12,
        padding: 16,
      }}>
        <Graph originTopLeft style={{ width: '100%', height: '100%' }}>
          {/* Faint ghost showing where the full path lands */}
          <Graph.Path
            d={partialD(TRACE_ANCHORS, 1)}
            stroke="theme:rule"
            strokeWidth={1.5}
            fill="none"
          />
          {/* Live trace */}
          {d ? (
            <Graph.Path
              d={d}
              stroke="theme:accent"
              strokeWidth={3}
              fill="none"
            />
          ) : null}
        </Graph>
      </Box>

      <Text style={{ fontSize: 11, color: 'theme:inkDim', maxWidth: 480, textAlign: 'center' }}>
        {'Reactive `d` recomputation — every frame we emit a `d` string truncated to `t * arcLength`. <Graph.Path> re-renders. easeOutCubic over 1400ms.'}
      </Text>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// App shell
// ─────────────────────────────────────────────────────────────────────

function Lab() {
  const [scene, setScene] = useState<Scene>('list');
  const clock = useMasterClock();

  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: 'theme:bg' }}>
      <Box style={{
        flexDirection: 'row', alignItems: 'center',
        paddingLeft: 16, paddingRight: 16, paddingTop: 14, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: 'theme:rule',
        backgroundColor: 'theme:bg1',
      }}>
        <GroupLabel>SCENE</GroupLabel>
        <ToolbarButton label="List"   active={scene === 'list'}   onPress={() => setScene('list')} />
        <ToolbarButton label="Menu"   active={scene === 'menu'}   onPress={() => setScene('menu')} />
        <ToolbarButton label="Wipe"   active={scene === 'wipe'}   onPress={() => setScene('wipe')} />
        <ToolbarButton label="Border" active={scene === 'border'} onPress={() => setScene('border')} />
        <ToolbarButton label="Trace"  active={scene === 'trace'}  onPress={() => setScene('trace')} />
      </Box>

      <Box style={{ flexGrow: 1 }}>
        {scene === 'list'   ? <ListScene   clock={clock} /> : null}
        {scene === 'menu'   ? <MenuScene   clock={clock} /> : null}
        {scene === 'wipe'   ? <WipeScene   clock={clock} /> : null}
        {scene === 'border' ? <BorderScene clock={clock} /> : null}
        {scene === 'trace'  ? <TraceScene  clock={clock} /> : null}
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <TooltipRoot>
      <Router initialPath="/">
        <Lab />
      </Router>
    </TooltipRoot>
  );
}
