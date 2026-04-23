import { Col, Row, Text, TextArea } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';
import { ModePicker } from './ModePicker';
import { AttachmentRail } from './AttachmentRail';
import { VariablePreview } from './VariablePreview';
import { Tooltip } from '../tooltip';

const SLASH_COMMANDS = [
  { cmd: '/model', desc: 'Cycle through enabled models' },
  { cmd: '/plan', desc: 'Switch to plan mode' },
  { cmd: '/default', desc: 'Use default model' },
  { cmd: '/clear', desc: 'Clear conversation' },
  { cmd: '/index', desc: 'Index workspace' },
  { cmd: '/git', desc: 'Show git status' },
  { cmd: '/help', desc: 'List commands' },
];

function getActiveToken(input: string): { token: string; startIndex: number } {
  const lastSpace = input.lastIndexOf(' ');
  if (lastSpace >= 0) {
    return { token: input.slice(lastSpace + 1), startIndex: lastSpace + 1 };
  }
  return { token: input, startIndex: 0 };
}

export function Composer(props: {
  currentInput: string;
  agentMode: string;
  compactBand: boolean;
  attachments: any[];
  inputTokenEstimate: number;
  showVarPreview: boolean;
  varResults: any[];
  workspaceFiles: string[];
  onInputChange: (text: string) => void;
  onSend: () => void;
  onSetMode: (mode: string) => void;
  onAttachCurrentFile: () => void;
  onAttachSymbol: () => void;
  onAttachGit: () => void;
  onToggleWebSearch: () => void;
  onToggleTermAccess: () => void;
  onToggleAutoApply: () => void;
  onRemoveAttachment: (id: string) => void;
  onClearAttachments: () => void;
  onCycleModel: () => void;
  modelDisplayName: string;
  sendLabel: string;
  handleComposerKey: (payload: any) => void;
}) {
  const { token, startIndex } = getActiveToken(props.currentInput);
  const menuType = token.startsWith('/') ? 'slash' : token.startsWith('@') ? 'at' : null;
  const query = token.slice(1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [props.currentInput]);

  let menuItems: Array<{ label: string; desc: string; value: string }> = [];
  if (menuType === 'slash') {
    menuItems = SLASH_COMMANDS
      .filter((item) => query.length === 0 || item.cmd.slice(1).toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({ label: item.cmd, desc: item.desc, value: item.cmd + ' ' }));
  } else if (menuType === 'at') {
    menuItems = props.workspaceFiles
      .filter((path: string) => query.length === 0 || path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map((path: string) => ({ label: path, desc: path.split('/').pop() || path, value: '@' + path + ' ' }));
  }

  const menuOpen = menuItems.length > 0;
  const safeHighlight = menuItems.length > 0 ? Math.min(highlightedIndex, menuItems.length - 1) : 0;

  function insertMenuItem(value: string) {
    const before = props.currentInput.slice(0, startIndex);
    props.onInputChange(before + value);
  }

  function handleKeyDown(payload: any) {
    const key = payload.keyCode;
    if (menuOpen) {
      if (key === 13) {
        const item = menuItems[safeHighlight];
        if (item) insertMenuItem(item.value);
      } else if (key === 27) {
        const before = props.currentInput.slice(0, startIndex);
        props.onInputChange(before);
      } else if (key === 81) {
        setHighlightedIndex((prev) => Math.min(prev + 1, menuItems.length - 1));
      } else if (key === 82) {
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
      return;
    }
    props.handleComposerKey(payload);
  }

  return (
    <Col style={{ padding: props.compactBand ? 10 : 12, gap: 8, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      <ModePicker agentMode={props.agentMode} onSetMode={props.onSetMode} />

      <Col style={{ gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
        <AttachmentRail
          attachments={props.attachments}
          onRemove={props.onRemoveAttachment}
          onClear={props.onClearAttachments}
        />

        {menuOpen ? (
          <Col style={{ maxHeight: 200, gap: 2, padding: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ paddingLeft: 4, paddingBottom: 4 }}>
              {menuType === 'slash' ? 'Commands' : 'Files'}
            </Text>
            {menuItems.map((item, idx) => (
              <Tooltip key={item.label} label={item.desc} side="right">
                <HoverPressable
                  onPress={() => insertMenuItem(item.value)}
                  style={{ padding: 8, borderRadius: 6, backgroundColor: idx === safeHighlight ? COLORS.blueDeep : 'transparent' }}
                >
                  <Row style={{ gap: 8, alignItems: 'center' }}>
                    <Text fontSize={10} color={idx === safeHighlight ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.label}</Text>
                    <Text fontSize={10} color={COLORS.textDim}>{item.desc}</Text>
                  </Row>
                </HoverPressable>
              </Tooltip>
            ))}
          </Col>
        ) : null}

        <TextArea
          value={props.currentInput}
          onChange={props.onInputChange}
          onKeyDown={handleKeyDown}
          fontSize={11}
          color={COLORS.text}
          style={{ height: 84, borderWidth: 0, backgroundColor: 'transparent' }}
        />

        {props.showVarPreview ? <VariablePreview results={props.varResults} /> : null}

        <Col style={{ gap: 8 }}>
          <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tooltip label="Attach the current file" side="bottom"><HoverPressable onPress={props.onAttachCurrentFile} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}><Text fontSize={10} color={COLORS.blue}>File</Text></HoverPressable></Tooltip>
            <Tooltip label="Attach a symbol reference" side="bottom"><HoverPressable onPress={props.onAttachSymbol} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}><Text fontSize={10} color={COLORS.blue}>Symbol</Text></HoverPressable></Tooltip>
            <Tooltip label="Attach git changes" side="bottom"><HoverPressable onPress={props.onAttachGit} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}><Text fontSize={10} color={COLORS.blue}>Git</Text></HoverPressable></Tooltip>
            <Tooltip label="Toggle web search" side="bottom"><HoverPressable onPress={props.onToggleWebSearch} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}><Text fontSize={10} color={COLORS.blue}>Web</Text></HoverPressable></Tooltip>
            <Tooltip label="Toggle terminal access" side="bottom"><HoverPressable onPress={props.onToggleTermAccess} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}><Text fontSize={10} color={COLORS.textDim}>Term</Text></HoverPressable></Tooltip>
            <Tooltip label="Toggle auto apply" side="bottom"><HoverPressable onPress={props.onToggleAutoApply} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}><Text fontSize={10} color={COLORS.textDim}>Auto</Text></HoverPressable></Tooltip>
          </Row>
          <Row style={{ gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {props.inputTokenEstimate > 0 ? <Text fontSize={10} color={props.inputTokenEstimate > 16000 ? COLORS.red : props.inputTokenEstimate > 8000 ? COLORS.yellow : COLORS.textDim}>{props.inputTokenEstimate + ' tkns'}</Text> : null}
            <Tooltip label="Cycle the active model" side="bottom" shortcut="Ctrl+/"><HoverPressable onPress={props.onCycleModel} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
              <Text fontSize={10} color={COLORS.text}>{props.modelDisplayName}</Text>
            </HoverPressable></Tooltip>
            <Tooltip label="Send the message" side="bottom" shortcut="Ctrl+Enter"><HoverPressable onPress={props.onSend} style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: 10, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{props.sendLabel}</Text>
            </HoverPressable></Tooltip>
          </Row>
        </Col>
      </Col>
    </Col>
  );
}
