import React, { useState } from 'react';
import {
  Box, Text, Divider, Spacer,
  BarChart, Sparkline, useLuaInterval,
} from '../../../packages/core/src';

/* ── sun pixel grid (11 wide x 11 tall) ──────────────── */

const SUN_LINES = [
  '  .  .  .  ',
  ' .       . ',
  '.  .   .  .',
  '   .###.   ',
  '.  #####  .',
  '   #####   ',
  '.  #####  .',
  '   .###.   ',
  '.  .   .  .',
  ' .       . ',
  '  .  .  .  ',
];

const SUN_GRID = SUN_LINES.map(line =>
  [...line].map(ch => {
    if (ch === '#') return 'core';
    if (ch === '.') return 'ray';
    return null;
  })
);

const PX = 8;
const SUN_W = 11;
const SUN_H = 11;

/* ── theme ────────────────────────────────────────────── */

const BG     = '#0e0e18';
const CARD   = '#12121f';
const ACCENT = '#FFD93D';
const WARM   = '#F59E0B';
const HOT    = '#EF4444';
const COOL   = '#06B6D4';
const GREEN  = '#4ade80';
const BLUE   = '#60a5fa';
const BRIGHT = '#e0e0f0';
const MID    = '#8888aa';
const DIM    = '#444466';
const BORDER = '#1a1a2e';

const PALETTE = [
  '#FFD93D', '#FFA726', '#EF4444', '#F59E0B',
  '#06B6D4', '#60a5fa', '#12121f', '#1a1a2e',
];

/* ── tiny helpers (neofetch style) ────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: ACCENT, fontSize: 11, fontWeight: 'normal' }}>{title}</Text>
      {children}
    </Box>
  );
}

function Bar({ value, max, width, color, height }: { value: number; max: number; width: number; color: string; height?: number }) {
  const h = height || 6;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <Box style={{ width, height: h, backgroundColor: '#1e1e30', borderRadius: 2 }}>
      <Box style={{ width: Math.round(width * pct), height: h, backgroundColor: color, borderRadius: 2 }} />
    </Box>
  );
}

function Label({ text, color }: { text: string; color?: string }) {
  return <Text style={{ fontSize: 10, color: color || MID }}>{text}</Text>;
}

function Val({ text, color }: { text: string; color?: string }) {
  return <Text style={{ fontSize: 10, color: color || BRIGHT }}>{text}</Text>;
}

/* ── color helpers ────────────────────────────────────── */

function tempColor(t: number): string {
  if (t >= 85) return HOT;
  if (t >= 72) return WARM;
  if (t >= 60) return BLUE;
  if (t >= 45) return COOL;
  return '#a78bfa';
}

function drift(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range;
}

/* ── initial data ─────────────────────────────────────── */

const HOURLY_BASE = [64, 63, 62, 62, 63, 65, 67, 70, 72, 74, 75, 76, 78, 77, 76, 75, 73, 71, 70, 68, 67, 66, 65, 64];

const FORECAST_BASE = [
  { label: 'Mon', value: 72 },
  { label: 'Tue', value: 68 },
  { label: 'Wed', value: 65 },
  { label: 'Thu', value: 70 },
  { label: 'Fri', value: 75 },
  { label: 'Sat', value: 78 },
  { label: 'Sun', value: 74 },
];

/* ── main ─────────────────────────────────────────────── */

