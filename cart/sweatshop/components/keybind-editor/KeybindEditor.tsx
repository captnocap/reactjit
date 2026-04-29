
import { Col, Row } from '@reactjit/runtime/primitives';
import { CommandList } from './CommandList';
import { BindingCapture } from './BindingCapture';
import { KeybindConflict } from './KeybindConflict';
import { KeybindPresets } from './KeybindPresets';
import { findConflicts, useKeybindStore } from './useKeybindStore';

export function KeybindEditor(props: { query?: string; resetToken?: number } = {}) {
  const store = useKeybindStore();
  const [query, setQuery] = useState(props.query || '');
  const [selectedId, setSelectedId] = useState(store.commands[0]?.id || '');
  const [recordingId, setRecordingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof props.query === 'string') setQuery(props.query);
  }, [props.query]);

  useEffect(() => {
    if (!selectedId && store.commands[0]) setSelectedId(store.commands[0].id);
  }, [selectedId, store.commands]);

  useEffect(() => {
    if (props.resetToken === undefined) return;
    setSelectedId(store.commands[0]?.id || '');
    setRecordingId(null);
  }, [props.resetToken, store.commands]);

  const selected = store.commands.find((command) => command.id === selectedId) || null;
  const selectedChord = selected ? store.bindings[selected.id] || '' : '';
  const selectedConflicts = selectedChord ? (findConflicts(store.overrides)[selectedChord] || []).filter((id) => id !== selected?.id).map((id) => store.commands.find((command) => command.id === id)).filter(Boolean) as any[] : [];

  return (
    <Col style={{ gap: 14 }}>
      <Row style={{ gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 320 }}>
          <CommandList query={query} onQueryChange={setQuery} commands={store.commands} bindings={store.bindings} conflictMap={store.conflictMap} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setRecordingId(null); }} />
        </Col>
        <Col style={{ width: 380, flexShrink: 0, gap: 12 }}>
          <BindingCapture
            commandLabel={selected?.label}
            value={selectedChord}
            active={recordingId === selectedId}
            onStart={() => selectedId && setRecordingId(selectedId)}
            onCommit={(chord) => { if (selected) store.updateBinding(selected.id, chord); }}
            onCancel={() => setRecordingId(null)}
          />
          <KeybindConflict
            selected={selected}
            chord={selectedChord}
            conflicts={selectedConflicts}
            onJump={(id) => { setSelectedId(id); setRecordingId(null); }}
          />
          <KeybindPresets
            activePreset={store.activePreset}
            onApplyPreset={store.applyPreset}
            onResetAll={store.resetAll}
          />
        </Col>
      </Row>
    </Col>
  );
}
