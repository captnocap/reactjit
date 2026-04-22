// framework/autotest/self_probe.ts
//
// Self-probe walker/logger entry point. Injected into every cart bundle
// via the esbuild `inject` list in scripts/build-bundle.mjs. Pairs with
// the six host-fn stubs in framework/v8_bindings_autotest.zig
// (__probe_tree, __probe_click, __probe_type, __probe_drag,
// __probe_scroll, __probe_hash).
//
// This turn: walk __probe_tree(), classify each node, emit a plan and
// the initial scene-graph hash as JSON lines on stdout. Does NOT exercise
// any affordances yet — that's the next turn. Output is deliberately
// structured JSON so scripts/ship can diff it against a committed
// <cart>.autotest.snap baseline without line-noise.
//
// Host wiring: registers __self_probe_main on globalThis. v8_app.zig will
// invoke it when the --self-probe argv flag lands in a subsequent commit.

type ProbeNode = {
  id?: string;
  type?: string;
  rect?: { x: number; y: number; w: number; h: number };
  text?: string;
  pressableSubscribed?: boolean;
  textInputSubscribed?: boolean;
  scrollable?: boolean;
};

type HostProbe = {
  __probe_tree?: () => ProbeNode[];
  __probe_click?: (id?: string) => unknown;
  __probe_type?: (id?: string, text?: string) => unknown;
  __probe_drag?: (id?: string, dx?: number, dy?: number) => unknown;
  __probe_scroll?: (id?: string, dy?: number) => unknown;
  __probe_hash?: () => string;
};

// One animation frame at 60Hz. Sleeping between ops lets the reconciler
// commit + the Zig host layout/paint before we snapshot the hash.
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 16));
}

export async function __self_probe_main(): Promise<void> {
  const g = globalThis as unknown as HostProbe;
  const tree: ProbeNode[] = (g.__probe_tree && g.__probe_tree()) || [];
  const pressables = tree.filter((n) => n && n.pressableSubscribed === true);
  const inputs = tree.filter((n) => n && n.textInputSubscribed === true);
  const scrollables = tree.filter((n) => n && n.scrollable === true);

  console.log(JSON.stringify({
    event: 'self-probe-plan',
    total: tree.length,
    pressables: pressables.length,
    inputs: inputs.length,
    scrollables: scrollables.length,
    // Op budget the next turn's exercise loop will target: one click per
    // pressable, one type per input, three scroll steps per scrollable.
    estimated_ops: pressables.length + inputs.length + scrollables.length * 3,
  }));

  const initialHash = (g.__probe_hash && g.__probe_hash()) || '00000000';
  console.log(JSON.stringify({ event: 'initial-hash', hash: initialHash }));

  // Pressables — one click each, one-frame wait, hash after. Inputs +
  // scrollables land in follow-up turns once we confirm this loop shape
  // plays nicely with the reconciler commit cycle.
  for (const node of pressables) {
    if (g.__probe_click) g.__probe_click(node.id);
    await nextFrame();
    const hash = (g.__probe_hash && g.__probe_hash()) || '00000000';
    console.log(JSON.stringify({ event: 'click', id: node.id, hash }));
  }

  console.log(JSON.stringify({ event: 'self-probe-pressables-complete', count: pressables.length }));
}

// Register globally so v8_app.zig can invoke it when --self-probe is set.
// The assignment runs at module-init time; esbuild's inject pulls this file
// into every cart bundle when any of its named exports is referenced.
(globalThis as any).__self_probe_main = __self_probe_main;
