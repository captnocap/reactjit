const React: any = require('react');
const { memo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { Glyph, Pill } from './shared';

function LandingSurfaceImpl(props: any) {
  (globalThis as any).__hostLog?.(0, "[render] LandingSurface");
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';

  return (
    <ScrollView style={{ flexGrow: 1, height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: compactBand ? 12 : 18, gap: 16 }}>
        <Box
          style={{
            padding: minimumBand ? 14 : 18,
            borderRadius: TOKENS.radiusLg,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
            gap: 10,
          }}
        >
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>
            PROJECT LANDING
          </Text>
          <Text fontSize={compactBand ? 20 : 24} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {props.workspaceName}
          </Text>
          {!minimumBand ? <Text fontSize={11} color={COLORS.textDim}>{props.workDir}</Text> : null}
          {!minimumBand ? <Text fontSize={11} color={COLORS.text}>{props.workspaceTagline}</Text> : null}
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label={'branch ' + props.gitBranch} color={COLORS.green} />
            <Pill label={'remote ' + props.gitRemote} color={COLORS.blue} />
            <Pill label={'sync +' + props.branchAhead + ' / -' + props.branchBehind} color={COLORS.purple} />
            {!minimumBand ? <Pill label={props.changedCount + ' dirty / ' + props.stagedCount + ' staged'} color={COLORS.yellow} /> : null}
          </Row>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pressable onPress={props.onIndexWorkspace} style={{ padding: 10, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={11} color={COLORS.blue}>Index Workspace</Text>
            </Pressable>
            <Pressable onPress={() => props.onOpenPath('cart/cursor-ide/index.tsx')} style={{ padding: 10, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={11} color={COLORS.text}>Open TSX cart</Text>
            </Pressable>
            <Pressable onPress={props.onOpenSettings} style={{ padding: 10, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={11} color={COLORS.text}>Open Settings Surface</Text>
            </Pressable>
          </Row>
        </Box>

        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          {props.stats.map((stat: any) => (
            <Box key={stat.label} style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, minWidth: 110 }}>
              <Text fontSize={18} color={stat.tone} style={{ fontWeight: 'bold' }}>{stat.value}</Text>
              <Text fontSize={10} color={COLORS.textDim}>{stat.label}</Text>
            </Box>
          ))}
        </Row>

        <Row style={{ gap: 14, alignItems: 'flex-start', flexWrap: compactBand ? 'wrap' : 'nowrap' }}>
          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 12 }}>
            <Box style={{ padding: 14, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Projects</Text>
              <Text fontSize={10} color={COLORS.textDim}>Curated entry points into the repo</Text>
              <Col style={{ gap: 8 }}>
                {props.projects.map((item: any) => (
                  <Pressable
                    key={item.name + '_' + item.path}
                    onPress={() => props.onOpenPath(item.path)}
                    style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}
                  >
                    <Row style={{ alignItems: 'center', gap: 8 }}>
                      <Box style={{ width: 8, height: 28, borderRadius: TOKENS.radiusSm, backgroundColor: item.accent }} />
                      <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
                      <Box style={{ flexGrow: 1 }} />
                      <Pill label={item.badge} color={item.accent} tiny={true} />
                    </Row>
                    <Text fontSize={11} color={COLORS.text}>{item.summary}</Text>
                    <Text fontSize={10} color={COLORS.textDim}>{item.displayPath}</Text>
                  </Pressable>
                ))}
              </Col>
            </Box>
          </Col>

          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 12 }}>
            <Box style={{ padding: 14, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Git Connections</Text>
              <Text fontSize={10} color={COLORS.textDim}>Branch, remote, and worktree wiring</Text>
              <Col style={{ gap: 8 }}>
                {props.connections.map((item: any) => (
                  <Row key={item.name + '_' + item.detail} style={{ gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt }}>
                    <Box style={{ width: 8, height: 8, borderRadius: TOKENS.radiusSm, backgroundColor: item.tone, marginTop: 5 }} />
                    <Col style={{ gap: 3, flexGrow: 1, flexBasis: 0 }}>
                      <Text fontSize={11} color={COLORS.textBright}>{item.name}</Text>
                      <Text fontSize={10} color={COLORS.textDim}>{item.detail}</Text>
                    </Col>
                  </Row>
                ))}
              </Col>
            </Box>

            <Box style={{ padding: 14, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Recent Focus</Text>
              <Text fontSize={10} color={COLORS.textDim}>Dirty files, open tabs, and cart hotspots</Text>
              <Col style={{ gap: 8 }}>
                {props.recentFiles.map((item: any) => (
                  <Pressable
                    key={item.path + '_' + item.reason}
                    onPress={() => props.onOpenPath(item.path)}
                    style={{ padding: 10, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, gap: 6 }}
                  >
                    <Row style={{ alignItems: 'center', gap: 8 }}>
                      <Glyph icon={item.icon} tone={item.tone} backgroundColor={COLORS.grayChip} tiny={true} />
                      <Text fontSize={11} color={COLORS.textBright}>{item.label}</Text>
                      <Box style={{ flexGrow: 1 }} />
                      <Text fontSize={10} color={COLORS.textDim}>{item.reason}</Text>
                    </Row>
                    {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{item.displayPath}</Text> : null}
                  </Pressable>
                ))}
              </Col>
            </Box>
          </Col>
        </Row>
      </Col>
    </ScrollView>
  );
}

export const LandingSurface = memo(LandingSurfaceImpl);
