// Character creator — form MVP.
//
// One scrollable page with sectioned form fields. No journey, no
// animations, no themed transitions. Once everything round-trips
// through the provider, the journey-shape lab can be built as a
// visual disguise that wraps these same setters.
//
// Every theme-touching surface is a classifier from
// `cart/component-gallery/components.cls.ts`. No hex literals — all
// colors flow through `theme:*` tokens via the classifiers, so the
// page re-themes for free when the active gallery theme variant flips.
//
// Layout (left column = form, right column = avatar preview):
//   Identity (name / displayName / bio)
//   Archetype (6 cards; click seeds dials + quirks + stances)
//   Dials (12 rows × 11-cell discrete slider)
//   Quirks (8 toggle chips)
//   Stance triad (3 segmented rows)
//   Boundary rules (multi-select chips)
//   Save

import { useRef } from 'react';
import { Box, Col, Row, ScrollView } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { Avatar } from '@reactjit/runtime/avatar';
import { CharacterProvider, useCharacter } from './state';
import { useAnimationTimeline } from '../anim';
import {
  ARCHETYPES,
  BOUNDARY_RULES,
  CORRECTIONS,
  DIALS,
  DEFAULT_AVATAR,
  INITIATIVES,
  QUIRKS,
  STANCES,
} from './catalog';

// ── Animation helpers ────────────────────────────────────────────────
//
// Two layers per the app.md "Animation principles":
//   • Page-level Fade — route content swap inside the stable shell.
//   • Per-section Spring stagger — each Section tile springs in (opacity
//     0→1 + small marginTop slide) eased by easeOutBack, with a 60ms
//     stagger between siblings. Same envelope as cart/app/page.tsx's
//     home-entry sequence; one master `useAnimationTimeline` drives every
//     range to keep the RAF loop count at 1.

const SECTION_DUR_MS = 380;     // one section's spring entry duration
const SECTION_STAGGER_MS = 60;  // gap between section start times
const SECTION_SLIDE_PX = 12;    // how far each section rises during entry
const HEAD_DUR_MS = 300;        // page heading fade
const PAGE_FADE_MS = 350;       // content-area fade-in

function Stagger({ progress, children }: { progress: number; children: any }) {
  // Spring envelope: opacity ramps with progress; the section starts
  // SECTION_SLIDE_PX below its resting position and rises into place.
  return (
    <Box style={{
      opacity: progress,
      marginTop: (1 - progress) * SECTION_SLIDE_PX,
    }}>
      {children}
    </Box>
  );
}

// ── Small primitives ──────────────────────────────────────────────────

function SectionTitle({ label, kicker }: { label: string; kicker?: string }) {
  return (
    <Col style={{ marginTop: 18, marginBottom: 8, gap: 4 }}>
      <S.Label style={{ color: 'theme:accentHot' }}>{label}</S.Label>
      {kicker ? <S.Caption>{kicker}</S.Caption> : null}
    </Col>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const Tile = active ? S.AppTraitChipActive : S.AppTraitChip;
  const Text_ = active ? S.AppTraitChipTextActive : S.AppTraitChipText;
  return (
    <Tile onPress={onPress}>
      <Text_>{label}</Text_>
    </Tile>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { id: T; label: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <Chip key={o.id} label={o.label} active={o.id === value} onPress={() => onPick(o.id)} />
      ))}
    </Row>
  );
}

