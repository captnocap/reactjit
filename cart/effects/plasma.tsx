// Plasma — classic four-wave sine plasma, running on the GPU as a
// fragment shader. Port of tsz/carts/conformance/mixed/effects/plasma.tsz.
//
// The host auto-wraps the `shader` string with the standard uniforms block
// (U.size_w, U.size_h, U.time, U.dt, U.frame, U.mouse_x/y/inside), a
// fullscreen-triangle vertex shader, and the effect_math library
// (snoise, fbm, hsv2rgb, hsl2rgb, voronoi, …). The user WGSL only needs
// to declare `fs_main` with the right signature.

import { Box, Effect } from '../../runtime/primitives';
const React: any = require('react');

const PLASMA_WGSL = `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let x = in.uv.x * U.size_w;
  let y = in.uv.y * U.size_h;
  let t = U.time;
  let fx = x * 0.02;
  let fy = y * 0.02;
  let v1 = sin(fx + t);
  let v2 = sin(fy + t * 0.7);
  let v3 = sin(fx + fy + t * 0.5);
  let v4 = sin(sqrt(fx * fx + fy * fy) + t);
  let v = (v1 + v2 + v3 + v4) * 0.25 + 0.5;
  let r = sin(v * 3.14159) * 0.5 + 0.5;
  let g = sin(v * 3.14159 + 2.094) * 0.5 + 0.5;
  let b = sin(v * 3.14159 + 4.189) * 0.5 + 0.5;
  return vec4f(r, g, b, 1.0);
}
`;

export default function Plasma() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}>
      <Effect shader={PLASMA_WGSL} style={{ flexGrow: 1 }} />
    </Box>
  );
}
