
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { HomeTileDef, TileType } from './useHomeLayout';
import { RecentProjectsTile } from './tiles/RecentProjectsTile';
import { ScratchCanvasTile } from './tiles/ScratchCanvasTile';
import { QuickLaunchTile } from './tiles/QuickLaunchTile';
import { ThemeShuffleTile } from './tiles/ThemeShuffleTile';
import { ShaderTile } from './tiles/ShaderTile';
import { ClockTile } from './tiles/ClockTile';
import { WeatherlessTile } from './tiles/WeatherlessTile';
import { StatsTile } from './tiles/StatsTile';

const TILE_TITLES: Record<TileType, string> = {
  recent: 'Recent',
  scratch: 'Scratch',
  launch: 'Launch',
  theme: 'Theme',
  shader: 'Shader',
  clock: 'Clock',
  weatherless: 'Void',
  stats: 'Ambient',
};

const TILE_ACCENT: Record<TileType, string> = {
  clock: COLORS.blue,
  recent: COLORS.green,
  launch: COLORS.orange,
  theme: COLORS.purple,
  shader: COLORS.yellow,
  stats: COLORS.blue,
  weatherless: COLORS.textMuted,
  scratch: COLORS.red,
};

export function HomeTile(props: {
  tile: HomeTileDef;
  onMove: (x: number, y: number) => void;
  onClose: () => void;
  recentFiles?: any[];
  onOpenPath?: (path: string) => void;
  onTogglePanel?: (id: string) => void;
  openFiles?: number;
  sessionMinutes?: number;
}) {
  const { tile } = props;

  const content = (() => {
    switch (tile.type) {
      case 'recent':
        return <RecentProjectsTile recentFiles={props.recentFiles} onOpenPath={props.onOpenPath} />;
      case 'scratch':
        return <ScratchCanvasTile />;
      case 'launch':
        return <QuickLaunchTile onTogglePanel={props.onTogglePanel} />;
      case 'theme':
        return <ThemeShuffleTile />;
      case 'shader':
        return <ShaderTile />;
      case 'clock':
        return <ClockTile />;
      case 'weatherless':
        return <WeatherlessTile />;
      case 'stats':
        return <StatsTile openFiles={props.openFiles} sessionMinutes={props.sessionMinutes} />;
      default:
        return (
          <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.textDim}>Unknown tile: {tile.type}</Text>
          </Box>
        );
    }
  })();

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        borderRadius: TOKENS.radiusMd,
        backgroundColor: COLORS.panelRaised,
        borderWidth: 2,
        borderColor: COLORS.border,
        borderTopWidth: 3,
        borderTopColor: TILE_ACCENT[tile.type] ?? COLORS.border,
        overflow: 'hidden',
      }}
    >
      {/* Header chrome */}
      <Row
        style={{
          height: 24,
          paddingLeft: TOKENS.spaceXs,
          paddingRight: TOKENS.spaceXs,
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: COLORS.panelAlt,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <Text fontSize={9} color={COLORS.textMuted} style={{ fontWeight: 'bold', letterSpacing: 0.5 }}>
          {TILE_TITLES[tile.type]}
        </Text>
        <Pressable
          onPress={props.onClose}
          style={{
            width: 16,
            height: 16,
            borderRadius: TOKENS.radiusSm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text fontSize={10} color={COLORS.textDim}>×</Text>
        </Pressable>
      </Row>

      {/* Body */}
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        {content}
      </Box>
    </Box>
  );
}
