import { Col, Text } from '../../../../runtime/primitives';
import type { Node } from '../../../../runtime/intent/parser';
import type { OnAction } from './types';
import { IntentTitle } from './IntentTitle';
import { IntentText } from './IntentText';
import { IntentCard } from './IntentCard';
import { IntentRow } from './IntentRow';
import { IntentCol } from './IntentCol';
import { IntentList } from './IntentList';
import { IntentBtn } from './IntentBtn';
import { IntentForm, IntentField, IntentSubmit } from './IntentForm';
import { IntentBadge } from './IntentBadge';
import { IntentCode } from './IntentCode';
import { IntentDivider } from './IntentDivider';
import { IntentKbd } from './IntentKbd';
import { IntentSpacer } from './IntentSpacer';

/**
 * Top-level renderer for an Intent AST.
 *
 * Takes the parsed nodes and onAction callback, dispatches each AST node to
 * the matching component. Unknown nodes fall through as fenced text — the
 * parser shouldn't emit any, but the surface tolerates them.
 */
export function IntentSurface({ nodes, onAction }: { nodes: Node[]; onAction: OnAction }) {
  return (
    <Col style={{ gap: 8 }}>
      {nodes.map((n, i) => <IntentNode key={i} node={n} onAction={onAction} />)}
    </Col>
  );
}

export function IntentNode({ node, onAction }: { node: Node; onAction: OnAction }) {
  switch (node.kind) {
    case 'text':
      return <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{node.text}</Text>;

    case 'Title':
      return <IntentTitle>{flatText(node)}</IntentTitle>;

    case 'Text':
      if (node.children.length > 0 && node.children.some((c) => c.kind !== 'text')) {
        return (
          <Col style={{ gap: 4 }}>
            {node.children.map((c, i) => <IntentNode key={i} node={c} onAction={onAction} />)}
          </Col>
        );
      }
      return <IntentText>{flatText(node)}</IntentText>;

    case 'Card':
      return (
        <IntentCard>
          {node.children.map((c, i) => <IntentNode key={i} node={c} onAction={onAction} />)}
        </IntentCard>
      );

    case 'Row':
      return (
        <IntentRow>
          {node.children.map((c, i) => <IntentNode key={i} node={c} onAction={onAction} />)}
        </IntentRow>
      );

    case 'Col':
      return (
        <IntentCol>
          {node.children.map((c, i) => <IntentNode key={i} node={c} onAction={onAction} />)}
        </IntentCol>
      );

    case 'List': {
      const items = flatText(node).split('\n').map((s) => s.trim()).filter(Boolean);
      return <IntentList items={items} />;
    }

    case 'Btn': {
      const reply = stringAttr(node.attrs.reply) ?? flatText(node) ?? 'pick';
      const label = flatText(node) || stringAttr(node.attrs.label) || undefined;
      return <IntentBtn reply={reply} label={label} onAction={onAction} />;
    }

    case 'Form':
      return (
        <IntentForm onAction={onAction}>
          {node.children.map((c, i) => <IntentNode key={i} node={c} onAction={onAction} />)}
        </IntentForm>
      );

    case 'Field':
      return (
        <IntentField
          name={stringAttr(node.attrs.name) ?? ''}
          label={stringAttr(node.attrs.label)}
          placeholder={stringAttr(node.attrs.placeholder)}
          initial={stringAttr(node.attrs.value)}
        />
      );

    case 'Submit': {
      const replyTemplate = stringAttr(node.attrs.reply);
      const label = flatText(node) || undefined;
      return <IntentSubmit replyTemplate={replyTemplate} label={label} />;
    }

    case 'Badge': {
      const tone = stringAttr(node.attrs.tone) as any;
      return <IntentBadge tone={tone}>{flatText(node)}</IntentBadge>;
    }

    case 'Code': {
      const lang = stringAttr(node.attrs.lang);
      return <IntentCode lang={lang}>{flatText(node)}</IntentCode>;
    }

    case 'Divider':
      return <IntentDivider />;

    case 'Kbd':
      return <IntentKbd>{flatText(node)}</IntentKbd>;

    case 'Spacer': {
      const size = stringAttr(node.attrs.size) as any;
      return <IntentSpacer size={size} />;
    }

    default:
      return null;
  }
}

function flatText(node: Node): string {
  if (node.text) return node.text;
  return node.children.map(flatText).join(' ').trim();
}

function stringAttr(v: string | true | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
