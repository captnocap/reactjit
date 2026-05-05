// =============================================================================
// PLAN CANVAS — data model + persistence for collaborative human-AI planning
// =============================================================================

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : () => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : () => {};
const storeDel = typeof host.__store_del === 'function' ? host.__store_del : () => {};

const STORE_LIST_KEY = 'sweatshop:plans:list';
const STORE_PREFIX = 'sweatshop:plan:';

export interface PlanItem {
  id: string;
  text: string;
  status: 'idea' | 'todo' | 'doing' | 'done' | 'blocked' | 'review';
  author: 'human' | 'ai' | 'system';
  createdAt: number;
  updatedAt: number;
  tags: string[];
  linkedFile?: string;
  parentId?: string;
  x: number;
  y: number;
  note?: string;
}

export interface Plan {
  id: string;
  title: string;
  items: PlanItem[];
  createdAt: number;
}

function planKey(planId: string): string {
  return STORE_PREFIX + planId;
}

function loadPlanIds(): string[] {
  const raw = storeGet(STORE_LIST_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function savePlanIds(ids: string[]): void {
  storeSet(STORE_LIST_KEY, JSON.stringify(ids));
}

export function loadPlans(): Plan[] {
  const ids = loadPlanIds();
  const plans: Plan[] = [];
  for (const id of ids) {
    const raw = storeGet(planKey(id));
    if (!raw) continue;
    try {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.items)) plans.push(p);
    } catch {}
  }
  return plans;
}

export function savePlan(plan: Plan): void {
  const ids = loadPlanIds();
  if (!ids.includes(plan.id)) {
    ids.push(plan.id);
    savePlanIds(ids);
  }
  storeSet(planKey(plan.id), JSON.stringify(plan));
}

export function deletePlan(planId: string): void {
  const ids = loadPlanIds().filter((id: string) => id !== planId);
  savePlanIds(ids);
  storeDel(planKey(planId));
}

export function createPlan(planTitle: string): Plan {
  const plan: Plan = {
    id: 'plan_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    title: planTitle,
    items: [],
    createdAt: Date.now(),
  };
  savePlan(plan);
  return plan;
}

const GRID = 20;

function snap(n: number): number {
  return Math.round(n / GRID) * GRID;
}

export function createPlanItem(
  planId: string,
  item: Omit<PlanItem, 'id' | 'createdAt' | 'updatedAt'>
): PlanItem {
  const raw = storeGet(planKey(planId));
  if (!raw) throw new Error('Plan not found: ' + planId);
  const plan: Plan = JSON.parse(raw);

  const newItem: PlanItem = {
    ...item,
    id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    x: snap(item.x),
    y: snap(item.y),
  };

  plan.items.push(newItem);
  savePlan(plan);
  return newItem;
}

export function updatePlanItem(planId: string, itemId: string, updates: Partial<PlanItem>): void {
  const raw = storeGet(planKey(planId));
  if (!raw) return;
  const plan: Plan = JSON.parse(raw);
  const idx = plan.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  plan.items[idx] = { ...plan.items[idx], ...updates, updatedAt: Date.now() };
  savePlan(plan);
}

export function movePlanItem(planId: string, itemId: string, x: number, y: number): void {
  updatePlanItem(planId, itemId, { x: snap(x), y: snap(y) });
}

export function deletePlanItem(planId: string, itemId: string): void {
  const raw = storeGet(planKey(planId));
  if (!raw) return;
  const plan: Plan = JSON.parse(raw);
  plan.items = plan.items.filter((i) => i.id !== itemId);
  // clear parent references
  for (const it of plan.items) {
    if (it.parentId === itemId) delete (it as any).parentId;
  }
  savePlan(plan);
}

export function statusColor(status: PlanItem['status']): string {
  switch (status) {
    case 'idea': return '#6e6e6e';
    case 'todo': return '#79c0ff';
    case 'doing': return '#e6b450';
    case 'done': return '#7ee787';
    case 'blocked': return '#ff7b72';
    case 'review': return '#d2a8ff';
  }
}

export function authorLabel(author: PlanItem['author']): string {
  return author === 'human' ? 'H' : author === 'ai' ? 'A' : 'S';
}

export function authorColor(author: PlanItem['author']): string {
  return author === 'human' ? '#79c0ff' : author === 'ai' ? '#d2a8ff' : '#6e6e6e';
}
