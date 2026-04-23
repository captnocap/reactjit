
const React: any = require('react');
const { useCallback, useEffect, useRef, useState } = React;

import { Box, Canvas, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useHomeLayout, type TileType } from './useHomeLayout';
import { HomeTile } from './HomeTile';

const WORLD_W = 2000;
const WORLD_H = 1400;

const ADDABLE: { type: TileType; label: string }[] = [
  { type: 'clock', label: '+Clock' },
  { type: 'recent', label: '+Recent' },
  { type: 'launch', label: '+Launch' },
  { type: 'theme', label: '+Theme' },
  { type: 'shader', label: '+Shader' },
  { type: 'stats', label: '+Stats' },
  { type: 'scratch', label: '+Scratch' },
  { type: 'weatherless', label: '+Void' },
];

export function HomeCanvas(props: any) {
  const { tiles, updateTile, removeTile, addTile, resetLayout } = useHomeLayout();

  const [viewX, setViewX] = useState(0);
  const [viewY, setViewY] = useState(0);
  const [viewZoom, setViewZoom] = useState(1);
  const didLogRef = useRef(false);

  useEffect(() => {
    if (didLogRef.current) return;
    didLogRef.current = true;
    try {
      const first = tiles[0] || null;
      const log = JSON.stringify({
        event: 'home-layout',
        tileCount: tiles.length,
        firstTile: first ? { id: first.id, type: first.type, x: first.x, y: first.y, w: first.w, h: first.h } : null,
        view: { x: viewX, y: viewY, zoom: viewZoom },
        colors: { panelRaised: COLORS.panelRaised, panelBg: COLORS.panelBg },
      });
      if (typeof (globalThis as any).__hostLog === 'function') {
        (globalThis as any).__hostLog(0, log);
      } else {
        console.log(log);
      }
    } catch {}
  }, []);

  const handleMove = useCallback(
    (id: string) => (e: any) => {
      updateTile(id, { x: e.gx, y: e.gy });
    },
    [updateTile]
  );

  const handleClose = useCallback(
    (id: string) => () => {
      removeTile(id);
    },
    [removeTile]
  );

  const zoomIn = useCallback(() => setViewZoom((z) => Math.min(z * 1.2, 3)), []);
  const zoomOut = useCallback(() => setViewZoom((z) => Math.max(z / 1.2, 0.3)), []);
  const resetView = useCallback(() => {
    setViewX(0);
    setViewY(0);
    setViewZoom(1);
  }, []);

  const openFilesCount = props.openFilesCount ?? 0;
  const sessionMinutes = props.sessionMinutes ?? 0;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.appBg, position: 'relative' }}>
      <Canvas style={{ width: '100%', height: '100%' }} viewX={viewX} viewY={viewY} viewZoom={viewZoom}>
        {/* World bounds hint — slightly lighter than canvas bg so tiles pop */}
        <Canvas.Node gx={0} gy={0} gw={WORLD_W} gh={WORLD_H}>
          <Box style={{ width: '100%', height: '100%', borderWidth: 2, borderColor: COLORS.border, borderRadius: TOKENS.radiusMd, backgroundColor: COLORS.panelBg }} />
        </Canvas.Node>

        {tiles.map((tile) => (
          <Canvas.Node
            key={tile.id}
            gx={tile.x}
            gy={tile.y}
            gw={tile.w}
            gh={tile.h}
            onMove={handleMove(tile.id)}
          >
            <HomeTile
              tile={tile}
              onMove={(x, y) => updateTile(tile.id, { x, y })}
              onClose={handleClose(tile.id)}
              recentFiles={props.recentFiles}
              onOpenPath={props.onOpenPath}
              onTogglePanel={props.onTogglePanel}
              openFiles={openFilesCount}
              sessionMinutes={sessionMinutes}
            />
          </Canvas.Node>
        ))}

        {/* Fixed UI overlay (unaffected by pan/zoom) */}
        <Canvas.Clamp>
          <Box style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'none' }}>
            {/* Top-left: add-tile toolbar */}
            <Box style={{ position: 'absolute', left: 8, top: 8, pointerEvents: 'auto' }}>
              <Row style={{ gap: TOKENS.spaceXs, flexWrap: 'wrap', maxWidth: 400 }}>
                {ADDABLE.map((a) => (
                  <Pressable
                    key={a.type}
                    onPress={() => addTile(a.type)}
                    style={{
                      paddingLeft: 8,
                      paddingRight: 8,
                      paddingTop: 4,
                      paddingBottom: 4,
                      borderRadius: TOKENS.radiusPill,
                      backgroundColor: COLORS.panelRaised,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text fontSize={9} color={COLORS.textMuted}>{a.label}</Text>
                  </Pressable>
                ))}
              </Row>
            </Box>

            {/* Top-right: view controls */}
            <Box style={{ position: 'absolute', right: 8, top: 8, pointerEvents: 'auto' }}>
              <Row style={{ gap: TOKENS.spaceXs }}>
                <Pressable
                  onPress={zoomOut}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: TOKENS.radiusSm,
                    backgroundColor: COLORS.panelRaised,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text fontSize={12} color={COLORS.text}>-</Text>
                </Pressable>
                <Pressable
                  onPress={resetView}
                  style={{
                    paddingLeft: 8,
                    paddingRight: 8,
                    height: 26,
                    borderRadius: TOKENS.radiusSm,
                    backgroundColor: COLORS.panelRaised,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text fontSize={9} color={COLORS.textMuted}>Reset</Text>
                </Pressable>
                <Pressable
                  onPress={zoomIn}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: TOKENS.radiusSm,
                    backgroundColor: COLORS.panelRaised,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text fontSize={12} color={COLORS.text}>+</Text>
                </Pressable>
                <Pressable
                  onPress={resetLayout}
                  style={{
                    paddingLeft: 8,
                    paddingRight: 8,
                    height: 26,
                    borderRadius: TOKENS.radiusSm,
                    backgroundColor: COLORS.panelRaised,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text fontSize={9} color={COLORS.textMuted}>Default</Text>
                </Pressable>
              </Row>
            </Box>

            {/* Bottom-left: hint */}
            <Box style={{ position: 'absolute', left: 8, bottom: 8, pointerEvents: 'auto' }}>
              <Text fontSize={9} color={COLORS.textDim}>
                {tiles.length} tile{tiles.length === 1 ? '' : 's'} · Alt-drag to move
              </Text>
            </Box>
          </Box>
        </Canvas.Clamp>
      </Canvas>
    </Box>
  );
}