function ArchetypeCard({
  label,
  description,
  active,
  onPress,
}: {
  label: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  const Tile = active ? S.AppProviderTileActive : S.AppProviderTile;
  const Title_ = active ? S.AppProviderTileTitleActive : S.AppProviderTileTitle;
  return (
    <Tile onPress={onPress}>
      <Col style={{ gap: 4 }}>
        <Title_>{label}</Title_>
        <S.AppProviderTileSubtitle>{description}</S.AppProviderTileSubtitle>
      </Col>
    </Tile>
  );
}

// ── Discrete slider — 11 cells (0.0..1.0 in 0.1 steps) ────────────────
//
// Reuses the AppStepCube classifiers from the onboarding step indicator —
// same visual language ("the discrete value at index N is here") repeated
// per axis.

const SLIDER_STEPS = 11;

function DiscreteSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const idx = Math.round(value * (SLIDER_STEPS - 1));
  return (
    <S.AppStepCubeRow style={{ flexGrow: 1 }}>
      {Array.from({ length: SLIDER_STEPS }, (_v, i) => {
        const stepValue = i / (SLIDER_STEPS - 1);
        const Cube = i === idx
          ? S.AppStepCubeCurrent
          : i === Math.floor((SLIDER_STEPS - 1) / 2)
            ? S.AppStepCubePast
            : S.AppStepCubeFuture;
        return <Cube key={i} onPress={() => onChange(stepValue)} />;
      })}
    </S.AppStepCubeRow>
  );
}

// ── Section components ────────────────────────────────────────────────

function IdentitySection() {
  const c = useCharacter();
  // Refs read live state from inside controlled inputs (Pressable stale-
  // closure pattern; same idea for TextInput's onChangeText).
  const nameRef = useRef(c.character.name);
  const displayRef = useRef(c.character.displayName ?? '');
  const bioRef = useRef(c.character.bio ?? '');
  nameRef.current = c.character.name;
  displayRef.current = c.character.displayName ?? '';
  bioRef.current = c.character.bio ?? '';

  return (
    <S.Card>
      <Col style={{ gap: 4 }}>
        <S.Label>Name</S.Label>
        <S.AppFormInput
          value={c.character.name}
          placeholder="Sage"
          onChangeText={(t: string) => { nameRef.current = t; void c.setName(t); }}
        />
      </Col>
      <Col style={{ gap: 4 }}>
        <S.Label>Display name</S.Label>
        <S.AppFormInput
          value={c.character.displayName ?? ''}
          placeholder="(optional shortname)"
          onChangeText={(t: string) => { displayRef.current = t; void c.setDisplayName(t); }}
        />
      </Col>
      <Col style={{ gap: 4 }}>
        <S.Label>Bio (one line)</S.Label>
        <S.AppFormInput
          value={c.character.bio ?? ''}
          placeholder="Concise, willing to disagree, signs off with a closing thought."
          onChangeText={(t: string) => { bioRef.current = t; void c.setBio(t); }}
        />
      </Col>
    </S.Card>
  );
}

function ArchetypeSection() {
  const c = useCharacter();
  return (
    <S.Card>
      <S.Caption>
        Pick a starting voice. Seeds dials + quirks + stances. You can change anything below afterward.
      </S.Caption>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {ARCHETYPES.map((a) => (
          <ArchetypeCard
            key={a.id}
            label={a.label}
            description={a.description}
            active={c.character.archetypeId === a.id}
            onPress={() => void c.setArchetype(a.id)}
          />
        ))}
      </Row>
    </S.Card>
  );
}

function DialsSection() {
  const c = useCharacter();
  return (
    <S.Card>
      <S.Caption>
        Twelve bipolar axes. Mid-range values (around 0.5) contribute nothing — push toward a pole to fire that voice fragment.
      </S.Caption>
      {DIALS.map((d) => {
        const v = c.character.dialValues[d.id] ?? d.defaultValue;
        return (
          <Row key={d.id} style={{ gap: 12, alignItems: 'center' }}>
            <Box style={{ width: 110 }}>
              <S.Body style={{ textAlign: 'right' }}>{d.left}</S.Body>
            </Box>
            <DiscreteSlider value={v} onChange={(next) => void c.setDialValue(d.id, next)} />
            <Box style={{ width: 110 }}>
              <S.Body>{d.right}</S.Body>
            </Box>
            <Box style={{ width: 36 }}>
              <S.Caption style={{ textAlign: 'right' }}>{v.toFixed(2)}</S.Caption>
            </Box>
          </Row>
        );
      })}
    </S.Card>
  );
}

