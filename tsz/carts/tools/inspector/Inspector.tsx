// =============================================================================
// Inspector — root panel for the standalone tools app
// =============================================================================
// Tabbed surface: Tree / Props / Events / TimeTravel. Tab visibility is
// user-controllable through the store; hidden tabs vanish from the strip.
// Tree poll freezes when TimeTravel holds the cursor off-live, so all four
// panels stay coherent.
// =============================================================================

const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';
import { TreeView } from './TreeView';
import { PropEditor } from './PropEditor';
import { EventLog } from './EventLog';
import { TimeTravel } from './TimeTravel';
import { useNodeGraph } from './useNodeGraph';
import {
  useInspectorStore,
  setActiveTab,
  setTabVisible,
  type TabId,
} from './useInspectorStore';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'tree',       label: 'Tree' },
  { id: 'props',      label: 'Props' },
  { id: 'events',     label: 'Events' },
  { id: 'timetravel', label: 'TimeTravel' },
];

export default function Inspector() {
  const store = useInspectorStore();
  const [treeFilter, setTreeFilter] = useState('');
  const poll = store.timeTravelEnabled && store.timeCursor !== -1 ? 0 : 500;
  const { snapshot } = useNodeGraph(poll);

  const visible = TABS.filter((t) => store.showTabs[t.id]);
  const active = store.showTabs[store.activeTab] ? store.activeTab : (visible[0] ? visible[0].id : 'tree');

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.appBg, gap: 8, padding: 10 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Inspector</Text>
        <Text fontSize={10} color={COLORS.textDim}>standalone tools app</Text>
        <Box style={{ flexGrow: 1 }} />
        <Row style={{ gap: 4, alignItems: 'center' }}>
          {TABS.map((t) => {
            const on = store.showTabs[t.id];
            return (
              <Pressable key={'vis_' + t.id} onPress={() => setTabVisible(t.id, !on)} style={{
                paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                borderRadius: TOKENS.radiusSm, borderWidth: 1,
                borderColor: on ? COLORS.green : COLORS.border,
                backgroundColor: on ? COLORS.greenDeep : COLORS.panelAlt,
              }}>
                <Text fontSize={9} color={on ? COLORS.green : COLORS.textDim} style={{ fontFamily: 'monospace' }}>
                  {on ? '◉' : '○'} {t.label}
                </Text>
              </Pressable>
            );
          })}
        </Row>
      </Row>

      <Row style={{ gap: 4, flexWrap: 'wrap' }}>
        {visible.map((t) => {
          const hit = t.id === active;
          return (
            <Pressable key={t.id} onPress={() => setActiveTab(t.id)} style={{
              paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
              borderRadius: TOKENS.radiusSm, borderWidth: 1,
              borderColor: hit ? COLORS.blue : COLORS.border,
              backgroundColor: hit ? COLORS.panelHover : COLORS.panelRaised,
            }}>
              <Text fontSize={11} color={hit ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
        {visible.length === 0 ? (
          <Text fontSize={10} color={COLORS.textDim}>All tabs hidden — re-enable at least one in the strip above.</Text>
        ) : null}
      </Row>

      <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        {active === 'tree' && store.showTabs.tree ? (
          <TreeView pollPaused={poll === 0} filter={treeFilter} onFilterChange={setTreeFilter} />
        ) : null}
        {active === 'props' && store.showTabs.props ? (
          <PropEditor snapshot={snapshot} />
        ) : null}
        {active === 'events' && store.showTabs.events ? (
          <EventLog />
        ) : null}
        {active === 'timetravel' && store.showTabs.timetravel ? (
          <TimeTravel />
        ) : null}
      </Col>
    </Col>
  );
}
