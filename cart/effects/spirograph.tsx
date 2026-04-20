// Spirograph — hypotrochoid curves with time-varying R1/R2/d radii.
// Port of tsz/carts/conformance/mixed/effects/spirograph.tsz.
//
// The .tsz original used e.fade(0.97) for trail decay across frames. The
// GPU shader path doesn't carry a persistent framebuffer between frames,
// so we analytically render the current rotation by sampling 200 points
// of the parametric curve per pixel and taking the closest one. No trail
// decay, just a clean curve.

import { Box, Effect } from '../../runtime/primitives';
const React: any = require('react');

const SPIROGRAPH_WGSL = `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let x = in.uv.x * U.size_w;
  let y = in.uv.y * U.size_h;
  let cx = U.size_w * 0.5;
  let cy = U.size_h * 0.5;
  let scale = U.size_w * 0.35;
  let t = U.time;
  let R1 = scale * (0.6 + sin(t * 0.23) * 0.2 + 0.2);
  let R2 = scale * (0.3 + sin(t * 0.31) * 0.175 + 0.175);
  let d  = scale * (0.2 + sin(t * 0.41) * 0.2 + 0.2);
  let ratio = (R1 - R2) / max(R2, 0.001);

  var col = vec3f(0.0);
  var alpha = 0.0;
  for (var step = 0; step < 200; step = step + 1) {
    let angle = t * 2.0 + f32(step) * 0.02;
    let px = (R1 - R2) * cos(angle) + d * cos(angle * ratio);
    let py = (R1 - R2) * sin(angle) - d * sin(angle * ratio);
    let dx = x - (cx + px);
    let dy = y - (cy + py);
    let dist = sqrt(dx * dx + dy * dy);
    let intensity = max(0.0, 1.0 - dist / 3.0);
    if (intensity > 0.0) {
      let hue = t * 0.1 + f32(step) * 0.002;
      let rgb = hsv2rgb(hue, 0.9, 0.85);
      col = col + rgb * intensity;
      alpha = alpha + intensity;
    }
  }
  return vec4f(col, min(alpha, 1.0));
}
`;

export default function Spirograph() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Effect shader={SPIROGRAPH_WGSL} style={{ flexGrow: 1 }} />
    </Box>
  );
}
