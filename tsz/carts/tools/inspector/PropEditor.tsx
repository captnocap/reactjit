// =============================================================================
// PropEditor — edits props of the currently selected node
// =============================================================================
// Reads the selected id from the shared inspector store, looks up the
// Instance through the GraphSnapshot's byId map, and renders a PropField per
// key/value. Live edits mutate the Instance in place — the reconciler polls
// the tree, so mutations surface back in the running app on the next pass.
// `children` / `handlers` are intentionally hidden from the editor; `style`
// is rendered flat (style.<key> rows) so nested style properties get their
// own type-appropriate editors.
// =============================================================================

const React: any = require('react');
const { useMemo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';
import type { Instance } from '../../../../renderer/hostConfig';
import type { GraphSnapshot } from './useNodeGraph';
import { PropField } from './PropField';
import { useInspectorStore, pushEvent, setSelectedNodeId } from './useInspectorStore';

interface PropEditorProps {
  snapshot: GraphSnapshot;
}

interface FlatProp {
  key: string;      // display name (e.g. 'style.backgroundColor')
  path: string[];   // ['style', 'backgroundColor'] — how to write back
  value: any;
  editable: boolean;
}

const HIDDEN_KEYS = new Set(['children', 'handlers']);

function flattenProps(props: Record<string, any>): FlatProp[] {
  const out: FlatProp[] = [];
  for (const k of Object.keys(props || {})) {
    if (HIDDEN_KEYS.has(k)) continue;
    const v = (props as any)[k];
    if (k === 'style' && v && typeof v === 'object') {
      for (const sk of Object.keys(v)) {
        out.push({ key: 'style.' + sk, path: ['style', sk], value: v[sk], editable: true });
      }
      continue;
    }
    const editable = typeof v !== 'function' && !Array.isArray(v) && (v === null || typeof v !== 'object');
    out.push({ key: k, path: [k], value: v, editable });
  }
  return out;
}

function writePath(target: Record<string, any>, path: string[], next: any) {
  let cursor: any = target;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (cursor[seg] === null || cursor[seg] === undefined || typeof cursor[seg] !== 'object') {
      cursor[seg] = {};
    }
    cursor = cursor[seg];
  }
  cursor[path[path.length - 1]] = next;
}

export function PropEditor(props: PropEditorProps) {
  const store = useInspectorStore();
  const instance: Instance | undefined = store.selectedNodeId !== null
    ? props.snapshot.instances.get(store.selectedNodeId)
    : undefined;

  const fields = useMemo(() => instance ? flattenProps(instance.props) : [], [instance]);

  function applyEdit(path: string[], next: any) {
    if (!instance) return;
    const before = (instance.props as any)[path[0]];
    writePath(instance.props as any, path, next);
    const summary = path.join('.') + ' = ' + (typeof next === 'string' ? JSON.stringify(next).slice(0, 40) : String(next));
    pushEvent('propEdit', instance.id, summary);
    // Nudge a listener so subscribers re-render; the store emit on pushEvent
    // already does that when record is enabled. When it's disabled, fall back
    // to a bare selection-bounce so the UI still reflects the mutation.
    if (!store.recordEnabled) setSelectedNodeId(instance.id);
    void before;
  }

  if (!instance) {
    return (
      <Col style={{ flexGrow: 1, flexBasis: 0, gap: 8 }}>
        <Box style={{
          padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
          borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
        }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Props</Text>
          <Text fontSize={10} color={COLORS.textDim}>Pick a node in the Tree view to edit its props live.</Text>
        </Box>
      </Col>
    );
  }

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 8 }}>
      <Row style={{
        alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: COLORS.blue, backgroundColor: COLORS.panelRaised,
      }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
          {instance.type}
        </Text>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>#{instance.id}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{fields.length} prop{fields.length === 1 ? '' : 's'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={() => setSelectedNodeId(null)} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
          borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border,
          backgroundColor: COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={COLORS.textDim}>close</Text>
        </Pressable>
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
        <Col style={{ gap: 2, padding: 4 }}>
          {fields.length === 0 ? (
            <Box style={{ padding: 10, alignItems: 'center' }}>
              <Text fontSize={10} color={COLORS.textDim}>This node has no inspectable props.</Text>
            </Box>
          ) : null}
          {fields.map((f) => (
            <PropField key={f.key} name={f.key} value={f.value} editable={f.editable}
              onChange={(_name, next) => applyEdit(f.path, next)} />
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