function QuirksSection() {
  const c = useCharacter();
  return (
    <S.Card>
      <S.Caption>Toggle on the quirks this character carries.</S.Caption>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {QUIRKS.map((q) => (
          <Chip
            key={q.id}
            label={q.label}
            active={c.character.quirkIds.includes(q.id)}
            onPress={() => void c.toggleQuirk(q.id)}
          />
        ))}
      </Row>
    </S.Card>
  );
}

function StanceTriadSection() {
  const c = useCharacter();
  return (
    <S.Card>
      <Col style={{ gap: 6 }}>
        <S.Label>Relationship stance</S.Label>
        <Segmented options={STANCES} value={c.character.relationshipStance} onPick={(s) => void c.setRelationshipStance(s)} />
      </Col>
      <Col style={{ gap: 6 }}>
        <S.Label>Initiative profile</S.Label>
        <Segmented options={INITIATIVES} value={c.character.initiativeProfile} onPick={(p) => void c.setInitiativeProfile(p)} />
      </Col>
      <Col style={{ gap: 6 }}>
        <S.Label>Correction style</S.Label>
        <Segmented options={CORRECTIONS} value={c.character.correctionStyle} onPick={(s) => void c.setCorrectionStyle(s)} />
      </Col>
    </S.Card>
  );
}

function BoundariesSection() {
  const c = useCharacter();
  return (
    <S.Card>
      <S.Caption>
        Boundary rules travel with the character. These reuse the existing Constraint shape — no parallel type.
      </S.Caption>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {BOUNDARY_RULES.map((b) => (
          <Chip
            key={b.id}
            label={b.label}
            active={c.character.boundaryRuleIds.includes(b.id)}
            onPress={() => void c.toggleBoundaryRule(b.id)}
          />
        ))}
      </Row>
    </S.Card>
  );
}

function SaveBar() {
  const c = useCharacter();
  return (
    <Row style={{ gap: 12, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 14 }}>
      <S.Caption>Version {c.character.version}</S.Caption>
      <S.Button onPress={() => void c.save()}>
        <S.ButtonLabel>Save character</S.ButtonLabel>
      </S.Button>
    </Row>
  );
}

// ── Avatar preview column ─────────────────────────────────────────────

