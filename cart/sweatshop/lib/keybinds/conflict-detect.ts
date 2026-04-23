import { KEYBINDING_COMMANDS, normalizeChord, type KeybindingMap, type KeybindingSpec } from '../../components/keybind-editor/useKeybindStore';

export type KeybindAction = {
  id: string;
  label: string;
  description: string;
  category: string;
  combo: string;
};

export type KeybindConflictGroup = {
  combo: string;
  actions: KeybindAction[];
};

export type KeybindConflictReport = {
  conflicts: KeybindConflictGroup[];
  clean: KeybindAction[];
  all: KeybindAction[];
};

function resolveAction(spec: KeybindingSpec, bindings: KeybindingMap): KeybindAction {
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    category: spec.category,
    combo: normalizeChord(bindings[spec.id] || spec.defaultChord || ''),
  };
}

export function detectKeybindConflicts(
  bindings: KeybindingMap,
  commands: KeybindingSpec[] = KEYBINDING_COMMANDS,
): KeybindConflictReport {
  const groups = new Map<string, KeybindAction[]>();
  const all: KeybindAction[] = [];

  for (const spec of commands) {
    const action = resolveAction(spec, bindings);
    all.push(action);
    if (!action.combo) continue;
    const list = groups.get(action.combo) || [];
    list.push(action);
    groups.set(action.combo, list);
  }

  const conflicts: KeybindConflictGroup[] = [];
  const clean: KeybindAction[] = [];

  for (const [combo, actions] of groups.entries()) {
    if (actions.length > 1) {
      conflicts.push({ combo, actions });
    } else if (actions[0]) {
      clean.push(actions[0]);
    }
  }

  const usedConflictedIds = new Set(conflicts.flatMap((group) => group.actions.map((action) => action.id)));
  for (const action of all) {
    if (!action.combo || usedConflictedIds.has(action.id)) continue;
    if (!clean.some((item) => item.id === action.id)) clean.push(action);
  }

  conflicts.sort((a, b) => a.combo.localeCompare(b.combo));
  clean.sort((a, b) => {
    const categoryDelta = a.category.localeCompare(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.label.localeCompare(b.label);
  });

  return { conflicts, clean, all };
}