export function WeatherDemoStory() {
  const [w, setW] = useState({
    temp: 72, feelsLike: 70, high: 78, low: 62,
    humidity: 58, windSpeed: 12, windDir: 'NW',
    pressure: 30.12, dewPoint: 52, uvIndex: 6,
    cloudCover: 32, visibility: 10,
  });
  const [hourly, setHourly] = useState(HOURLY_BASE);
  const [forecast, setForecast] = useState(FORECAST_BASE);
  const [tick, setTick] = useState(0);

  useLuaInterval(3000, () => {
    setTick(t => t + 1);
    setW(prev => ({
      ...prev,
      temp: Math.round(drift(prev.temp, 2)),
      feelsLike: Math.round(drift(prev.feelsLike, 2)),
      humidity: Math.round(Math.max(20, Math.min(95, drift(prev.humidity, 4)))),
      windSpeed: Math.round(Math.max(2, Math.min(30, drift(prev.windSpeed, 3)))),
      pressure: +(Math.max(29.5, Math.min(30.5, drift(prev.pressure, 0.04)))).toFixed(2),
      cloudCover: Math.round(Math.max(5, Math.min(95, drift(prev.cloudCover, 5)))),
      uvIndex: Math.round(Math.max(1, Math.min(11, drift(prev.uvIndex, 1)))),
    }));
    setHourly(prev => prev.map(t => Math.round(drift(t, 1.5))));
    setForecast(prev => prev.map(f => ({
      ...f,
      value: Math.round(drift(f.value, 2)),
    })));
  });

  const secondsAgo = tick * 3;
  const timeLabel = secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 12, gap: 10 }}>

      {/* ── header: sun + identity ── */}
      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <Box style={{ width: SUN_W * PX, height: SUN_H * PX }}>
          {SUN_GRID.map((row, r) => (
            <Box key={r} style={{ flexDirection: 'row' }}>
              {row.map((cell, c) => (
                <Box key={c} style={{
                  width: PX, height: PX,
                  borderRadius: cell === 'core' ? 2 : cell === 'ray' ? 4 : 0,
                  backgroundColor: cell === 'core' ? '#FFD93D' : cell === 'ray' ? '#FFA726' : 'transparent',
                }} />
              ))}
            </Box>
          ))}
        </Box>

        <Box style={{ gap: 3 }}>
          <Text style={{ color: ACCENT, fontSize: 16, fontWeight: 'normal' }}>
            {`${Math.round(w.temp)}F@sanfrancisco`}
          </Text>
          <Divider color={DIM} />
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Label text="Sunny" color={BRIGHT} />
            <Label text={`Feels like ${w.feelsLike}F`} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Label text={`Wind ${w.windSpeed}mph ${w.windDir}`} color={MID} />
            <Label text={`Humidity ${w.humidity}%`} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Label text={`H:${w.high}F  L:${w.low}F`} color={GREEN} />
            <Label text={`UV ${w.uvIndex}`} color={w.uvIndex > 5 ? WARM : GREEN} />
          </Box>
        </Box>
      </Box>

      {/* ── palette + live badge ── */}
      <Box style={{ flexDirection: 'row', gap: 2, width: '100%', alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 1 }}>
          {PALETTE.map((color, i) => (
            <Box key={i} style={{ width: 14, height: 10, backgroundColor: color, borderRadius: 1 }} />
          ))}
        </Box>
        <Spacer size={8} />
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN }} />
          <Label text="live" color={GREEN} />
          <Label text={`(${timeLabel})`} />
        </Box>
      </Box>

      {/* ── two cards side by side ── */}
      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>

        {/* left: conditions with bars */}
        <Box style={{
          width: 280,
          backgroundColor: CARD, borderRadius: 8, padding: 10,
          borderWidth: 1, borderColor: BORDER,
        }}>
          <Section title="CONDITIONS">
            {[
              { label: 'temp', val: `${w.temp}F`, raw: w.temp, max: 110, color: tempColor(w.temp) },
              { label: 'high', val: `${w.high}F`, raw: w.high, max: 110, color: tempColor(w.high) },
              { label: 'low', val: `${w.low}F`, raw: w.low, max: 110, color: tempColor(w.low) },
              { label: 'feels', val: `${w.feelsLike}F`, raw: w.feelsLike, max: 110, color: tempColor(w.feelsLike) },
              { label: 'wind', val: `${w.windSpeed}mph`, raw: w.windSpeed, max: 40, color: BLUE },
              { label: 'humid', val: `${w.humidity}%`, raw: w.humidity, max: 100, color: COOL },
            ].map((row) => (
              <Box key={row.label} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Box style={{ width: 36 }}><Label text={row.label} /></Box>
                <Box style={{ width: 48 }}><Val text={row.val} /></Box>
                <Bar value={row.raw} max={row.max} width={130} color={row.color} />
              </Box>
            ))}
          </Section>
        </Box>

        {/* right: atmosphere + 24h sparkline */}
        <Box style={{ flexGrow: 1, gap: 12 }}>
          <Box style={{
            backgroundColor: CARD, borderRadius: 8, padding: 10,
            borderWidth: 1, borderColor: BORDER,
          }}>
            <Section title="ATMOSPHERE">
              {[
                { label: 'pressure', val: `${w.pressure} inHg` },
                { label: 'dewpoint', val: `${w.dewPoint}F` },
                { label: 'visibility', val: `${w.visibility} mi` },
                { label: 'uv index', val: `${w.uvIndex}/11`, color: w.uvIndex > 5 ? WARM : GREEN },
                { label: 'cloud', val: `${w.cloudCover}%` },
                { label: 'sunrise', val: '6:42 AM', color: WARM },
                { label: 'sunset', val: '5:48 PM', color: '#F97316' },
              ].map((row) => (
                <Box key={row.label} style={{ flexDirection: 'row', gap: 8 }}>
                  <Box style={{ width: 60 }}><Label text={row.label} /></Box>
                  <Val text={row.val} color={row.color} />
                </Box>
              ))}
            </Section>
          </Box>

          <Box style={{
            backgroundColor: CARD, borderRadius: 8, padding: 10,
            borderWidth: 1, borderColor: BORDER, gap: 4,
          }}>
            <Text style={{ color: ACCENT, fontSize: 11, fontWeight: 'normal' }}>24H TREND</Text>
            <Sparkline data={hourly} width={250} height={28} color={WARM} />
          </Box>
        </Box>
      </Box>

      {/* ── bottom: 7-day forecast ── */}
      <Box style={{
        flexGrow: 1,
        backgroundColor: CARD, borderRadius: 8, padding: 10,
        borderWidth: 1, borderColor: BORDER, gap: 6,
      }}>
        <Text style={{ color: ACCENT, fontSize: 11, fontWeight: 'normal' }}>7-DAY FORECAST</Text>
        <BarChart
          data={forecast.map((f) => ({
            label: f.label,
            value: f.value,
            color: tempColor(f.value),
          }))}
          height={80}
          showLabels
          showValues
          interactive
        />
      </Box>

    </Box>
  );
}
