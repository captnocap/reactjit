import { Box, Col, Row } from '@reactjit/runtime/primitives';
import { Icon, type IconData } from '@reactjit/runtime/icons/Icon';
import { Body, Divider, InlinePill, Mono } from '../controls-specimen/controlsSpecimenParts';
import { CTRL, toneColor, toneSoftBackground, type ControlTone } from '../controls-specimen/controlsSpecimenTheme';

export type TooltipHeaderProps = {
  title?: string;
  detail?: string;
  shortcut?: string;
  tone?: ControlTone;
  icon?: IconData;
};

function textLines(value: string, maxChars: number): string[] {
  const source = String(value || '').trim();
  if (!source) return [];
  const lines: string[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    let line = '';

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

export function TooltipHeader({
  title = 'Tooltip header',
  detail = 'Contextual helper text',
  shortcut,
  tone = 'accent',
  icon,
}: TooltipHeaderProps) {
  const color = toneColor(tone);
  const detailLines = textLines(detail, 42);

  return (
    <>
      <Row style={{ width: '100%', gap: 10, alignItems: 'flex-start' }}>
        {icon ? (
          <Box
            style={{
              width: 28,
              height: 28,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: color,
              backgroundColor: toneSoftBackground(tone),
            }}
          >
            <Icon icon={icon} size={16} color={color} strokeWidth={2.2} />
          </Box>
        ) : null}
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 3 }}>
          <Body fontSize={14} fontWeight="bold">{title}</Body>
          {detailLines.length ? (
            <Col style={{ width: '100%', gap: 1 }}>
              {detailLines.map((line, index) => (
                <Mono key={`${line}-${index}`} fontSize={9} lineHeight={10} letterSpacing={0.4} color={CTRL.inkDim} noWrap>
                  {line}
                </Mono>
              ))}
            </Col>
          ) : null}
        </Col>
        {shortcut ? <InlinePill label={shortcut} tone={tone} /> : null}
      </Row>
      <Divider />
    </>
  );
}
