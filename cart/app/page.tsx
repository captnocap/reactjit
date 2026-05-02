import { useEffect, useRef } from 'react';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import Onboarding from './onboarding/Onboarding';
import { useOnboarding } from './onboarding/state';
import { useHudInsets } from './shell';
import { TRAITS_BY_ID } from './onboarding/traits';
import { useAnimationTimeline } from './anim';
import { SnakeSpinner } from '../component-gallery/components/grid-spinners/GridSpinners';
import { MenuGridSquareContent } from '../component-gallery/components/menu-grid-square/MenuGridSquare';
import type { MenuEntry } from '../component-gallery/data/menu-entry';

// ── Carryover entry timeline ─────────────────────────────────────────
//
// Right after Step5's exit transition, the home page mounts holding the
// "Welcome aboard." + spinner final frame at full opacity. We let it
// breathe for 500ms, fade it out over 900ms, then stagger in the home
// surface (greet → goal card → cartridge row) before flipping
// `homeEntryPlayed` so subsequent mounts skip straight to <HomeStatic>.

const T_CARRY_HOLD_END   = 500;
const T_CARRY_FADE_END   = 1400;
const T_GREET_END        = 1950;
const T_GOAL_END         = 2300;
const T_CART_TILE1_END   = 2650;
const T_CART_TILE2_END   = 2820;
const T_CART_TILE3_END   = 2990;
const T_PROFILE_END      = 3200;

const SLIDE_UP_PX        = 24;
const ENTRY_DONE_MS      = T_PROFILE_END + 80;

const HOME_MENU_ROWS: MenuEntry[] = [
  {
    id: 'sweatshop',
    key: '1',
    label: 'Sweatshop',
    hint: 'Canvas, sequencer, cockpit',
    glyph: 'S',
    status: 'live',
  },
  {
    id: 'gallery',
    key: '2',
    label: 'Gallery',
    hint: 'Typed component stories',
    glyph: 'G',
    status: 'idle',
  },
  {
    id: 'chatbot',
    key: '3',
    label: 'Chatbot',
    hint: 'Plain chat surface',
    glyph: 'C',
    status: 'idle',
  },
  {
    id: 'recipes',
    key: '4',
    label: 'Recipes',
    hint: 'Patterns and builds',
    glyph: 'R',
    status: 'idle',
  },
  {
    id: 'docs',
    key: '5',
    label: 'Docs',
    hint: 'Substrate notes',
    glyph: 'D',
    status: 'idle',
  },
  {
    id: 'about',
    key: '6',
    label: 'About',
    hint: 'Shell notes',
    glyph: 'A',
    status: 'mute',
  },
];

// ── Page entry ────────────────────────────────────────────────────────

export default function IndexPage() {
  const onb = useOnboarding();
  if (onb.loading) return null;

  if (!onb.complete) {
    return (
      <Onboarding
        step={onb.step}
        animate={onb.shouldPlayFirstStartAnimation}
        onAnimationDone={onb.markFirstStartAnimationPlayed}
      />
    );
  }

  if (!onb.homeEntryPlayed) return <HomeEntry />;
  return <HomeStatic />;
}

// ── HomeEntry ────────────────────────────────────────────────────────
//
// First-mount-after-onboarding render. Carries the Step5 exit final
// frame in (welcome message + spinner) and dissolves it into the home
// surface. After the timeline finishes we flip `homeEntryPlayed` so
// re-mounts (route revisits, reloads) render <HomeStatic /> directly.

