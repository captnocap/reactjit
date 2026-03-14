// Breakpoint rendering regression suite.
//
// Goal:
// 1. Sweep a responsive story from 300px-wide mobile through 4K desktop.
// 2. Fail on real overflow/off-viewport regressions inside the story subtree.
// 3. Flag large nodes that stay effectively fixed-size across breakpoint jumps.
//
// Run:
//   cd storybook && rjit build && rjit test tests/breakpoint-rendering.test.ts --timeout=90

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

type QueryNode = {
  id: number;
  type: string;
  debugName: string;
  props: Record<string, any>;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type ViewportCase = {
  label: string;
  width: number;
  height: number;
};

type AuditViolation = {
  rule: string;
  severity: string;
  message: string;
};

const bridge = (globalThis as any).__rjitBridge as RpcBridge | undefined;

const TARGET_STORY_TITLE = 'Layout';
const TARGET_READY_TEXT = 'Put that there, I mean there';
const STORY_QUERY_TYPES = [
  'LayoutStory',
  'StoryPage',
  'StorySection',
  'Band',
  'Half',
  'HeroBand',
  'CalloutBand',
];

const BREAKPOINT_SWEEP: ViewportCase[] = [
  { label: '300w', width: 300, height: 500 },
  { label: '320w', width: 320, height: 568 },
  { label: '360w', width: 360, height: 640 },
  { label: '390w', width: 390, height: 844 },
  { label: '414w', width: 414, height: 896 },
  { label: '480w', width: 480, height: 800 },
  { label: '639w', width: 639, height: 900 },
  { label: '640w', width: 640, height: 900 },
  { label: '768w', width: 768, height: 1024 },
  { label: '1023w', width: 1023, height: 900 },
  { label: '1024w', width: 1024, height: 900 },
  { label: '1280w', width: 1280, height: 900 },
  { label: '1439w', width: 1439, height: 960 },
  { label: '1440w', width: 1440, height: 960 },
  { label: '1920w', width: 1920, height: 1080 },
  { label: '2560w', width: 2560, height: 1440 },
  { label: '3200w', width: 3200, height: 1800 },
  { label: '3840w', width: 3840, height: 2160 },
];

const SCALE_SNAPSHOTS: ViewportCase[] = [
  { label: 'sm', width: 320, height: 568 },
  { label: 'md', width: 640, height: 900 },
  { label: 'lg', width: 1024, height: 900 },
  { label: 'xl', width: 1440, height: 960 },
  { label: '4k', width: 3840, height: 2160 },
];

let resolvedScopeType: string | null = null;

function requireBridge(): RpcBridge {
  if (!bridge) {
    throw new Error('Missing __rjitBridge; breakpoint tests require native bridge setup');
  }
  return bridge;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function nodeLabel(node: QueryNode): string {
  const text = (node.text || '').replace(/\s+/g, ' ').trim();
  const snippet = text.length > 32 ? `${text.slice(0, 32)}...` : text;
  const name = node.debugName || node.type;
  return snippet ? `${name}#${node.id} "${snippet}"` : `${name}#${node.id}`;
}

async function setViewport(width: number, height: number): Promise<void> {
  await requireBridge().rpc('window:setSize', { width, height });
  await page.wait(4);
}

async function queryByType(type: string): Promise<QueryNode[]> {
  return (await requireBridge().rpc<QueryNode[]>('test:query', { type })) || [];
}

async function storyIsOpen(): Promise<boolean> {
  try {
    await expect(page.find('Text', { children: TARGET_READY_TEXT })).toBeVisible();
    return true;
  } catch {
    return false;
  }
}

async function ensureStoryOpen(): Promise<void> {
  await setViewport(1440, 960);
  if (await storyIsOpen()) return;
  await page.find('Text', { children: TARGET_STORY_TITLE }).click();
  await page.wait(6);
  await expect(page.find('Text', { children: TARGET_READY_TEXT })).toBeVisible();
}

async function resolveScopeType(): Promise<string> {
  if (resolvedScopeType) return resolvedScopeType;
  for (const type of STORY_QUERY_TYPES) {
    const matches = await queryByType(type);
    if (matches.length > 0) {
      resolvedScopeType = type;
      return type;
    }
  }
  throw new Error(`Unable to resolve a query scope for ${TARGET_STORY_TITLE}`);
}

async function collectStoryNodes(): Promise<QueryNode[]> {
  const byId = new Map<number, QueryNode>();
  for (const type of STORY_QUERY_TYPES) {
    const nodes = await queryByType(type);
    for (const node of nodes) {
      if (node.w <= 0 || node.h <= 0) continue;
      byId.set(node.id, node);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

function relevantViolations(violations: AuditViolation[]): AuditViolation[] {
  return violations.filter(v => v.rule === 'child-overflow' || v.rule === 'off-viewport');
}

function formatViewport(vp: ViewportCase): string {
  return `${vp.label} (${vp.width}x${vp.height})`;
}

function formatViolationsByViewport(failures: Array<{ viewport: ViewportCase; violations: AuditViolation[] }>): string {
  return failures
    .map(({ viewport, violations }) => {
      const lines = violations.slice(0, 5).map(v => `[${v.severity}] ${v.rule}: ${v.message}`);
      const extra = violations.length > 5 ? ` (+${violations.length - 5} more)` : '';
      return `${formatViewport(viewport)}\n${lines.join('\n')}${extra}`;
    })
    .join('\n\n');
}

function findLargeFixedNodes(
  snapshots: Array<{ viewport: ViewportCase; nodes: QueryNode[] }>,
): Array<{
  node: QueryNode;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  minViewportShare: number;
}> {
  if (snapshots.length < 2) return [];

  const ids = new Set<number>(snapshots[0].nodes.map(node => node.id));
  for (const snap of snapshots.slice(1)) {
    const present = new Set<number>(snap.nodes.map(node => node.id));
    for (const id of Array.from(ids)) {
      if (!present.has(id)) ids.delete(id);
    }
  }

  const suspects: Array<{
    node: QueryNode;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    minViewportShare: number;
  }> = [];

  for (const id of ids) {
    const entries = snapshots
      .map(snap => snap.nodes.find(node => node.id === id))
      .filter(Boolean) as QueryNode[];

    if (entries.length !== snapshots.length) continue;

    const sample = entries[0];
    if (sample.type === 'Text' || sample.type === '__TEXT__') continue;

    const widths = entries.map(node => node.w);
    const heights = entries.map(node => node.h);
    const minWidth = Math.min(...widths);
    const maxWidth = Math.max(...widths);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);

    const widthGrowth = maxWidth / Math.max(1, minWidth);
    const heightGrowth = maxHeight / Math.max(1, minHeight);
    const minViewportShare = Math.max(
      ...entries.map((node, index) => Math.max(
        node.w / snapshots[index].viewport.width,
        node.h / snapshots[index].viewport.height,
      )),
    );

    const isLarge = maxWidth >= 160 || maxHeight >= 96;
    const barelyScales = widthGrowth < 1.15 && heightGrowth < 1.15;
    const dominatesSmallViewport = minViewportShare >= 0.2;

    if (isLarge && barelyScales && dominatesSmallViewport) {
      suspects.push({
        node: sample,
        minWidth,
        maxWidth,
        minHeight,
        maxHeight,
        minViewportShare,
      });
    }
  }

  return suspects.sort((a, b) => b.minViewportShare - a.minViewportShare);
}

test('open the Layout story for breakpoint sweeps', async () => {
  await ensureStoryOpen();
  const scopeType = await resolveScopeType();
  const nodes = await collectStoryNodes();
  if (nodes.length < 10) {
    throw new Error(`Expected at least 10 story-local nodes, found ${nodes.length}`);
  }
  console.log(`[breakpoints] scope=${scopeType} nodes=${nodes.length}`);
});

test('Layout story does not overflow from 300px to 4K', async () => {
  await ensureStoryOpen();
  const scopeType = await resolveScopeType();

  const failures: Array<{ viewport: ViewportCase; violations: AuditViolation[] }> = [];

  for (const viewport of BREAKPOINT_SWEEP) {
    await setViewport(viewport.width, viewport.height);
    const audit = await page.audit({ scope: { type: scopeType } });
    const violations = relevantViolations(audit.violations as AuditViolation[]);
    if (violations.length > 0) {
      failures.push({ viewport, violations });
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Breakpoint overflow audit failed for ${failures.length} viewport(s):\n\n${formatViolationsByViewport(failures)}`,
    );
  }
});

test('Layout story does not keep large nodes fixed-size across breakpoint jumps', async () => {
  await ensureStoryOpen();

  const snapshots: Array<{ viewport: ViewportCase; nodes: QueryNode[] }> = [];

  for (const viewport of SCALE_SNAPSHOTS) {
    await setViewport(viewport.width, viewport.height);
    const nodes = await collectStoryNodes();
    snapshots.push({ viewport, nodes });
  }

  const suspects = findLargeFixedNodes(snapshots);
  if (suspects.length > 0) {
    const details = suspects
      .slice(0, 10)
      .map(({ node, minWidth, maxWidth, minHeight, maxHeight, minViewportShare }) => (
        `${nodeLabel(node)} :: ` +
        `w ${round(minWidth)}->${round(maxWidth)}, ` +
        `h ${round(minHeight)}->${round(maxHeight)}, ` +
        `max viewport share ${round(minViewportShare * 100)}%`
      ))
      .join('\n');

    throw new Error(
      `Found ${suspects.length} large node(s) that stay effectively fixed-size across breakpoints:\n${details}`,
    );
  }
});
