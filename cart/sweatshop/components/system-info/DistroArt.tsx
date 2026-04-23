const React: any = require('react');

import { Box, Col, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

const ART: Record<string, string[]> = {
  arch: [
    '      /\\',
    '     /  \\',
    '    / /\\ \\',
    '   / ____ \\',
    '  /_/    \\_\\',
    '            ',
  ],
  ubuntu: [
    '   _---_',
    '  /     \\',
    ' |  o o  |',
    '  \\  ^  /',
    '   -----',
    '         ',
  ],
  debian: [
    '   _____',
    '  / ___/',
    ' / /__  ',
    '/\\___/  ',
    '        ',
    '        ',
  ],
  fedora: [
    '   _____',
    '  / ___/',
    ' / /__  ',
    '/_____/ ',
    '        ',
    '        ',
  ],
  mint: [
    '  __  __',
    ' / / / /',
    '/ /_/ / ',
    '\\__,_/  ',
    '        ',
    '        ',
  ],
  manjaro: [
    '  ████ ',
    '  ██   ',
    '  ████ ',
    '  ██   ',
    '  ████ ',
    '       ',
  ],
  nixos: [
    '  /\\_/\\ ',
    ' ( o.o )',
    '  > ^ < ',
    '        ',
    '        ',
    '        ',
  ],
  alpine: [
    '  /\\   ',
    ' /  \\  ',
    '/_/\\_\\ ',
    '       ',
    '       ',
    '       ',
  ],
  pop: [
    '  _____',
    ' / ___/',
    '/ /    ',
    '\\____/ ',
    '       ',
    '       ',
  ],
  void: [
    ' _   _ ',
    '| | | |',
    '| |_| |',
    '|_____|',
    '       ',
    '       ',
  ],
  suse: [
    '  ____ ',
    ' / __/ ',
    '/ /_   ',
    '\\__/   ',
    '       ',
    '       ',
  ],
  default: [
    '  ______',
    ' / ____/',
    '/ / __  ',
    '\\ \\_/ / ',
    ' \\___/  ',
    '        ',
  ],
};

function keyFromDistro(distro: string): string {
  const text = (distro || '').toLowerCase();
  if (text.includes('arch')) return 'arch';
  if (text.includes('ubuntu')) return 'ubuntu';
  if (text.includes('debian')) return 'debian';
  if (text.includes('fedora')) return 'fedora';
  if (text.includes('mint')) return 'mint';
  if (text.includes('manjaro')) return 'manjaro';
  if (text.includes('nix')) return 'nixos';
  if (text.includes('alpine')) return 'alpine';
  if (text.includes('pop')) return 'pop';
  if (text.includes('void')) return 'void';
  if (text.includes('suse') || text.includes('opensuse')) return 'suse';
  return 'default';
}

export function DistroArt(props: { distro: string }) {
  const art = ART[keyFromDistro(props.distro)] || ART.default;
  return (
    <Col style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Text fontSize={12} color={COLORS.blue} style={{ fontWeight: 'bold', fontFamily: TOKENS.fontMono }}>{props.distro || 'Unknown'}</Text>
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
        <Col style={{ gap: 0 }}>
          {art.map((line, idx) => <Text key={String(idx)} fontSize={12} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono }}>{line}</Text>)}
        </Col>
      </Box>
    </Col>
  );
}

export default DistroArt;
