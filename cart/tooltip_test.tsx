// tooltip_test — minimal cart to isolate the tooltip/drift bug.
// No canvas. Two hover buttons side-by-side:
//   LEFT  = engine-native tooltip (Zig-side: node.tooltip + hoverable)
//   RIGHT = JS-side tooltip (React useState + absolute-positioned div)
//
// Observe the three surrounding text cards as you hover each button. If they
// shift for the LEFT (Zig) version but stay rock-still for the RIGHT (JS)
// version, the engine's tooltip overlay is responsible.

const React: any = require('react');
const { useState } = React;

import { Box, Pressable, Text } from '../runtime/primitives';

function EngineTooltipButton() {
  return (
    <Pressable
      hoverable={true}
      tooltip="engine-native tooltip — painted by framework/tooltip.zig as an overlay"
      onPress={() => {}}
      style={{ width: 220, height: 56, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 14, color: '#ffffff' }}>hover me · engine tooltip</Text>
    </Pressable>
  );
}

function JsTooltipButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <Box style={{ position: 'relative' }}>
      <Pressable
        hoverable={true}
        onPress={() => {}}
        onHoverEnter={() => setHovered(true)}
        onHoverExit={() => setHovered(false)}
        style={{ width: 220, height: 56, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 14, color: '#ffffff' }}>hover me · JS tooltip</Text>
      </Pressable>
      {hovered && (
        <Box style={{ position: 'absolute', top: -42, left: 0, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, backgroundColor: '#1c1f29', borderRadius: 6, borderWidth: 1, borderColor: '#3f4450' }}>
          <Text style={{ fontSize: 13, color: '#e2e8f0' }}>JS-side tooltip — no engine overlay</Text>
        </Box>
      )}
    </Box>
  );
}

export default function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', padding: 40, gap: 24 }}>
      <Text style={{ fontSize: 20, color: '#e2e8f0', fontWeight: 'bold' }}>tooltip drift test · no canvas</Text>
      <Text style={{ fontSize: 12, color: '#94a3b8' }}>Hover each button below. Watch the text cards for any shifting.</Text>

      <Box style={{ flexDirection: 'row', gap: 24 }}>
        <Box style={{ flexDirection: 'column', gap: 6, padding: 16, backgroundColor: '#1e293b', borderRadius: 8, width: 260 }}>
          <Text style={{ fontSize: 14, color: '#cbd5e1' }}>Ship the cockpit QuestLog tile</Text>
          <Text style={{ fontSize: 11, color: '#64748b' }}>6 / 8 steps</Text>
          <Text style={{ fontSize: 10, color: '#475569' }}>Reserved observation line</Text>
        </Box>

        <Box style={{ flexDirection: 'column', gap: 6, padding: 16, backgroundColor: '#1e293b', borderRadius: 8, width: 260 }}>
          <Text style={{ fontSize: 14, color: '#cbd5e1' }}>R · Ready for your task</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>s · streaming status</Text>
          <Text style={{ fontSize: 11, color: '#64748b' }}>another line for measurement</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 24 }}>
        <EngineTooltipButton />
        <JsTooltipButton />
      </Box>

      <Box style={{ flexDirection: 'column', gap: 4, padding: 16, backgroundColor: '#1e293b', borderRadius: 8, width: 260 }}>
        <Text style={{ fontSize: 12, color: '#94a3b8' }}>bottom observation card</Text>
        <Text style={{ fontSize: 14, color: '#cbd5e1' }}>✦ ⌘ ⌖ ◈ ✧ ⬢ action glyphs</Text>
        <Text style={{ fontSize: 10, color: '#64748b' }}>if this shifts, the tooltip is the cause</Text>
      </Box>
    </Box>
  );
}
