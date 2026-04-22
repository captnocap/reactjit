
import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { useTransition as useAnimatedTransition } from '../../anim';
import type { LevelState } from './LevelCalc';

export interface XPBarProps {
  level: LevelState;
  compact?: boolean;
  accent?: string;
}

export function XPBar({ level, compact, accent }: XPBarProps) {
  const tone = accent || COLORS.purple || '#d2a8ff';
  const glowTone = COLORS.purpleDeep || '#2a1840';
  const filled = useAnimatedTransition(level.progress, 320);
  const pct = Math.max(0, Math.min(1, filled));

  // Pulsing glow — mild, so the bar feels alive without being distracting.
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulse((p: number) => (p + 1) % 60), 90);
    return () => clearInterval(id);
  }, []);
  const glowAlpha = 0.25 + 0.15 * Math.sin(pulse / 5);

  const barHeight = compact ? 6 : 10;
  return (
    <Col style={{ gap: compact ? 4 : 6 }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{
          width: compact ? 28 : 36, height: compact ? 28 : 36, borderRadius: compact ? 14 : 18,
          backgroundColor: glowTone, borderWidth: 2, borderColor: tone,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: tone, fontSize: compact ? 13 : 16, fontWeight: 700 }}>{level.level}</Text>
        </Box>
        <Col style={{ flexGrow: 1, gap: 2 }}>
          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ color: COLORS.textBright, fontSize: compact ? 10 : 12, fontWeight: 700, letterSpacing: 1 }}>
              LVL {level.level}
            </Text>
            <Box style={{ flexGrow: 1 }} />
            <Text style={{ color: tone, fontSize: compact ? 9 : 10, fontWeight: 700 }}>
              {level.xpWithinLevel}/{level.nextLevelXp} XP
            </Text>
          </Row>
          <Box style={{
            height: barHeight, backgroundColor: COLORS.panelAlt || '#1a222c',
            borderRadius: barHeight / 2, overflow: 'hidden', position: 'relative',
          }}>
            {/* glow haze */}
            <Box style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: String(Math.round(pct * 100)) + '%',
              backgroundColor: tone, opacity: glowAlpha, borderRadius: barHeight / 2,
            }} />
            {/* solid fill */}
            <Box style={{
              position: 'absolute', left: 0, top: 1, bottom: 1,
              width: String(Math.round(pct * 100)) + '%',
              backgroundColor: tone, borderRadius: barHeight / 2,
            }} />
          </Box>
        </Col>
      </Row>
      {compact ? null : (
        <Text style={{ color: COLORS.textDim, fontSize: 9, letterSpacing: 1 }}>
          total {level.xp} xp · next lvl in {level.nextLevelXp - level.xpWithinLevel}
        </Text>
      )}
    </Col>
  );
}