function AvatarPreview() {
  const c = useCharacter();
  return (
    <Col style={{ gap: 10 }}>
      <S.Card>
        <S.Label style={{ color: 'theme:accentHot' }}>PREVIEW</S.Label>
        {/* Explicit pixel dimensions on the Avatar (and its inner Scene3D)
            so the host paints the render-to-texture quad at exactly that
            size — relying on overflow:hidden of a wrapper Box doesn't clip
            the GPU quad, since the quad is positioned by the scene3d
            node's own layout box, not the parent's. */}
        <Box style={{ width: 320, height: 360, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <Avatar
            avatar={DEFAULT_AVATAR}
            style={{ width: 320, height: 360, position: 'absolute', inset: 0 }}
            cameraPosition={[0, 1.0, 3.8]}
            cameraTarget={[0, 0.85, 0]}
            cameraFov={48}
          />
        </Box>
        <S.Heading>{c.character.name || '(unnamed)'}</S.Heading>
        {c.character.displayName ? <S.BodyDim>aka {c.character.displayName}</S.BodyDim> : null}
        {c.character.bio ? <S.BodyDim>{c.character.bio}</S.BodyDim> : null}
      </S.Card>
      <S.Card>
        <Col style={{ gap: 4 }}>
          <S.Label>Stance</S.Label>
          <S.Body>{c.character.relationshipStance}</S.Body>
          <Box style={{ height: 4 }} />
          <S.Label>Initiative</S.Label>
          <S.Body>{c.character.initiativeProfile}</S.Body>
          <Box style={{ height: 4 }} />
          <S.Label>Correction</S.Label>
          <S.Body>{c.character.correctionStyle}</S.Body>
          <Box style={{ height: 4 }} />
          <S.Label>Quirks</S.Label>
          <S.Body>{c.character.quirkIds.length === 0 ? '—' : c.character.quirkIds.join(', ')}</S.Body>
          <Box style={{ height: 4 }} />
          <S.Label>Boundaries</S.Label>
          <S.Body>{c.character.boundaryRuleIds.length === 0 ? '—' : c.character.boundaryRuleIds.length + ' active'}</S.Body>
        </Col>
      </S.Card>
    </Col>
  );
}

// ── Page body ─────────────────────────────────────────────────────────

function CharacterForm() {
  const c = useCharacter();
  // Single master timeline. All page-level fades + section springs read
  // ranges off this one RAF loop.
  const tl = useAnimationTimeline();
  if (c.loading) {
    return (
      <S.Page>
        <Box style={{ padding: 28, opacity: tl.range(0, 200, 'easeOutCubic') }}>
          <S.Caption>Loading character…</S.Caption>
        </Box>
      </S.Page>
    );
  }

  // Page Fade — the content-area fades in as a route swap.
  const pageOp = tl.range(0, PAGE_FADE_MS, 'easeOutCubic');
  // Heading Fade — slightly quicker than the page fade; lands first.
  const headOp = tl.range(0, HEAD_DUR_MS, 'easeOutCubic');
  // Per-section Spring stagger — each section's entry window starts
  // SECTION_STAGGER_MS later than the previous one.
  const phase = (i: number) => {
    const start = 80 + i * SECTION_STAGGER_MS;
    return tl.range(start, start + SECTION_DUR_MS, 'easeOutBack');
  };
  return (
    <S.Page>
      <Row style={{ width: '100%', height: '100%', alignItems: 'stretch' }}>
        {/* Form column — scrolls. ScrollView needs an explicit height per
            the layout rules; height:100% inherits from the parent Row. */}
        <ScrollView style={{ flexGrow: 1, flexBasis: 0, height: '100%', opacity: pageOp }}>
          <Box style={{
            paddingTop: 28, paddingBottom: 28,
            paddingLeft: 28, paddingRight: 14,
          }}>
            <Box style={{ opacity: headOp }}>
              <Col style={{ gap: 4 }}>
                <S.Title>CHARACTER CREATOR</S.Title>
                <S.Caption>
                  Form MVP. Once the round-trip is solid, the journey-shape (Casting Call → Mixing Booth → Dressing Room → Boundary Desk → First Words) layers on top of the same setters.
                </S.Caption>
              </Col>
            </Box>

            <Stagger progress={phase(0)}>
              <SectionTitle label="01 IDENTITY" kicker="Name + display + one-line bio." />
              <IdentitySection />
            </Stagger>

            <Stagger progress={phase(1)}>
              <SectionTitle label="02 ARCHETYPE" kicker="Starting voice template." />
              <ArchetypeSection />
            </Stagger>

            <Stagger progress={phase(2)}>
              <SectionTitle label="03 DIALS" kicker="Twelve bipolar axes." />
              <DialsSection />
            </Stagger>

            <Stagger progress={phase(3)}>
              <SectionTitle label="04 QUIRKS" kicker="Categorical voice rules." />
              <QuirksSection />
            </Stagger>

            <Stagger progress={phase(4)}>
              <SectionTitle label="05 STANCE" kicker="How this character relates / drives / corrects." />
              <StanceTriadSection />
            </Stagger>

            <Stagger progress={phase(5)}>
              <SectionTitle label="06 BOUNDARIES" kicker="Constraints that travel with this character." />
              <BoundariesSection />
            </Stagger>

            <Stagger progress={phase(6)}>
              <SaveBar />
            </Stagger>
          </Box>
        </ScrollView>

        {/* Preview column — pinned, never scrolls. Stays in view while
            the form column scrolls behind/beside it. Fade-in keyed on
            the same master timeline as the form. */}
        <Box style={{
          width: 360,
          height: '100%',
          paddingTop: 28, paddingBottom: 28,
          paddingLeft: 14, paddingRight: 28,
          opacity: pageOp,
        }}>
          <AvatarPreview />
        </Box>
      </Row>
    </S.Page>
  );
}

export default function CharacterPage() {
  return (
    <CharacterProvider>
      <CharacterForm />
    </CharacterProvider>
  );
}
