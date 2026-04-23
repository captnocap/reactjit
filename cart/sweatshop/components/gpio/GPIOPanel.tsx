const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useGPIOBoard, useSensor } from '../../lib/gpio';
import { GPIOPinRow } from './GPIOPinRow';
import { GPIOPWMControl } from './GPIOPWMControl';

function Chip(props: { label: string; onPress?: () => void; color?: string }) {
  const c = props.color || COLORS.blue;
  return (
    <Pressable
      onClick={props.onPress || (() => {})}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: TOKENS.radiusPill,
        borderWidth: 1,
        borderColor: c,
        backgroundColor: c + '20',
      }}
    >
      <Text style={{ fontSize: TOKENS.fontXs, color: c, fontWeight: 'bold' }}>{props.label}</Text>
    </Pressable>
  );
}

function Banner(props: { children: any }) {
  return (
    <Box
      style={{
        padding: TOKENS.padNormal,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: COLORS.yellow,
        backgroundColor: COLORS.yellowDeep,
        marginBottom: TOKENS.spaceMd,
      }}
    >
      <Text style={{ fontSize: TOKENS.fontSm, color: COLORS.yellow }}>{props.children}</Text>
    </Box>
  );
}

export function GPIOPanel(props: { onClose?: () => void }) {
  const board = useGPIOBoard();
  const sensor = useSensor(1);
  const [filter, setFilter] = useState<'all' | 'input' | 'output' | 'unused'>('all');

  const filteredLines = board.lines.filter(l => {
    if (filter === 'input') return l.direction === 'input';
    if (filter === 'output') return l.direction === 'output';
    if (filter === 'unused') return !l.used;
    return true;
  });

  const unusedCount = board.lines.filter(l => !l.used).length;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      {/* Header */}
      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: TOKENS.spaceSm,
          padding: TOKENS.padNormal,
          borderBottomWidth: TOKENS.borderW,
          borderColor: COLORS.borderSoft,
          backgroundColor: COLORS.panelRaised,
          flexWrap: 'wrap',
        }}
      >
        <Row style={{ gap: TOKENS.spaceSm, alignItems: 'center' }}>
          <Text style={{ fontSize: TOKENS.fontLg, color: COLORS.textBright, fontWeight: 'bold' }}>
            GPIO
          </Text>
          {board.available && (
            <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted }}>
              {board.chips.length} chip{board.chips.length !== 1 ? 's' : ''} · {board.lines.length} lines · {unusedCount} free
            </Text>
          )}
        </Row>
        <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label="all" color={filter === 'all' ? COLORS.blue : COLORS.textDim} onPress={() => setFilter('all')} />
          <Chip label="input" color={filter === 'input' ? COLORS.green : COLORS.textDim} onPress={() => setFilter('input')} />
          <Chip label="output" color={filter === 'output' ? COLORS.orange : COLORS.textDim} onPress={() => setFilter('output')} />
          <Chip label="free" color={filter === 'unused' ? COLORS.purple : COLORS.textDim} onPress={() => setFilter('unused')} />
          <Chip label="refresh" onPress={board.refresh} />
          {props.onClose && <Chip label="close" onPress={props.onClose} />}
        </Row>
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ padding: TOKENS.padNormal, gap: TOKENS.spaceMd }}>
          {/* Hardware availability banner */}
          {board.error && (
            <Banner>
              {board.error}
            </Banner>
          )}

          {/* Chip summary */}
          {board.available && board.chips.length > 0 && (
            <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap' }}>
              {board.chips.map(chip => (
                <Box
                  key={chip.name}
                  style={{
                    padding: TOKENS.padTight,
                    borderRadius: TOKENS.radiusSm,
                    borderWidth: TOKENS.borderW,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.panelAlt,
                  }}
                >
                  <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text, fontFamily: TOKENS.fontMono }}>
                    {chip.name}
                  </Text>
                  <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted }}>
                    {chip.label} · {chip.lines} lines
                  </Text>
                </Box>
              ))}
            </Row>
          )}

          {/* Pin list */}
          {board.available && (
            <Box
              style={{
                borderWidth: TOKENS.borderW,
                borderColor: COLORS.border,
                borderRadius: TOKENS.radiusMd,
                backgroundColor: COLORS.panelRaised,
                overflow: 'hidden',
              }}
            >
              <Row
                style={{
                  padding: TOKENS.padTight,
                  backgroundColor: COLORS.panelAlt,
                  borderBottomWidth: TOKENS.borderW,
                  borderColor: COLORS.borderSoft,
                  gap: TOKENS.spaceSm,
                }}
              >
                <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, width: 70 }}>LINE</Text>
                <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, width: 120 }}>NAME</Text>
                <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, width: 90 }}>CONSUMER</Text>
                <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, width: 60 }}>DIR</Text>
                <Box style={{ flexGrow: 1 }} />
                <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, width: 50, textAlign: 'right' }}>VALUE</Text>
              </Row>
              {filteredLines.map(line => (
                <GPIOPinRow key={`${line.chip}-${line.offset}`} line={line} />
              ))}
              {filteredLines.length === 0 && (
                <Box style={{ padding: TOKENS.padNormal, alignItems: 'center' }}>
                  <Text style={{ fontSize: TOKENS.fontSm, color: COLORS.textDim }}>
                    No lines match the current filter.
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* PWM section */}
          {board.available && (
            <Box>
              <Text style={{ fontSize: TOKENS.fontSm, color: COLORS.textBright, fontWeight: 'bold', marginBottom: TOKENS.spaceSm }}>
                PWM
              </Text>
              {board.chips.slice(0, 1).map(chip => (
                <GPIOPWMControl key={`pwm-${chip.name}`} chip={chip.name} line={0} />
              ))}
            </Box>
          )}

          {/* Sensor section */}
          <Box>
            <Text style={{ fontSize: TOKENS.fontSm, color: COLORS.textBright, fontWeight: 'bold', marginBottom: TOKENS.spaceSm }}>
              I2C Sensors (bus 1)
            </Text>
            {sensor.error ? (
              <Banner>{sensor.error}</Banner>
            ) : (
              <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap' }}>
                {sensor.devices.length === 0 ? (
                  <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textDim }}>
                    No I2C devices detected on bus 1.
                  </Text>
                ) : (
                  sensor.devices.map(dev => (
                    <Box
                      key={`${dev.bus}-${dev.address}`}
                      style={{
                        padding: TOKENS.padTight,
                        borderRadius: TOKENS.radiusSm,
                        borderWidth: TOKENS.borderW,
                        borderColor: COLORS.green,
                        backgroundColor: COLORS.greenDeep,
                      }}
                    >
                      <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.green, fontFamily: TOKENS.fontMono }}>
                        0x{dev.address.toString(16).padStart(2, '0')}
                      </Text>
                    </Box>
                  ))
                )}
                {sensor.reading !== null && (
                  <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text, fontFamily: TOKENS.fontMono }}>
                    reg 0x00 = 0x{sensor.reading.toString(16).padStart(2, '0')} ({sensor.reading})
                  </Text>
                )}
              </Row>
            )}
          </Box>
        </Col>
      </ScrollView>
    </Col>
  );
}

export default GPIOPanel;
