import { C } from '../theme';

export interface TokenStyle {
  color: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: 'bold' | 'normal';
  opacity?: number;
}

/** Resolve a semantic token to visual style props. */
export function getTokenStyle(kind: string, text?: string): TokenStyle {
  switch (kind) {
    // ── Conversation ──────────────────────────────────────────────
    case 'user_prompt':
      return { color: C.text, fontWeight: 'bold' };
    case 'user_text':
      return { color: C.text };
    case 'user_input':
      return { color: C.text };
    case 'thinking':
      return { color: C.textMuted, opacity: 0.7 };
    case 'thought_complete':
      return { color: C.textMuted };
    case 'assistant_text':
      return { color: C.text };

    // ── Tool output ───────────────────────────────────────────────
    case 'tool':
      return { color: C.accent, fontWeight: 'bold' };
    case 'result':
      return { color: C.textDim };
    case 'diff': {
      const trimmed = (text ?? '').trimStart();
      if (trimmed.startsWith('+')) return { color: C.approve };
      if (trimmed.startsWith('-')) return { color: C.deny };
      return { color: C.textDim };
    }
    case 'error':
      return { color: C.deny };

    // ── Chrome ────────────────────────────────────────────────────
    case 'banner':
      return { color: C.textMuted, fontSize: 11 };
    case 'status_bar':
      return { color: C.textMuted, fontSize: 10, opacity: 0.6 };
    case 'idle_prompt':
      return { color: C.textMuted };
    case 'input_border':
      return { color: C.border, opacity: 0.4 };
    case 'input_zone':
      return { color: C.text };
    case 'box_drawing':
      return { color: C.border };

    // ── Interactive ───────────────────────────────────────────────
    case 'menu_title':
      return { color: C.accent, fontWeight: 'bold' };
    case 'menu_option':
      return { color: C.text };
    case 'menu_desc':
      return { color: C.textDim };
    case 'list_selectable':
      return { color: C.text };
    case 'list_selected':
      return { color: C.accent, fontWeight: 'bold' };
    case 'list_info':
      return { color: C.textDim };
    case 'search_box':
      return { color: C.text };
    case 'selector':
      return { color: C.accent };
    case 'confirmation':
      return { color: C.warning };
    case 'hint':
      return { color: C.textMuted };

    // ── Pickers ───────────────────────────────────────────────────
    case 'picker_title':
      return { color: C.accent, fontWeight: 'bold' };
    case 'picker_item':
      return { color: C.text };
    case 'picker_selected':
      return { color: C.accent, fontWeight: 'bold' };
    case 'picker_meta':
      return { color: C.textDim };

    // ── Permissions ───────────────────────────────────────────────
    case 'permission':
      return { color: C.warning, backgroundColor: C.warning + '0d' };

    // ── Plan mode ─────────────────────────────────────────────────
    case 'plan_border':
      return { color: C.accent, opacity: 0.5 };
    case 'plan_mode':
      return { color: C.accent };
    case 'wizard_step':
      return { color: C.textDim };

    // ── Tasks ─────────────────────────────────────────────────────
    case 'task_summary':
      return { color: C.textDim };
    case 'task_done':
      return { color: C.approve };
    case 'task_open':
      return { color: C.textMuted };
    case 'task_active':
      return { color: C.accent };

    // ── Misc ──────────────────────────────────────────────────────
    case 'slash_menu':
      return { color: C.accent };
    case 'image_attachment':
      return { color: C.textDim };

    default:
      return { color: C.textDim };
  }
}
