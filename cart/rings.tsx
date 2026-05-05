// Rings — concentric expanding rings with HSV color cycling.
// Port of tsz/carts/conformance/mixed/effects/rings.tsz.

import { Box, Effect } from '@reactjit/runtime/primitives';
const RINGS_WGSL = `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let x = in.uv.x * U.size_w;
  let y = in.uv.y * U.size_h;
  let cx = U.size_w * 0.5;
  let cy = U.size_h * 0.5;
  let t = U.time;
  let dx = x - cx;
  let dy = y - cy;
  let dist = sqrt(dx * dx + dy * dy);
  let ring = sin(dist * 0.05 - t * 3.0) * 0.5 + 0.5;
  let hue = dist * 0.01 + t * 0.2;
  let rgb = hsv2rgb(hue, 0.8, ring);
  return vec4f(rgb, ring);
}
`;

export default function Rings() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}>
      <Effect shader={RINGS_WGSL} style={{ flexGrow: 1 }} />
    </Box>
  );
}
