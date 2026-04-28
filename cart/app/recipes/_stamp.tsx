// Recipe-stamp primitives — the JSX vocabulary for declaring a graph slice
// in a recipe `.tsx` file. Each component captures one row destined for the
// gallery data tables (cart/component-gallery/data/*.ts).
//
// ── Why JSX, not data ──────────────────────────────────────────────
// `cart/app/sequencer.md` calls for recipes in "JSX-stamp form": dropping
// `<RememberYourUsers />` on the canvas should expand into nodes. JSX is
// also the right shape for nesting (a Composition contains Slots; a Slot
// contains Sources; an EventHook contains Actions) — the parent-child
// container relationships in the gallery model map cleanly to JSX
// children.
//
// ── Static-walker model ────────────────────────────────────────────
// At read time these primitives are walked as a JSX AST — `createElement`
// returns inert `{type, props, children}` nodes a stamper introspects to
// emit data rows. They do not need to render to commit.
// At dev time we ALSO render them inside `<Recipe>`, which collects the
// deposit through context refs so a cart can preview / typecheck without
// a separate walker. The runtime is a stub today (the data form is the
// contract); wiring into the gallery store is the next pass.
//
// ── Primitive list ─────────────────────────────────────────────────
//   <Recipe slug=…>                       boundary; provides deposit context
//   <Composition id kind inheritsFrom?>   row in composition.ts
//     <Slot name composer maxTokens?>     nested in Composition
//       <Source kind ref? inlineValue? weight? />
//   <PromptFragment id label? body />     row in prompt-fragment.ts
//   <CompositionSourceKind id …>          row in composition-source-kind.ts
//   <EventHook match filter? label?>      row in event-hook.ts
//     <Action kind … />                   nested in EventHook
//   <Arming pattern tier reason? />       row in arming-recommendation
//                                         (sequencer-side, schema TBD)

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

// ── Deposit shape ─────────────────────────────────────────────────────────

export type CompositionKind =
  | "who"
  | "what-when"
  | "execution"
  | "prompt"
  | "context"
  | "custom";

export type ComposerRule =
  | "concat"
  | "wrap"
  | "best-of"
  | "first-match"
  | "merge-deduped"
  | "custom";

export type EmptyBehavior = "omit" | "placeholder" | "fail";

export type Tier = "T0" | "T1" | "T2" | "T3" | "T4";

export type EventHookActionKind =
  | "queue-job"
  | "spawn-worker"
  | "emit-event"
  | "mark-status"
  | "notify-user"
  | "cancel"
  | "custom";

export interface StampedSource {
  kind: string;
  ref?: string;
  inlineValue?: string;
  outputPort?: string;
  weight?: number;
}

export interface StampedSlot {
  name: string;
  composer: ComposerRule;
  maxTokens?: number;
  emptyBehavior?: EmptyBehavior;
  sources: StampedSource[];
}

export interface StampedComposition {
  id: string;
  kind: CompositionKind;
  customKindLabel?: string;
  label: string;
  description?: string;
  inheritsFromCompositionId?: string;
  slots: StampedSlot[];
}

export interface StampedFragment {
  id: string;
  label?: string;
  body: string;
}

export interface StampedSourceKind {
  id: string;
  label: string;
  description: string;
  applicableTo: CompositionKind[];
  refKind?: "row-id" | "inline-text" | "computed" | "composition-id" | "none";
}

export interface StampedAction {
  kind: EventHookActionKind;
  message?: string;
  spec?: Record<string, unknown>;
}

export interface StampedEventHookFilter {
  filePathEndsWith?: string;
  phase?: string;
  toolName?: string;
}

export interface StampedEventHook {
  match: string;
  filter?: StampedEventHookFilter;
  label?: string;
  actions: StampedAction[];
}

export interface StampedArming {
  pattern: string;
  tier: Tier;
  reason?: string;
}

export interface StampDeposit {
  slug: string;
  compositions: StampedComposition[];
  fragments: StampedFragment[];
  sourceKinds: StampedSourceKind[];
  eventHooks: StampedEventHook[];
  arming: StampedArming[];
}

// ── Contexts ──────────────────────────────────────────────────────────────

const RecipeCtx = createContext<StampDeposit | null>(null);
const CompositionCtx = createContext<StampedComposition | null>(null);
const SlotCtx = createContext<StampedSlot | null>(null);
const EventHookCtx = createContext<StampedEventHook | null>(null);

export function useRecipeDeposit(): StampDeposit | null {
  return useContext(RecipeCtx);
}

// ── Recipe boundary ───────────────────────────────────────────────────────

