import { useEffect, useRef } from 'react';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import Onboarding from './onboarding/Onboarding';
import { useOnboarding } from './onboarding/state';
import { TRAITS_BY_ID } from './onboarding/traits';
import { useAnimationTimeline } from './anim';
import { SnakeSpinner } from '../component-gallery/components/grid-spinners/GridSpinners';

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

type Cartridge = {
  id: string;
  title: string;
  subtitle: string;
  hint: string; // muted line under the subtitle, today indicates wiring state
};

const CARTRIDGES: Cartridge[] = [
  {
    id: 'sweatshop',
    title: 'Sweatshop',
    subtitle: 'Canvas + sequencer + cockpit',
    hint: 'Coming soon — cartridge ABI pending',
  },
  {
    id: 'gallery',
    title: 'Component gallery',
    subtitle: 'The storybook of typed shapes',
    hint: 'Coming soon — ships as a sibling cartridge',
  },
  {
    id: 'chatbot',
    title: 'Chatbot',
    subtitle: 'Non-agentic chat',
    hint: 'Planned — see docs/01-console-cartridges',
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

      {/* Cartridge selector — three placeholder tiles, one per planned
          cartridge. Today they're visual scaffolding; click handlers
          land when the cartridge ABI is wired into cart/app. */}
      <Box
        style={{
          flexDirection: 'row',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
      >
        {CARTRIDGES.map((c, i) => (
          <Box
            key={c.id}
            style={{
              opacity: tileOps[i],
              marginTop: (1 - tileOps[i]) * SLIDE_UP_PX,
            }}
          >
            <CartridgeTile cartridge={c} />
          </Box>
        ))}
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

// ── Cartridge tile ───────────────────────────────────────────────────
//
// Mirrors the visual language of `S.AppProviderTile` from Step2 so the
// homepage doesn't feel disjointed from onboarding. Click is a no-op
// for now — see TODO at the top of CARTRIDGES.

function CartridgeTile({ cartridge }: { cartridge: Cartridge }) {
  return (
    <S.AppProviderTile onPress={() => {}}>
      <S.AppProviderTileTitle>{cartridge.title}</S.AppProviderTileTitle>
      <S.AppProviderTileSubtitle>{cartridge.subtitle}</S.AppProviderTileSubtitle>
      <S.AppProviderTileSubtitle style={{ opacity: 0.6 }}>
        {cartridge.hint}
      </S.AppProviderTileSubtitle>
    </S.AppProviderTile>
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

