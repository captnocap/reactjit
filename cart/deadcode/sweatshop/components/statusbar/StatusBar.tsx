
import { Row } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { useStatusRegistry, getSegmentDisplayState } from './useStatusRegistry';

// Import all segments to trigger self-registration
import './segments/GitBranch';
import './segments/GitAheadBehind';
import './segments/GitDirtyStaged';
import './segments/Sparklines';
import './segments/XpLevel';
import './segments/Tokenization';
import './segments/MemoryTelemetry';
import './segments/CursorPos';
import './segments/FileInfo';
import './segments/LineEndings';
import './segments/Encoding';
import './segments/Indent';
import './segments/Language';
import './segments/Model';
import './segments/Problems';
import './segments/AgentStatus';
import './segments/SettingsGear';
import './segments/Clock';

export function StatusBar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';
  const segmentProps = { ...props, compactBand, mediumBand };

  const registry = useStatusRegistry();

  const left: any[] = [];
  const center: any[] = [];
  const right: any[] = [];

  for (const def of registry) {
    const state = getSegmentDisplayState(def.id);
    if (!state.visible) continue;

    const el = <def.component key={def.id} {...segmentProps} />;
    if (state.position === 'left') left.push(el);
    else if (state.position === 'center') center.push(el);
    else right.push(el);
  }

  return (
    <Row
      style={{
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 0,
        backgroundColor: COLORS.panelAlt,
        borderTopWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>{left}</Row>
      {center.length > 0 ? (
        <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>{center}</Row>
      ) : null}
      <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {right}
      </Row>
    </Row>
  );
}
