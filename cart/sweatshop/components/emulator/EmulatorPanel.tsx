import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useEmulator } from '../../lib/emulator/hooks/useEmulator';
import { useController, DEFAULT_BINDINGS } from '../../lib/emulator/hooks/useController';
import { EmulatorScreen } from './EmulatorScreen';
import { EmulatorControls } from './EmulatorControls';
import { ControllerMapper } from './ControllerMapper';
import { RomLibrary } from './RomLibrary';
import { type RomEntry, findRomByCrc, useRomLibrary } from './useRomLibrary';

const SCALES = [1, 2, 3, 4];

export function EmulatorPanel() {
  const emulator = useEmulator();
  const lib = useRomLibrary();
  const [scale, setScale] = useState(2);
  const [showBindings, setShowBindings] = useState(false);

  // View mode: 'library' shows the ROM picker; 'game' shows the emulator
  // surface. Default to library until a ROM is actively loaded. `activeRom`
  // remembers which library entry is backing the current emulator session
  // so we can record playtime.
  const [view, setView] = useState<'library' | 'game'>('library');
  const [activeRom, setActiveRom] = useState<RomEntry | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const handleButtonChange = useCallback((button: keyof typeof DEFAULT_BINDINGS, pressed: boolean) => {
    const bus = emulator.busRef.current;
    if (!bus) return;
    bus.controller1.setButton(button, pressed);
  }, [emulator.busRef]);

  const controller = useController(handleButtonChange);

  const commitPlaytime = useCallback(() => {
    if (activeRom && sessionStartRef.current != null) {
      const seconds = (Date.now() - sessionStartRef.current) / 1000;
      lib.recordPlayed(activeRom.id, seconds);
    }
    sessionStartRef.current = null;
  }, [activeRom, lib]);

  useEffect(() => () => { commitPlaytime(); }, [commitPlaytime]);

  const playRom = useCallback((rom: RomEntry) => {
    commitPlaytime();
    const ok = emulator.loadROM(rom.path);
    if (!ok) return;
    setActiveRom(rom);
    sessionStartRef.current = Date.now();
    setView('game');
    emulator.play();
  }, [commitPlaytime, emulator]);

  const backToLibrary = useCallback(() => {
    commitPlaytime();
    emulator.pause();
    setView('library');
  }, [commitPlaytime, emulator]);

  // Fallback: if the host loads a ROM via some other path (direct
  // loadROM call) and the resulting romName matches a library entry,
  // adopt that entry so playtime tracking still works.
  useEffect(() => {
    if (!activeRom && emulator.romName) {
      // Heuristic: match by displayName; CRC lookup would require
      // re-reading the file which is wasted work here.
      const match = lib.roms.find((r) => r.displayName === emulator.romName || r.path.endsWith('/' + emulator.romName));
      if (match) {
        setActiveRom(match);
        sessionStartRef.current = Date.now();
      }
    }
  }, [emulator.romName, activeRom, lib.roms]);

  const headerChrome = (
    <Row style={{ padding: 10, alignItems: 'center', justifyContent: 'space-between' }}>
      <Row style={{ alignItems: 'center', gap: 10 }}>
        <Text fontSize={14} color={COLORS.text} style={{ fontWeight: 'bold' }}>NES Emulator</Text>
        {view === 'game' && activeRom ? (
          <Text fontSize={TOKENS.fontXs} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontUI }}>
            · {activeRom.displayName}
          </Text>
        ) : null}
      </Row>
      <Row style={{ gap: 8, alignItems: 'center' }}>
        {view === 'game' ? (
          <Pressable onPress={backToLibrary}>
            <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={TOKENS.fontXs} color={COLORS.text}>← Library</Text>
            </Box>
          </Pressable>
        ) : null}
        {view === 'game' ? <Text fontSize={10} color={COLORS.textDim}>Scale</Text> : null}
        {view === 'game' ? SCALES.map((s) => (
          <Pressable key={s} onPress={() => setScale(s)}>
            <Box style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              borderRadius: TOKENS.radiusXs, borderWidth: 1,
              borderColor: scale === s ? COLORS.blue : COLORS.border,
              backgroundColor: scale === s ? COLORS.blueDeep : COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={scale === s ? COLORS.blue : COLORS.textDim}>{s}x</Text>
            </Box>
          </Pressable>
        )) : null}
        {view === 'game' ? (
          <Pressable onPress={() => setShowBindings((v) => !v)}>
            <Box style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              borderRadius: TOKENS.radiusXs, borderWidth: 1,
              borderColor: showBindings ? COLORS.blue : COLORS.border,
              backgroundColor: showBindings ? COLORS.blueDeep : COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={showBindings ? COLORS.blue : COLORS.textDim}>Bindings</Text>
            </Box>
          </Pressable>
        ) : null}
      </Row>
    </Row>
  );

  if (view === 'library' || !emulator.romName) {
    return (
      <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
        {headerChrome}
        <RomLibrary activeRomId={activeRom?.id ?? null} onPlay={playRom} />
      </Col>
    );
  }

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      {headerChrome}
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <EmulatorScreen busRef={emulator.busRef} tick={emulator.tick} scale={scale} />
      </Box>
      <EmulatorControls
        state={emulator.state}
        romName={emulator.romName}
        fps={emulator.fps}
        onLoadROM={emulator.loadROM}
        onPlay={emulator.play}
        onPause={emulator.pause}
        onStep={emulator.step}
        onReset={emulator.reset}
        onSetSpeed={emulator.setSpeed}
        onSaveState={emulator.saveState}
        onLoadSaveState={emulator.loadSaveState}
      />
      {showBindings ? (
        <ControllerMapper bindings={controller.bindings} onChange={controller.setBindings} onReset={controller.resetBindings} />
      ) : null}
    </Col>
  );
}
