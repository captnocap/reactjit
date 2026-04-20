// Topography — 44 layered pastel contour ridges. Each layer spawns 11 stripes
// with sin-wave micro-wobble + fbm-driven ridge lift. Port of
// tsz/carts/conformance/mixed/effects/topography.tsz.

import { Box, Effect } from '../../runtime/primitives';
const React: any = require('react');

const TOPO_WGSL = `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let x = in.uv.x * U.size_w;
  let y = in.uv.y * U.size_h;
  let width = U.size_w;
  let height = U.size_h;
  let drift = U.time * 0.018;
  let bleedX = width * 0.16;
  let fieldWidth = width + bleedX * 2.0;

  var col = vec3f(0.70, 0.66, 0.98);

  for (var layer = 0; layer < 44; layer = layer + 1) {
    let depth = f32(layer) / 44.0;
    let baseY = height * (-0.08 + depth * 1.06);
    let amplitude = height * (0.05 + depth * depth * 0.28);
    let spacing = 2.2 + depth * 4.4;
    let wobbleScale = 0.40 + depth * 1.45;
    let driftedDepth = depth * 5.5 - drift;

    let column = x + bleedX;
    let nx = column / fieldWidth;
    let diagonalTilt = (nx - 0.5) * height * (0.12 - depth * 0.060);
    let warp = snoise3(nx * 3.8 + depth * 0.8, depth * 7.5, drift * 2.4) * 0.28;
    let ridgeField = fbm(nx * (2.1 + depth * 1.9) + warp + depth * 0.7, driftedDepth, 5.0);
    let ridge = 1.0 - abs(ridgeField);
    let lift = ridge * ridge;
    let shoulder = sin(nx * 9.0 + depth * 8.5 + warp * 6.0) * 0.16 + 0.90;
    let valley = sin(nx * 2.7 + depth * 6.0) * height * (0.018 + (1.0 - depth) * 0.014);
    let crest = baseY - lift * amplitude * shoulder + valley + diagonalTilt;
    let stripePhase = snoise3(nx * 15.0, depth * 5.0 + 2.0, drift * 3.3);

    for (var stripe = 0; stripe < 11; stripe = stripe + 1) {
      let stripeDepth = f32(stripe) / 11.0;
      let ripple = sin(nx * 18.0 + f32(stripe) * 0.78 + depth * 11.0 + drift * 5.5 + stripePhase * 2.0) * wobbleScale;
      let micro = sin(nx * 34.0 + f32(stripe) * 1.45 + depth * 17.0 + stripePhase * 5.0) * (0.24 + depth * 0.66);
      let lineY = crest + f32(stripe) * spacing + ripple + micro;

      let dy = y - lineY;
      if (dy >= -1.5 && dy < 2.5) {
        let huePrimary = 0.16 * sin(depth * 6.28318 + f32(stripe) * 0.46 + nx * 4.0 + drift);
        let hueSecondary = 0.10 * sin(f32(stripe) * 1.25 + depth * 10.0 + nx * 12.0);
        let hue = fract(0.73 + huePrimary + hueSecondary);
        let saturation = clamp(0.74 - depth * 0.08 + sin(f32(stripe) * 0.55 + depth * 5.5) * 0.07, 0.0, 1.0);
        let lightness = clamp(0.73 + stripeDepth * 0.05 - depth * 0.07 + lift * 0.05, 0.0, 1.0);
        let rgb = hsl2rgb(hue, saturation, lightness);
        let highlight = hsl2rgb(fract(hue + 0.035), saturation * 0.72, clamp(lightness + 0.08, 0.0, 1.0));
        let shadow = hsl2rgb(fract(hue + 0.97), clamp(saturation * 0.92, 0.0, 1.0), clamp(lightness - 0.12, 0.0, 1.0));

        if (dy >= -1.5 && dy < -0.5) { col = shadow; }
        else if (dy >= -0.5 && dy < 0.5) { col = rgb; }
        else if (dy >= 0.5 && dy < 1.5) { col = highlight; }
        else { col = rgb; }
      }
    }
  }
  return vec4f(col, 1.0);
}
`;

export default function Topography() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#b4a7ff' }}>
      <Effect shader={TOPO_WGSL} style={{ flexGrow: 1 }} />
    </Box>
  );
}
