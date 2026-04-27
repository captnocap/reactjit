/**
 * Pretty-print an Intent AST to a self-contained TSX cart file.
 *
 * Output shape (example):
 *
 *   import { IntentCard } from '../component-gallery/components/intent-surface/IntentCard';
 *   import { IntentBtn }  from '../component-gallery/components/intent-surface/IntentBtn';
 *
 *   export default function App() {
 *     const onAction = (reply: string) => console.log('intent action:', reply);
 *     return (
 *       <IntentCard>
 *         <IntentBtn reply="hi" label="Hello" onAction={onAction} />
 *       </IntentCard>
 *     );
 *   }
 *
 * The lifted cart is a static snapshot — handler bodies are stubs (console.log).
 * The user can edit the file to wire real behavior. The visual shape is
 * preserved exactly because we render through the same components.
 */

import type { Node, NodeKind } from './parser';

const TAG_TO_COMPONENT: Record<Exclude<NodeKind, 'text'>, string> = {
  Row: 'IntentRow',
  Col: 'IntentCol',
  Card: 'IntentCard',
  Title: 'IntentTitle',
  Text: 'IntentText',
  List: 'IntentList',
  Btn: 'IntentBtn',
  Form: 'IntentForm',
  Field: 'IntentField',
  Submit: 'IntentSubmit',
  Badge: 'IntentBadge',
  Code: 'IntentCode',
  Divider: 'IntentDivider',
  Kbd: 'IntentKbd',
  Spacer: 'IntentSpacer',
};

/** Tags that take an `onAction` prop and need it threaded through. */
const NEEDS_ON_ACTION = new Set(['Btn', 'Form']);

interface PrintOptions {
  /** Relative path prefix to the intent-surface directory from the save target. */
  importBase: string;
}

export function printIntentCart(nodes: Node[], opts: PrintOptions): string {
  const used = new Set<string>();
  const body = nodes.map((n) => renderNode(n, used, 4)).join('\n');

  const importLines = [...used]
    .sort()
    .map((comp) => `import { ${comp} } from '${opts.importBase}/${comp}';`)
    .join('\n');

  return `${importLines}

export default function App() {
  const onAction = (reply: string) => console.log('intent action:', reply);
  return (
    <>
${body}
    </>
  );
}
`;
}

function renderNode(node: Node, used: Set<string>, indent: number): string {
  const pad = ' '.repeat(indent);

  if (node.kind === 'text') {
    const t = (node.text ?? '').trim();
    if (!t) return '';
    return `${pad}{${JSON.stringify(t)}}`;
  }

  const comp = TAG_TO_COMPONENT[node.kind];
  if (!comp) return '';
  used.add(comp);

  // Special handling per tag — translate AST attrs to component props.
  const propParts: string[] = [];

  if (node.kind === 'Btn') {
    const reply = stringAttr(node.attrs.reply);
    const inner = flatText(node);
    propParts.push(`reply=${jsxString(reply ?? inner ?? 'pick')}`);
    if (inner) propParts.push(`label=${jsxString(inner)}`);
    propParts.push(`onAction={onAction}`);
    // Btn renders label from prop — children would duplicate.
    return `${pad}<${comp} ${propParts.join(' ')} />`;
  }

  if (node.kind === 'Submit') {
    const replyTpl = stringAttr(node.attrs.reply);
    const inner = flatText(node);
    if (replyTpl) propParts.push(`replyTemplate=${jsxString(replyTpl)}`);
    if (inner) propParts.push(`label=${jsxString(inner)}`);
    return `${pad}<${comp} ${propParts.join(' ')} />`;
  }

  if (node.kind === 'Field') {
    const name = stringAttr(node.attrs.name) ?? '';
    propParts.push(`name=${jsxString(name)}`);
    const label = stringAttr(node.attrs.label);
    if (label) propParts.push(`label=${jsxString(label)}`);
    const placeholder = stringAttr(node.attrs.placeholder);
    if (placeholder) propParts.push(`placeholder=${jsxString(placeholder)}`);
    const initial = stringAttr(node.attrs.value);
    if (initial) propParts.push(`initial=${jsxString(initial)}`);
    return `${pad}<${comp} ${propParts.join(' ')} />`;
  }

  if (node.kind === 'Form') {
    propParts.push(`onAction={onAction}`);
  }

  if (node.kind === 'Badge') {
    const tone = stringAttr(node.attrs.tone);
    if (tone) propParts.push(`tone=${jsxString(tone)}`);
    return `${pad}<${comp}${propParts.length ? ' ' + propParts.join(' ') : ''}>${flatText(node)}</${comp}>`;
  }

  if (node.kind === 'Code') {
    const lang = stringAttr(node.attrs.lang);
    if (lang) propParts.push(`lang=${jsxString(lang)}`);
    return `${pad}<${comp}${propParts.length ? ' ' + propParts.join(' ') : ''}>{${JSON.stringify(flatText(node))}}</${comp}>`;
  }

  if (node.kind === 'Spacer') {
    const size = stringAttr(node.attrs.size);
    if (size) propParts.push(`size=${jsxString(size)}`);
    return `${pad}<${comp}${propParts.length ? ' ' + propParts.join(' ') : ''} />`;
  }

  if (node.kind === 'Divider') {
    return `${pad}<${comp} />`;
  }

  if (node.kind === 'Kbd') {
    return `${pad}<${comp}>${flatText(node)}</${comp}>`;
  }

  if (node.kind === 'List') {
    const items = flatText(node).split('\n').map((s) => s.trim()).filter(Boolean);
    propParts.push(`items={${JSON.stringify(items)}}`);
    return `${pad}<${comp} ${propParts.join(' ')} />`;
  }

  if (node.kind === 'Title' || node.kind === 'Text') {
    return `${pad}<${comp}>${flatText(node)}</${comp}>`;
  }

  // Container default: Row / Col / Card.
  const propStr = propParts.length ? ' ' + propParts.join(' ') : '';
  if (!node.children.length) {
    return `${pad}<${comp}${propStr} />`;
  }
  const childLines = node.children
    .map((c) => renderNode(c, used, indent + 2))
    .filter((s) => s.length > 0)
    .join('\n');
  return `${pad}<${comp}${propStr}>\n${childLines}\n${pad}</${comp}>`;
}

function flatText(node: Node): string {
  if (node.text) return node.text;
  return node.children.map(flatText).join(' ').trim();
}

function stringAttr(v: string | true | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function jsxString(s: string): string {
  // JSX attribute string — escape backslashes and double quotes.
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
