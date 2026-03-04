import { registerUnitGroup, register } from './registry';

// ── Length (base: meter) ────────────────────────────────

registerUnitGroup('length', 'm', {
  mm: 0.001, cm: 0.01, km: 1000,
  in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
  nm: 1e-9, um: 1e-6,
});

// ── Weight (base: gram) ─────────────────────────────────

registerUnitGroup('weight', 'g', {
  mg: 0.001, kg: 1000, oz: 28.3495, lb: 453.592,
  ton: 907185, tonne: 1e6,
});

// ── Temperature (non-linear, explicit) ──────────────────

register('c', 'f', (c: number) => c * 9 / 5 + 32, 'temperature');
register('f', 'c', (f: number) => (f - 32) * 5 / 9, 'temperature');
register('c', 'k', (c: number) => c + 273.15, 'temperature');
register('k', 'c', (k: number) => k - 273.15, 'temperature');
register('f', 'k', (f: number) => (f - 32) * 5 / 9 + 273.15, 'temperature');
register('k', 'f', (k: number) => (k - 273.15) * 9 / 5 + 32, 'temperature');

// ── Volume (base: milliliter) ───────────────────────────

registerUnitGroup('volume', 'ml', {
  l: 1000, gal: 3785.41, qt: 946.353, pt: 473.176,
  cup: 236.588, fl_oz: 29.5735, tbsp: 14.7868, tsp: 4.92892,
});

// ── Speed (base: m/s) ──────────────────────────────────

registerUnitGroup('speed', 'mps', {
  kph: 0.277778, mph: 0.44704, knots: 0.514444,
});

// ── Area (base: m²) ────────────────────────────────────

registerUnitGroup('area', 'm2', {
  mm2: 1e-6, cm2: 1e-4, km2: 1e6,
  in2: 6.4516e-4, ft2: 0.092903, yd2: 0.836127, mi2: 2.59e6,
  ha: 1e4, acre: 4046.86,
});

// ── Time (base: second) ────────────────────────────────

registerUnitGroup('time', 's', {
  ms: 0.001, min: 60, hr: 3600, day: 86400,
  week: 604800, month: 2629746, year: 31556952,
});

// ── Data (base: byte) ──────────────────────────────────

registerUnitGroup('data', 'b', {
  kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15,
  kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776,
});

// ── Pressure (base: pascal) ─────────────────────────────

registerUnitGroup('pressure', 'pa', {
  kpa: 1000, bar: 100000, atm: 101325, psi: 6894.76,
  mmhg: 133.322, torr: 133.322,
});

// ── Energy (base: joule) ────────────────────────────────

registerUnitGroup('energy', 'j', {
  kj: 1000, cal: 4.184, kcal: 4184, wh: 3600, kwh: 3600000,
  btu: 1055.06, ev: 1.602176634e-19,
});

// ── Angle (base: degree) ───────────────────────────────

registerUnitGroup('angle', 'deg', {
  rad: 180 / Math.PI, grad: 0.9, turn: 360,
});