function HomeEntry() {
  const onb = useOnboarding();
  const tl = useAnimationTimeline();

  const carryOp = tl.fadeOut(T_CARRY_HOLD_END, T_CARRY_FADE_END);
  const greetOp = tl.range(T_CARRY_FADE_END, T_GREET_END);
  const goalOp  = tl.range(T_GREET_END, T_GOAL_END);
  const tile1Op = tl.range(T_GOAL_END, T_CART_TILE1_END);
  const tile2Op = tl.range(T_CART_TILE1_END - 100, T_CART_TILE2_END);
  const tile3Op = tl.range(T_CART_TILE2_END - 100, T_CART_TILE3_END);
  const profOp  = tl.range(T_CART_TILE3_END, T_PROFILE_END);

  const onbRef = useRef(onb);
  onbRef.current = onb;

  useEffect(() => {
    const id = setTimeout(() => {
      try { onbRef.current.markHomeEntryPlayed(); } catch {}
    }, ENTRY_DONE_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <S.Page>
      <S.AppStepFrame>
        {/* Carryover "Welcome aboard." (centered) */}
        {carryOp > 0.001 ? (
          <S.AppStepCenter style={{ opacity: carryOp }}>
            <S.AppGreet>Welcome aboard.</S.AppGreet>
          </S.AppStepCenter>
        ) : null}

        {/* Carryover spinner — same anchor Step5 used. */}
        {carryOp > 0.001 ? (
          <S.AppStepBottomRight style={{ opacity: carryOp }}>
            <SnakeSpinner />
          </S.AppStepBottomRight>
        ) : null}

        <HomeBody
          greetOp={greetOp}
          goalOp={goalOp}
          tileOps={[tile1Op, tile2Op, tile3Op]}
          profileOp={profOp}
        />
      </S.AppStepFrame>
    </S.Page>
  );
}

// ── HomeStatic ────────────────────────────────────────────────────────
//
// Default home surface for returning users. Same render as HomeEntry's
// resolved state, with no animation phases.

function HomeStatic() {
  return (
    <S.Page>
      <S.AppStepFrame>
        <HomeBody
          greetOp={1}
          goalOp={1}
          tileOps={[1, 1, 1]}
          profileOp={1}
        />
      </S.AppStepFrame>
    </S.Page>
  );
}

// ── Home body — shared by HomeEntry + HomeStatic ─────────────────────

function HomeBody({
  greetOp,
  goalOp,
  tileOps,
  profileOp,
}: {
  greetOp: number;
  goalOp: number;
  tileOps: [number, number, number];
  profileOp: number;
}) {
  const onb = useOnboarding();
  const insets = useHudInsets();
  const name = (typeof onb.name === 'string' && onb.name.trim().length > 0)
    ? onb.name.trim()
    : 'there';
  const goal = typeof onb.goal === 'string' ? onb.goal.trim() : '';
  const configPath = typeof onb.configPath === 'string' ? onb.configPath.trim() : '';
  const traits: string[] = Array.isArray(onb.traits) ? onb.traits : [];
  const hasGoal = goal.length > 0;

  return (
    <Box
      style={{
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        paddingLeft: 32,
        paddingRight: 32,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Greeting */}
      <Box
        style={{
          opacity: greetOp,
          marginTop: (1 - greetOp) * SLIDE_UP_PX,
          alignItems: 'center',
        }}
      >
        <S.AppGreet>{`Hi, ${name}.`}</S.AppGreet>
      </Box>

      {/* Goal card — always present so the layout doesn't shift between
          "has goal" and "no goal" states. The body line varies. */}
      <Box
        style={{
          opacity: goalOp,
          marginTop: (1 - goalOp) * SLIDE_UP_PX,
          width: 720,
          maxWidth: '100%',
        }}
      >
        <S.Card>
          <S.Caption>{hasGoal ? 'Your first goal' : 'No goal yet'}</S.Caption>
          <S.Title>
            {hasGoal
              ? goal
              : "You can set one any time — Sweatshop will use it to anchor every plan."}
          </S.Title>
        </S.Card>
      </Box>

      {/* Launcher menu — uses the gallery's C1 tile menu as the initial
          loaded home surface. The rows include the planned cartridges and
          near-term app surfaces while routing/ABI wiring catches up. */}
      <Box
        style={{
          opacity: (tileOps[0] + tileOps[1] + tileOps[2]) / 3,
          marginTop: (1 - tileOps[0]) * SLIDE_UP_PX,
          width: 720,
          maxWidth: '100%',
          height: 360,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <MenuGridSquareContent rows={HOME_MENU_ROWS} />
      </Box>

      {/* Profile chip — proves the persistence: name, configPath,
          accommodations count. Subtle so it doesn't compete with the
          cartridge row. */}
      <Box
        style={{
          opacity: profileOp,
          marginTop: 8 + (1 - profileOp) * SLIDE_UP_PX,
          flexDirection: 'row',
          gap: 24,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <ProfileFact label="Config path" value={configPath || '—'} />
        <ProfileFact
          label="Accommodations"
          value={
            traits.length > 0
              ? `${traits.length} (${traits
                  .slice(0, 2)
                  .map((id) => TRAITS_BY_ID[id]?.label || id)
                  .join(', ')}${traits.length > 2 ? '…' : ''})`
              : '—'
          }
        />
      </Box>
    </Box>
  );
}

// ── Profile fact ─────────────────────────────────────────────────────

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <Box style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <S.Caption>{label}</S.Caption>
      <S.Body>{value}</S.Body>
    </Box>
  );
}