export function Recipe({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  // Single deposit object reused across renders — children mutate it during
  // render, then the caller can read it via `useRecipeDeposit()` after mount.
  const ref = useRef<StampDeposit>({
    slug,
    compositions: [],
    fragments: [],
    sourceKinds: [],
    eventHooks: [],
    arming: [],
  });
  // Reset between renders so the deposit reflects current children only.
  ref.current.compositions = [];
  ref.current.fragments = [];
  ref.current.sourceKinds = [];
  ref.current.eventHooks = [];
  ref.current.arming = [];
  return (
    <RecipeCtx.Provider value={ref.current}>{children}</RecipeCtx.Provider>
  );
}

// ── Composition ───────────────────────────────────────────────────────────

export interface CompositionProps {
  id: string;
  kind: CompositionKind;
  customKindLabel?: string;
  label: string;
  description?: string;
  inheritsFrom?: string;
  children?: ReactNode;
}

export function Composition({
  id,
  kind,
  customKindLabel,
  label,
  description,
  inheritsFrom,
  children,
}: CompositionProps) {
  const deposit = useContext(RecipeCtx);
  const comp = useMemo<StampedComposition>(
    () => ({
      id,
      kind,
      customKindLabel,
      label,
      description,
      inheritsFromCompositionId: inheritsFrom,
      slots: [],
    }),
    [id, kind, customKindLabel, label, description, inheritsFrom],
  );
  if (deposit) {
    comp.slots = []; // reset for this render pass
    deposit.compositions.push(comp);
  }
  return <CompositionCtx.Provider value={comp}>{children}</CompositionCtx.Provider>;
}

// ── Slot ──────────────────────────────────────────────────────────────────

export interface SlotProps {
  name: string;
  composer?: ComposerRule;
  maxTokens?: number;
  emptyBehavior?: EmptyBehavior;
  children?: ReactNode;
}

export function Slot({
  name,
  composer = "concat",
  maxTokens,
  emptyBehavior = "omit",
  children,
}: SlotProps) {
  const comp = useContext(CompositionCtx);
  const slot = useMemo<StampedSlot>(
    () => ({ name, composer, maxTokens, emptyBehavior, sources: [] }),
    [name, composer, maxTokens, emptyBehavior],
  );
  if (comp) {
    slot.sources = [];
    comp.slots.push(slot);
  }
  return <SlotCtx.Provider value={slot}>{children}</SlotCtx.Provider>;
}

// ── Source ────────────────────────────────────────────────────────────────

export interface SourceProps extends StampedSource {}

export function Source(props: SourceProps) {
  const slot = useContext(SlotCtx);
  if (slot) slot.sources.push({ ...props });
  return null;
}

// ── PromptFragment ────────────────────────────────────────────────────────

export function PromptFragment({
  id,
  label,
  body,
}: {
  id: string;
  label?: string;
  body: string;
}) {
  const deposit = useContext(RecipeCtx);
  if (deposit) deposit.fragments.push({ id, label, body });
  return null;
}

// ── CompositionSourceKind ─────────────────────────────────────────────────

export function CompositionSourceKind({
  id,
  label,
  description,
  applicableTo,
  refKind,
}: StampedSourceKind) {
  const deposit = useContext(RecipeCtx);
  if (deposit)
    deposit.sourceKinds.push({ id, label, description, applicableTo, refKind });
  return null;
}

// ── EventHook ─────────────────────────────────────────────────────────────

export interface EventHookProps {
  match: string;
  filter?: StampedEventHookFilter;
  label?: string;
  children?: ReactNode;
}

export function EventHook({ match, filter, label, children }: EventHookProps) {
  const deposit = useContext(RecipeCtx);
  const hook = useMemo<StampedEventHook>(
    () => ({ match, filter, label, actions: [] }),
    [match, filter, label],
  );
  if (deposit) {
    hook.actions = [];
    deposit.eventHooks.push(hook);
  }
  return <EventHookCtx.Provider value={hook}>{children}</EventHookCtx.Provider>;
}

// ── Action (child of EventHook) ───────────────────────────────────────────

export interface ActionProps {
  kind: EventHookActionKind;
  message?: string;
  spec?: Record<string, unknown>;
}

export function Action(props: ActionProps) {
  const hook = useContext(EventHookCtx);
  if (hook) hook.actions.push({ ...props });
  return null;
}

// ── Arming (recommended pathology arming + tier) ──────────────────────────

export function Arming(props: StampedArming) {
  const deposit = useContext(RecipeCtx);
  if (deposit) deposit.arming.push({ ...props });
  return null;
}
