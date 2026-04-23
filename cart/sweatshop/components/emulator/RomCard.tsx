import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { RomEntry } from './useRomLibrary';

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatPlaytime(sec: number): string {
  if (sec <= 0) return '—';
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function formatAgo(ms: number | null): string {
  if (!ms) return 'never';
  const delta = Date.now() - ms;
  if (delta < 60000) return 'just now';
  if (delta < 3600000) return Math.floor(delta / 60000) + 'm ago';
  if (delta < 86400000) return Math.floor(delta / 3600000) + 'h ago';
  return Math.floor(delta / 86400000) + 'd ago';
}

export function RomCard(props: {
  rom: RomEntry;
  active?: boolean;
  onPlay: (rom: RomEntry) => void;
  onToggleFavorite: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { rom, active } = props;
  const tone = rom.favorite ? COLORS.yellow : active ? COLORS.blue : COLORS.border;

  return (
    <Col style={{
      width: 220,
      padding: TOKENS.padNormal,
      borderRadius: TOKENS.radiusMd,
      borderWidth: 1,
      borderColor: tone,
      backgroundColor: COLORS.panelAlt,
      gap: 4,
    }}>
      <Row style={{ alignItems: 'center', gap: 4 }}>
        <Text fontSize={TOKENS.fontSm} color={COLORS.textBright} style={{
          fontFamily: TOKENS.fontUI, fontWeight: 'bold',
          flexGrow: 1, flexBasis: 0,
        }}>
          {rom.displayName}
        </Text>
        <Pressable onPress={() => props.onToggleFavorite(rom.id)}>
          <Box style={{
            paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
            borderRadius: TOKENS.radiusXs,
          }}>
            <Text fontSize={TOKENS.fontSm} color={rom.favorite ? COLORS.yellow : COLORS.textDim}>
              {rom.favorite ? '★' : '☆'}
            </Text>
          </Box>
        </Pressable>
      </Row>

      <Row style={{ gap: 4, flexWrap: 'wrap' }}>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>mapper {rom.mapperId}</Text>
        </Box>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{formatBytes(rom.prgSize + rom.chrSize)}</Text>
        </Box>
        {rom.hasBattery ? (
          <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.green, backgroundColor: COLORS.greenDeep }}>
            <Text fontSize={9} color={COLORS.green} style={{ fontFamily: TOKENS.fontMono }}>sram</Text>
          </Box>
        ) : null}
        {rom.region ? (
          <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{rom.region}</Text>
          </Box>
        ) : null}
      </Row>

      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>
        crc {rom.crc32} · {rom.format}
      </Text>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }} numberOfLines={1}>
        {rom.path}
      </Text>

      <Row style={{ alignItems: 'center', gap: 8, marginTop: 2 }}>
        <Col style={{ flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={9} color={COLORS.textDim}>played {formatPlaytime(rom.playCountSec)} · {rom.launchCount} launches</Text>
          <Text fontSize={9} color={COLORS.textDim}>last {formatAgo(rom.lastPlayedAt)}</Text>
        </Col>
        <Pressable onPress={() => props.onRemove(rom.id)}>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={9} color={COLORS.red}>drop</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => props.onPlay(rom)}>
          <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: active ? COLORS.green : COLORS.blue, backgroundColor: active ? COLORS.greenDeep : COLORS.blueDeep }}>
            <Text fontSize={TOKENS.fontXs} color={active ? COLORS.green : COLORS.blue} style={{ fontWeight: 'bold' }}>
              {active ? 'Playing' : 'Play'}
            </Text>
          </Box>
        </Pressable>
      </Row>
    </Col>
  );
}
